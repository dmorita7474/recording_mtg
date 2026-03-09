locals {
  prefix      = "recording-mtg-dev"
  environment = "dev"
  region      = "ap-northeast-1"

  lambda_functions   = ["websocket", "summarize"]
  lambda_runtime     = "python3.12"
  lambda_source_base = "${path.module}/../../../backend/functions"
}
