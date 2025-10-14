import os
from typing import Optional, List
import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv

"""S3 utility functions for AWS S3 operations."""


load_dotenv()

def get_s3_client():
  """
  Get S3 client instance.
  
  Returns:
    boto3 S3 client
  """
  return boto3.client(
    "s3",
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    region_name=os.getenv("AWS_REGION")
  )

def bucket_exists(s3_client, bucket_name: str) -> bool:
  """
  Check if S3 bucket exists.
  
  Args:
    s3_client: boto3 S3 client
    bucket_name: Name of the bucket
    
  Returns:
    True if bucket exists, False otherwise
  """
  try:
    s3_client.head_bucket(Bucket=bucket_name)
    return True
  except ClientError:
    return False

def delete_all_objects(
  s3_client,
  bucket_name: str = os.getenv("AWS_BUCKET_NAME")
) -> int:
  """
  Delete all objects in an S3 bucket.

  Args:
    s3_client: boto3 S3 client
    bucket_name: Name of the bucket (default from environment)

  Returns:
    Number of objects deleted

  Raises:
    ValueError: If bucket does not exist
  """
  if not bucket_exists(s3_client, bucket_name):
    raise ValueError(f"S3 bucket '{bucket_name}' does not exist.")
  paginator = s3_client.get_paginator('list_objects_v2')
  total_deleted = 0
  for page in paginator.paginate(Bucket=bucket_name):
    objects = page.get('Contents', [])
    if not objects:
      continue
    to_delete = [{"Key": obj["Key"]} for obj in objects]
    s3_client.delete_objects(
      Bucket=bucket_name,
      Delete={"Objects": to_delete}
    )
    total_deleted += len(to_delete)
  return total_deleted

def delete_object(s3_client, bucket_name: str, object_key: str) -> bool:
  """
  Delete a single object from S3 bucket.
  
  Args:
    s3_client: boto3 S3 client
    bucket_name: Name of the bucket
    object_key: Key of the object
    
  Returns:
    True if deleted, False otherwise
  """
  try:
    s3_client.delete_object(Bucket=bucket_name, Key=object_key)
    return True
  except ClientError:
    return False

def delete_objects_by_book_name(
  s3_client,
  bucket_name: str,
  book_name: str
) -> int:
  """
  Delete multiple objects from S3 bucket based on book name.
  
  Args:
    s3_client: boto3 S3 client
    bucket_name: Name of the bucket
    book_name: Book name to match in object keys
    
  Returns:
    Number of objects deleted
  """
  prefix = f"{book_name}_".replace(' ', '_')
  response = s3_client.list_objects_v2(Bucket=bucket_name, Prefix=prefix)
  objects = response.get('Contents', [])
  to_delete = [{"Key": obj["Key"]} for obj in objects]
  if not to_delete:
    return 0
  s3_client.delete_objects(
    Bucket=bucket_name,
    Delete={"Objects": to_delete}
  )
  return len(to_delete)

def count_objects_by_book_name(
  s3_client,
  book_name: str,
  bucket_name: str = os.getenv("AWS_BUCKET_NAME")
) -> int:
  """
  Count number of objects in S3 bucket based on book name.

  Args:
    s3_client: boto3 S3 client
    bucket_name: Name of the bucket
    book_name: Book name to match in object keys

  Returns:
    Number of objects found

  Raises:
    ValueError: If bucket does not exist
  """
  if not bucket_exists(s3_client, bucket_name):
    raise ValueError(f"S3 bucket '{bucket_name}' does not exist.")
  prefix = f"{book_name}_".replace(' ', '_')
  response = s3_client.list_objects_v2(Bucket=bucket_name, Prefix=prefix)
  objects = response.get('Contents', [])
  return len(objects)

def count_total_objects(
  s3_client,
  bucket_name: str = os.getenv("AWS_BUCKET_NAME")
) -> int:
  """
  Count total number of objects in an S3 bucket.

  Args:
    s3_client: boto3 S3 client
    bucket_name: Name of the bucket (default from environment)

  Returns:
    Number of objects in the bucket

  Raises:
    ValueError: If bucket does not exist
  """
  if not bucket_exists(s3_client, bucket_name):
    raise ValueError(f"S3 bucket '{bucket_name}' does not exist.")
  paginator = s3_client.get_paginator('list_objects_v2')
  total = 0
  for page in paginator.paginate(Bucket=bucket_name):
    objects = page.get('Contents', [])
    total += len(objects)
  return total