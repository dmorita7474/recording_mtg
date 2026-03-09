# ==============================================================================
# Cognito
# ==============================================================================

resource "aws_cognito_user_pool" "main" {
  name = "${local.prefix}-user-pool"

  auto_verified_attributes = ["email"]
  username_attributes      = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = true
  }

  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }
}

resource "aws_cognito_user_pool_client" "main" {
  name         = "${local.prefix}-client"
  user_pool_id = aws_cognito_user_pool.main.id

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  supported_identity_providers = ["COGNITO"]
}

# ==============================================================================
# IAM - Lambda Execution Role
# ==============================================================================

data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda" {
  name               = "${local.prefix}-lambda-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "lambda_permissions" {
  statement {
    sid = "DynamoDB"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "dynamodb:Scan",
      "dynamodb:Query",
    ]
    resources = [aws_dynamodb_table.connections.arn]
  }

  statement {
    sid = "Bedrock"
    actions = [
      "bedrock:InvokeModel",
    ]
    resources = ["*"]
  }

  statement {
    sid = "LambdaInvoke"
    actions = [
      "lambda:InvokeFunction",
    ]
    resources = ["arn:aws:lambda:${local.region}:*:function:${local.prefix}-summarize"]
  }

  statement {
    sid = "APIGatewayManagement"
    actions = [
      "execute-api:ManageConnections",
    ]
    resources = ["${aws_apigatewayv2_api.websocket.execution_arn}/*"]
  }
}

resource "aws_iam_role_policy" "lambda_permissions" {
  name   = "${local.prefix}-lambda-permissions"
  role   = aws_iam_role.lambda.id
  policy = data.aws_iam_policy_document.lambda_permissions.json
}

# ==============================================================================
# Cognito Identity Pool
# ==============================================================================

resource "aws_cognito_identity_pool" "main" {
  identity_pool_name               = "${local.prefix}-identity-pool"
  allow_unauthenticated_identities = false

  cognito_identity_providers {
    client_id               = aws_cognito_user_pool_client.main.id
    provider_name           = "cognito-idp.${local.region}.amazonaws.com/${aws_cognito_user_pool.main.id}"
    server_side_token_check = false
  }
}

resource "aws_iam_role" "identity_pool_authenticated" {
  name = "${local.prefix}-identity-pool-auth-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = "cognito-identity.amazonaws.com" }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.main.id
        }
        "ForAnyValue:StringLike" = {
          "cognito-identity.amazonaws.com:amr" = "authenticated"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "identity_pool_authenticated" {
  name = "${local.prefix}-identity-pool-auth-policy"
  role = aws_iam_role.identity_pool_authenticated.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["transcribe:StartStreamTranscriptionWebSocket"]
      Resource = "*"
    }]
  })
}

resource "aws_cognito_identity_pool_roles_attachment" "main" {
  identity_pool_id = aws_cognito_identity_pool.main.id
  roles = {
    authenticated = aws_iam_role.identity_pool_authenticated.arn
  }
}
