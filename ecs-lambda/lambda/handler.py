import json
import logging
import os
from datetime import datetime, timezone

import boto3

logger = logging.getLogger()
logger.setLevel(os.environ.get("LOG_LEVEL", "INFO"))

s3 = boto3.client("s3")
BUCKET_NAME = os.environ["BUCKET_NAME"]


def handler(event: dict, context) -> dict:
    logger.info("Event: %s", json.dumps(event))

    key = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S") + ".txt"
    body = "hello world"

    s3.put_object(Bucket=BUCKET_NAME, Key=key, Body=body)
    logger.info("Uploaded s3://%s/%s", BUCKET_NAME, key)

    return {
        "statusCode": 200,
        "body": json.dumps({"bucket": BUCKET_NAME, "key": key}),
    }
