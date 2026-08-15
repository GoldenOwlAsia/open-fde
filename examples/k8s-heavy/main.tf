provider "aws" {
  region = "us-east-1"
}

resource "aws_db_instance" "orders" {
  engine         = "postgres"
  instance_class = "db.t3.medium"
}
