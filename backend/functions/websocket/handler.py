import json
import logging
import os

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ["TABLE_NAME"])

bedrock_client = boto3.client("bedrock-runtime", region_name="ap-northeast-1")

MODEL_ID = "jp.anthropic.claude-haiku-4-5-20251001-v1:0"


def _get_apigw_client():
    endpoint = os.environ["WEBSOCKET_ENDPOINT"]
    return boto3.client(
        "apigatewaymanagementapi",
        endpoint_url=endpoint,
    )


def _post_to_connection(connection_id: str, data: dict) -> None:
    client = _get_apigw_client()
    client.post_to_connection(
        ConnectionId=connection_id,
        Data=json.dumps(data, ensure_ascii=False).encode("utf-8"),
    )


def _correct_transcript(text: str) -> str:
    prompt = (
        "以下は音声認識で得られたテキストです。"
        "文章として自然になるよう補正してください。"
        "フィラー（えー、あの、うーん等）は除去し、"
        "誤変換と思われる箇所は文脈から修正してください。"
        "補正後のテキストのみを返してください。\n\n"
        f"{text}"
    )
    response = bedrock_client.invoke_model(
        modelId=MODEL_ID,
        contentType="application/json",
        accept="application/json",
        body=json.dumps(
            {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 512,
                "messages": [{"role": "user", "content": prompt}],
            }
        ),
    )
    result = json.loads(response["body"].read())
    return result["content"][0]["text"].strip()


def handler(event: dict, context) -> dict:
    route_key = event.get("requestContext", {}).get("routeKey", "")
    if route_key == "$connect":
        return connect(event, context)
    elif route_key == "$disconnect":
        return disconnect(event, context)
    else:
        return send_message(event, context)


def connect(event: dict, context) -> dict:
    connection_id = event["requestContext"]["connectionId"]
    logger.info("Connect: %s", connection_id)
    table.put_item(Item={"connection_id": connection_id, "transcript": ""})
    return {"statusCode": 200, "body": "Connected"}


def disconnect(event: dict, context) -> dict:
    connection_id = event["requestContext"]["connectionId"]
    logger.info("Disconnect: %s", connection_id)
    table.delete_item(Key={"connection_id": connection_id})
    return {"statusCode": 200, "body": "Disconnected"}


def send_message(event: dict, context) -> dict:
    connection_id = event["requestContext"]["connectionId"]
    body = json.loads(event.get("body", "{}"))
    action = body.get("action")
    msg_type = body.get("type", action)  # typeフィールド優先、なければactionで判定

    logger.info("Message from %s: action=%s type=%s", connection_id, action, msg_type)

    if msg_type == "transcribe":
        text = body.get("text", "")
        if not text:
            return {"statusCode": 400, "body": "Missing text"}

        # Bedrockで文章補正
        corrected = _correct_transcript(text)
        logger.info("Corrected: %s -> %s", text[:50], corrected[:50])

        # 現在のtranscriptを取得して補正テキストを追記
        db_response = table.get_item(Key={"connection_id": connection_id})
        current = db_response.get("Item", {}).get("transcript", "")
        accumulated = (current + " " + corrected).strip()

        table.update_item(
            Key={"connection_id": connection_id},
            UpdateExpression="SET transcript = :text",
            ExpressionAttributeValues={":text": accumulated},
        )

        # 補正テキストをフロントエンドに返送
        _post_to_connection(
            connection_id,
            {"type": "transcript", "content": corrected},
        )

    elif msg_type == "summarize":
        lambda_client = boto3.client("lambda")
        lambda_client.invoke(
            FunctionName=os.environ.get(
                "SUMMARIZE_FUNCTION_NAME",
                "recording-mtg-dev-summarize",
            ),
            InvocationType="Event",
            Payload=json.dumps({"connection_id": connection_id}),
        )
        logger.info("Summarize invoked for %s", connection_id)

    else:
        _post_to_connection(
            connection_id,
            {"type": "error", "message": f"Unknown action: {action}"},
        )
        return {"statusCode": 400, "body": "Unknown action"}

    return {"statusCode": 200, "body": "Message processed"}
