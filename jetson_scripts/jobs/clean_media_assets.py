import time
import boto3
from dotenv import load_dotenv
import os
from supabase import create_client, Client

load_dotenv()  # loads .env into environment variables

SUPABASE_URL: str = os.getenv("SUPABASE_URL")
SUPABASE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
VERBOSE_LOGGING: bool = os.getenv("VERBOSE_LOGGING", "false").lower() == "true"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
REGION_NAME = os.getenv("WASABI_REGION")
WASABI_ENDPOINT = os.getenv("WASABI_ENDPOINT")
WASABI_KEY = os.getenv("WASABI_KEY")
WASABI_SECRET = os.getenv("WASABI_SECRET")

while True:

    s3 = boto3.client(
        "s3",
        region_name=REGION_NAME,
        endpoint_url=WASABI_ENDPOINT,
        aws_access_key_id=WASABI_KEY,
        aws_secret_access_key=WASABI_SECRET,
    )

    response = (
        #   id uuid not null default gen_random_uuid (),
        #     media_asset_id uuid not null,
        #     bucket text not null,
        #     storage_path text not null,
        #     created_at timestamp with time zone not null default now(),
        #     processed_at timestamp with time zone null,
        #     error text null,

        supabase
            .table("media_cleanup_jobs")
            .select("""
                id,
                bucket,
                storage_path,
                created_at,
                processed_at,
                error
            """)
            .is_("processed_at", None)
            .execute()
    )

    if response.data is None or len(response.data) == 0:
        print("No media cleanup jobs found.")
        time.sleep(300) # 5 minutes
        continue

    for record in response.data:
        if VERBOSE_LOGGING:
            print(f"Found media cleanup job: {record['id']} for asset at {record['storage_path']} in bucket {record['bucket']}")
        try:
            if not record['storage_path']:
                raise ValueError("storage_path is empty")
            if not record['bucket']:
                raise ValueError("bucket is empty")

            # orgs/<org_id>/uploads/<media_id>/raw/<file_name>
            # Delete everything and including media_id
            delete_prefix = "/".join(record['storage_path'].split("/")[:-2]) + "/"
            if not delete_prefix.startswith("orgs/"):
                raise ValueError("Invalid storage_path format")

            if VERBOSE_LOGGING:
                print(f"Deleting all objects with prefix: {delete_prefix} in bucket: {record['bucket']}")

            # List and delete all objects with the prefix
            bucket = record['bucket']
            paginator = s3.get_paginator('list_objects_v2')
            pages = paginator.paginate(Bucket=bucket, Prefix=delete_prefix)
            
            delete_count = 0
            for page in pages:
                if 'Contents' in page:
                    # Prepare objects for batch deletion (max 1000 at a time)
                    if VERBOSE_LOGGING:
                        for obj in page['Contents']:
                            print("Delting: ", obj)

                    objects_to_delete = [{'Key': obj['Key']} for obj in page['Contents']]
                    
                    if objects_to_delete:
                        s3.delete_objects(
                            Bucket=bucket,
                            Delete={'Objects': objects_to_delete}
                        )
                        delete_count += len(objects_to_delete)
            
            if VERBOSE_LOGGING:
                print(f"Deleted {delete_count} objects from {delete_prefix}")
            
            # Mark as processed
            supabase.table("media_cleanup_jobs").update({
                "processed_at": "now()"
            }).eq("id", record['id']).execute()
            
        except Exception as e:
            print(f"Error determining delete prefix for cleanup job {record['id']}: {e}")
            supabase.table("media_cleanup_jobs").update({
                "processed_at": "now()",
                "error": str(e)
            }).eq("id", record['id']).execute()
            continue

    print("Completed media cleanup job cycle. Sleeping for 5 minutes.")

    time.sleep(300) # 5 minutes


# Git Hub Action
# name: Cleanup media assets

# on:
#   schedule:
#     - cron: "*/5 * * * *"

# jobs:
#   cleanup:
#     runs-on: ubuntu-latest
#     steps:
#       - name: Call cleanup function
#         run: |
#           curl -X POST \
#             https://${{ secrets.SUPABASE_PROJECT_REF }}.functions.supabase.co/cleanup-media-assets \
#             -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}"
