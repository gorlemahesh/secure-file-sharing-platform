import os
import json
import boto3
from decimal import Decimal
from boto3.dynamodb.conditions import Key

DYNAMODB_TABLE_NAME = os.environ["DYNAMODB_TABLE_NAME"]
AWS_REGION = os.environ["AWS_REGION"]

dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
table = dynamodb.Table(DYNAMODB_TABLE_NAME)


def decimal_to_native(obj):
    if isinstance(obj, list):
        return [decimal_to_native(item) for item in obj]
    if isinstance(obj, dict):
        return {key: decimal_to_native(value) for key, value in obj.items()}
    if isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    return obj


def build_response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
        },
        "body": json.dumps(body)
    }


def lambda_handler(event, context):
    try:
        print("Received event:", json.dumps(event))

        claims = event.get("requestContext", {}).get("authorizer", {}).get("claims", {})
        user_id = claims.get("sub")

        if not user_id:
            return build_response(401, {"error": "Unauthorized: user identity not found"})

        response = table.query(
            KeyConditionExpression=Key("userId").eq(user_id)
        )

        items = response.get("Items", [])
        items = decimal_to_native(items)

        return build_response(200, {
            "message": "Files fetched successfully",
            "files": items
        })

    except Exception as e:
        print("Error:", str(e))
        return build_response(500, {"error": str(e)})