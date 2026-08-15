"""Churn-prediction training job. Reads features from S3, scores with an LLM assist."""

import boto3
import openai
import pandas as pd
import sentry_sdk

sentry_sdk.init()


def load_features(bucket: str) -> pd.DataFrame:
    s3 = boto3.client("s3")
    obj = s3.get_object(Bucket=bucket, Key="features.parquet")
    return pd.read_parquet(obj["Body"])


def summarize(df: pd.DataFrame) -> str:
    client = openai.OpenAI()
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": f"Summarize: {df.describe()}"}],
    )
    return response.choices[0].message.content
