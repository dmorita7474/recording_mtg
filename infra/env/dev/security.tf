# ==============================================================================
# API Gateway v2 - WebSocket API
# ==============================================================================

resource "aws_apigatewayv2_api" "websocket" {
  name                       = "${local.prefix}-websocket"
  protocol_type              = "WEBSOCKET"
  route_selection_expression = "$request.body.action"
}

# ==============================================================================
# Integrations
# ==============================================================================

resource "aws_apigatewayv2_integration" "connect" {
  api_id             = aws_apigatewayv2_api.websocket.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.websocket.invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_integration" "disconnect" {
  api_id             = aws_apigatewayv2_api.websocket.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.websocket.invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_integration" "send_message" {
  api_id             = aws_apigatewayv2_api.websocket.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.websocket.invoke_arn
  integration_method = "POST"
}

# ==============================================================================
# Routes
# ==============================================================================

resource "aws_apigatewayv2_route" "connect" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "$connect"
  target    = "integrations/${aws_apigatewayv2_integration.connect.id}"
}

resource "aws_apigatewayv2_route" "disconnect" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "$disconnect"
  target    = "integrations/${aws_apigatewayv2_integration.disconnect.id}"
}

resource "aws_apigatewayv2_route" "send_message" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "sendMessage"
  target    = "integrations/${aws_apigatewayv2_integration.send_message.id}"
}

resource "aws_apigatewayv2_route" "default" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.send_message.id}"
}

# ==============================================================================
# Stage
# ==============================================================================

resource "aws_apigatewayv2_stage" "dev" {
  api_id      = aws_apigatewayv2_api.websocket.id
  name        = local.environment
  auto_deploy = true
}
