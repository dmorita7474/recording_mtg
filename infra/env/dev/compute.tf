# ==============================================================================
# Lambda - Source Archives
# ==============================================================================

data "archive_file" "websocket" {
  type        = "zip"
  source_file = "${local.lambda_source_base}/websocket/handler.py"
  output_path = "${path.module}/.build/websocket.zip"
}

data "archive_file" "summarize" {
  type        = "zip"
  source_file = "${local.lambda_source_base}/summarize/handler.py"
  output_path = "${path.module}/.build/summarize.zip"
}

# ==============================================================================
# Lambda Functions
# ==============================================================================

resource "aws_lambda_function" "websocket" {
  function_name    = "${local.prefix}-websocket"
  role             = aws_iam_role.lambda.arn
  handler          = "handler.handler"
  runtime          = local.lambda_runtime
  filename         = data.archive_file.websocket.output_path
  source_code_hash = data.archive_file.websocket.output_base64sha256

  environment {
    variables = {
      TABLE_NAME         = aws_dynamodb_table.connections.name
      WEBSOCKET_ENDPOINT = "https://${aws_apigatewayv2_api.websocket.id}.execute-api.${local.region}.amazonaws.com/${local.environment}"
    }
  }
}

resource "aws_lambda_function" "summarize" {
  function_name    = "${local.prefix}-summarize"
  role             = aws_iam_role.lambda.arn
  handler          = "handler.handler"
  runtime          = local.lambda_runtime
  filename         = data.archive_file.summarize.output_path
  source_code_hash = data.archive_file.summarize.output_base64sha256

  environment {
    variables = {
      TABLE_NAME         = aws_dynamodb_table.connections.name
      WEBSOCKET_ENDPOINT = "https://${aws_apigatewayv2_api.websocket.id}.execute-api.${local.region}.amazonaws.com/${local.environment}"
    }
  }
}

# ==============================================================================
# Lambda Permissions for API Gateway
# ==============================================================================

resource "aws_lambda_permission" "websocket_connect" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.websocket.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket.execution_arn}/*/*"
}

resource "aws_lambda_permission" "summarize_invoke" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.summarize.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket.execution_arn}/*/*"
}
