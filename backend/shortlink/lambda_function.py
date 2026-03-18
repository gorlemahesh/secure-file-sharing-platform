import os
import boto3
from datetime import datetime, timezone
from boto3.dynamodb.conditions import Attr

S3_BUCKET_NAME = os.environ["S3_BUCKET_NAME"]
DYNAMODB_TABLE_NAME = os.environ["DYNAMODB_TABLE_NAME"]
AWS_REGION = os.environ["AWS_REGION"]
DEFAULT_LINK_EXPIRY = int(os.environ.get("DEFAULT_LINK_EXPIRY", "3600"))

s3_client = boto3.client("s3", region_name=AWS_REGION)
dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
table = dynamodb.Table(DYNAMODB_TABLE_NAME)


def html_escape(text):
    if text is None:
        return ""
    return (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#39;")
    )


def is_expired(expires_at_str):
    if not expires_at_str:
        return False
    expires_at = datetime.fromisoformat(expires_at_str)
    now = datetime.now(timezone.utc)
    return expires_at < now


def resolve_file(short_code):
    response = table.scan(
        FilterExpression=Attr("shortCode").eq(short_code)
    )

    items = response.get("Items", [])

    if not items:
        return {
            "statusCode": 404,
            "headers": {"Content-Type": "text/plain"},
            "body": "File link not found"
        }

    item = items[0]

    if item.get("status") != "ACTIVE":
        return {
            "statusCode": 400,
            "headers": {"Content-Type": "text/plain"},
            "body": "File is not active"
        }

    if is_expired(item.get("expiresAt")):
        return {
            "statusCode": 400,
            "headers": {"Content-Type": "text/plain"},
            "body": "File link has expired"
        }

    download_url = s3_client.generate_presigned_url(
        ClientMethod="get_object",
        Params={
            "Bucket": S3_BUCKET_NAME,
            "Key": item["s3Key"]
        },
        ExpiresIn=DEFAULT_LINK_EXPIRY
    )

    return {
        "statusCode": 302,
        "headers": {
            "Location": download_url
        },
        "body": ""
    }


def resolve_folder(folder_share_code):
    response = table.scan(
        FilterExpression=Attr("folderShareCode").eq(folder_share_code)
    )

    items = response.get("Items", [])

    if not items:
        return {
            "statusCode": 404,
            "headers": {"Content-Type": "text/html"},
            "body": "<h1>Folder link not found</h1>"
        }

    valid_items = []

    for item in items:
        if item.get("status") != "ACTIVE":
            continue

        if is_expired(item.get("expiresAt")):
            continue

        download_url = s3_client.generate_presigned_url(
            ClientMethod="get_object",
            Params={
                "Bucket": S3_BUCKET_NAME,
                "Key": item["s3Key"]
            },
            ExpiresIn=DEFAULT_LINK_EXPIRY
        )

        valid_items.append({
            "fileName": item.get("fileName", "Unknown File"),
            "relativePath": item.get("relativePath", item.get("fileName", "Unknown File")),
            "downloadUrl": download_url,
            "folder": item.get("folder", "")
        })

    if not valid_items:
        return {
            "statusCode": 404,
            "headers": {"Content-Type": "text/html"},
            "body": "<h1>No active files found in this shared folder</h1>"
        }

    valid_items.sort(key=lambda x: x["relativePath"])
    folder_name = valid_items[0].get("folder") or "Shared Folder"

    file_list_html = ""
    for item in valid_items:
        file_list_html += f"""
        <li style="margin-bottom: 12px;">
          <div><strong>{html_escape(item["relativePath"])}</strong></div>
          <a href="{item["downloadUrl"]}" target="_blank" style="display:inline-block;margin-top:4px;">Download</a>
        </li>
        """

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <title>{html_escape(folder_name)}</title>
      <meta charset="utf-8" />
      <style>
        body {{
          font-family: Arial, sans-serif;
          background: #f6f8fa;
          margin: 0;
          padding: 30px;
        }}
        .container {{
          max-width: 900px;
          margin: 0 auto;
          background: white;
          padding: 24px;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.08);
        }}
        h1 {{
          margin-top: 0;
        }}
        ul {{
          padding-left: 20px;
        }}
        a {{
          color: #0b57d0;
          text-decoration: none;
        }}
        a:hover {{
          text-decoration: underline;
        }}
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Shared Folder: {html_escape(folder_name)}</h1>
        <p>{len(valid_items)} file(s) available</p>
        <ul>
          {file_list_html}
        </ul>
      </div>
    </body>
    </html>
    """

    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "text/html"
        },
        "body": html
    }


def lambda_handler(event, context):
    try:
        print("Received event:", event)

        resource_path = event.get("resource", "")
        path_parameters = event.get("pathParameters", {}) or {}

        if resource_path == "/share/{shortCode}":
            short_code = path_parameters.get("shortCode")
            if not short_code:
                return {
                    "statusCode": 400,
                    "headers": {"Content-Type": "text/plain"},
                    "body": "shortCode is required"
                }
            return resolve_file(short_code)

        if resource_path == "/share/folder/{folderShareCode}":
            folder_share_code = path_parameters.get("folderShareCode")
            if not folder_share_code:
                return {
                    "statusCode": 400,
                    "headers": {"Content-Type": "text/plain"},
                    "body": "folderShareCode is required"
                }
            return resolve_folder(folder_share_code)

        return {
            "statusCode": 400,
            "headers": {"Content-Type": "text/plain"},
            "body": "Unsupported share route"
        }

    except Exception as e:
        print("Error:", str(e))
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "text/plain"},
            "body": str(e)
        }