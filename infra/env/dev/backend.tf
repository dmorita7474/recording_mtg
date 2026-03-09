terraform {
  backend "s3" {
    bucket         = "your-terraform-state-bucket"
    key            = "recording-mtg/dev/terraform.tfstate"
    region         = "ap-northeast-1"
    encrypt        = true
    dynamodb_table = "your-terraform-lock-table"
  }
}
