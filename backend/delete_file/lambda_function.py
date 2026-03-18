import os
import json
import boto3

S3_BUCKET_NAME = os.environ["S3_BUCKET_NAME"]
DYNAMODB_TABLE_NAME = os.environ["DYNAMODB_TABLE_NAME"]
AWS_REGION = os.environ["AWS_REGION"]

s3_client = boto3.client("s3", region_name=AWS_REGION)
dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
table = dynamodb.Table(DYNAMODB_TABLE_NAME)


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

        body = json.loads(event.get("body") or "{}")
        file_id = body.get("fileId")

        if not file_id:
            return build_response(400, {"error": "fileId is required"})

        claims = event.get("requestContext", {}).get("authorizer", {}).get("claims", {})
        user_id = claims.get("sub")

        if not user_id:
            return build_response(401, {"error": "Unauthorized: user identity not found"})

        response = table.get_item(
            Key={
                "userId": user_id,
                "fileId": file_id
            }
        )

        item = response.get("Item")

        if not item:
            return build_response(404, {"error": "File not found"})

        s3_key = item.get("s3Key")

        if s3_key:
            s3_client.delete_object(
                Bucket=S3_BUCKET_NAME,
                Key=s3_key
            )

        table.delete_item(
            Key={
                "userId": user_id,
                "fileId": file_id
            }
        )

        return build_response(200, {
            "message": "File deleted successfully",
            "fileId": file_id
        })

    except Exception as e:
        print("Error:", str(e))
        return build_response(500, {"error": str(e)})