import os
import json
import uuid
import boto3
import random
import string
from boto3.dynamodb.conditions import Attr
from datetime import datetime, timedelta, timezone

S3_BUCKET_NAME = os.environ["S3_BUCKET_NAME"]
DYNAMODB_TABLE_NAME = os.environ["DYNAMODB_TABLE_NAME"]
AWS_REGION = os.environ["AWS_REGION"]
DEFAULT_LINK_EXPIRY = int(os.environ.get("DEFAULT_LINK_EXPIRY", "3600"))

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


def generate_short_code(length=6):
    chars = string.ascii_letters + string.digits
    return ''.join(random.choice(chars) for _ in range(length))


def generate_unique_short_code():
    for _ in range(10):
        code = generate_short_code()
        response = table.scan(
            FilterExpression=Attr("shortCode").eq(code)
        )
        if response.get("Count", 0) == 0:
            return code
    raise Exception("Failed to generate unique short code")


def sanitize_path_part(value):
    if not value:
        return ""
    value = value.strip().replace("\\", "/")
    parts = [part.strip() for part in value.split("/") if part.strip() and part not in [".", ".."]]
    return "/".join(parts)


def build_s3_key(user_id, file_id, file_name, upload_mode, folder, relative_path):
    safe_folder = sanitize_path_part(folder)
    safe_relative_path = sanitize_path_part(relative_path)

    # Folder upload: preserve relative folder structure
    if upload_mode == "folder" and safe_relative_path:
        if safe_folder:
            return f"uploads/{user_id}/{safe_folder}/{safe_relative_path}"
        return f"uploads/{user_id}/{safe_relative_path}"

    # Normal file upload: optional folder + unique fileId prefix
    if safe_folder:
        return f"uploads/{user_id}/{safe_folder}/{file_id}_{file_name}"

    return f"uploads/{user_id}/{file_id}_{file_name}"


def lambda_handler(event, context):
    try:
        print("Received event:", json.dumps(event))

        body = json.loads(event.get("body") or "{}")

        file_name = body.get("fileName")
        content_type = body.get("contentType")
        expiry_seconds = body.get("expirySeconds")
        folder = body.get("folder", "")
        relative_path = body.get("relativePath", "")
        upload_mode = body.get("uploadMode", "files")

        if not file_name:
            return build_response(400, {"error": "fileName is required"})

        if not content_type:
            return build_response(400, {"error": "contentType is required"})

        if not expiry_seconds:
            expiry_seconds = DEFAULT_LINK_EXPIRY

        expiry_seconds = int(expiry_seconds)

        if expiry_seconds <= 0:
            return build_response(400, {"error": "expirySeconds must be greater than 0"})

        claims = event.get("requestContext", {}).get("authorizer", {}).get("claims", {})
        user_id = claims.get("sub")

        if not user_id:
            return build_response(401, {"error": "Unauthorized: user identity not found"})

        file_id = str(uuid.uuid4())
        short_code = generate_unique_short_code()

        s3_key = build_s3_key(
            user_id=user_id,
            file_id=file_id,
            file_name=file_name,
            upload_mode=upload_mode,
            folder=folder,
            relative_path=relative_path
        )

        upload_url = s3_client.generate_presigned_url(
            ClientMethod="put_object",
            Params={
                "Bucket": S3_BUCKET_NAME,
                "Key": s3_key,
                "ContentType": content_type
            },
            ExpiresIn=expiry_seconds
        )

        uploaded_at = datetime.now(timezone.utc)
        expires_at = uploaded_at + timedelta(seconds=expiry_seconds)

        item = {
            "userId": user_id,
            "fileId": file_id,
            "shortCode": short_code,
            "fileName": file_name,
            "s3Key": s3_key,
            "uploadedAt": uploaded_at.isoformat(),
            "expiresAt": expires_at.isoformat(),
            "status": "ACTIVE",
            "downloadCount": 0,
            "contentType": content_type,
            "folder": sanitize_path_part(folder),
            "relativePath": sanitize_path_part(relative_path),
            "uploadMode": upload_mode
        }

        table.put_item(Item=item)

        return build_response(200, {
            "message": "Upload URL generated successfully",
            "uploadUrl": upload_url,
            "fileId": file_id,
            "shortCode": short_code,
            "s3Key": s3_key,
            "expiresAt": expires_at.isoformat()
        })

    except Exception as e:
        print("Error:", str(e))
        return build_response(500, {"error": str(e)})