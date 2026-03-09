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


def _invoke_bedrock(prompt: str) -> str:
    response = bedrock_client.invoke_model(
        modelId=MODEL_ID,
        contentType="application/json",
        accept="application/json",
        body=json.dumps(
            {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 1024,
                "messages": [
                    {"role": "user", "content": prompt},
                ],
            }
        ),
    )

    result = json.loads(response["body"].read())
    return result["content"][0]["text"]


def handler(event: dict, context) -> dict:
    connection_id = event["connection_id"]

    logger.info("Summarize request for connection: %s", connection_id)

    db_response = table.get_item(Key={"connection_id": connection_id})
    item = db_response.get("Item")
    if not item:
        logger.warning("No item found for connection: %s", connection_id)
        return {"statusCode": 404, "body": "Connection not found"}

    transcript = item.get("transcript", "")
    if not transcript:
        logger.info("No transcript to summarize")
        return {"statusCode": 200, "body": "No transcript"}

    summary_prompt = (
        "以下の会議の発言内容を箇条書きで要約してください。\n\n" f"{transcript}"
    )
    summary = _invoke_bedrock(summary_prompt)

    _post_to_connection(
        connection_id,
        {"type": "summary", "content": summary},
    )

    suggestions_prompt = (
        "以下の会議内容をふまえ、次に議論すべき課題を3つ提案してください"
        "（JSON配列形式で返してください）。\n\n"
        f"{transcript}"
    )
    suggestions_raw = _invoke_bedrock(suggestions_prompt)

    try:
        suggestions = json.loads(suggestions_raw)
    except json.JSONDecodeError:
        import re

        match = re.search(r"\[.*\]", suggestions_raw, re.DOTALL)
        if match:
            suggestions = json.loads(match.group())
        else:
            suggestions = [suggestions_raw]

    _post_to_connection(
        connection_id,
        {"type": "suggestions", "content": json.dumps(suggestions, ensure_ascii=False)},
    )

    table.update_item(
        Key={"connection_id": connection_id},
        UpdateExpression="SET transcript = :empty",
        ExpressionAttributeValues={":empty": ""},
    )

    logger.info("Summary and suggestions sent for connection: %s", connection_id)

    return {"statusCode": 200, "body": "Summarized"}
