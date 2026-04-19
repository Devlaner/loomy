import logging
from typing import TYPE_CHECKING

import boto3
from botocore.client import Config

from app.config import settings

if TYPE_CHECKING:
    from mypy_boto3_s3 import S3Client

logger = logging.getLogger(__name__)

_client: "S3Client | None" = None
_public_client: "S3Client | None" = None


def _build_client(endpoint: str) -> "S3Client":
    return boto3.client(
        "s3",
        endpoint_url=endpoint or None,
        region_name=settings.s3_region,
        aws_access_key_id=settings.s3_access_key or None,
        aws_secret_access_key=settings.s3_secret_key or None,
        config=Config(
            signature_version="s3v4",
            s3={
                "addressing_style": "path"
                if settings.s3_force_path_style
                else "virtual"
            },
        ),
    )


def is_enabled() -> bool:
    return bool(settings.s3_endpoint_url or settings.s3_access_key)


def _get_client() -> "S3Client":
    global _client
    if _client is None:
        _client = _build_client(settings.s3_endpoint_url)
    return _client


def _get_public_client() -> "S3Client":
    # Presigned URLs handed to browsers must point at the host browsers
    # can reach. In docker-compose, the API talks to `minio:9000` on
    # the internal network, but the browser needs a URL on the host
    # (e.g. http://localhost:9000). S3_PUBLIC_ENDPOINT_URL overrides
    # just for URL generation.
    public = settings.s3_public_endpoint_url or settings.s3_endpoint_url
    if public == settings.s3_endpoint_url:
        return _get_client()
    global _public_client
    if _public_client is None:
        _public_client = _build_client(public)
    return _public_client


def ensure_bucket(bucket: str) -> None:
    client = _get_client()
    try:
        client.head_bucket(Bucket=bucket)
    except Exception:
        try:
            client.create_bucket(Bucket=bucket)
        except Exception as exc:
            logger.warning("Could not create bucket %s: %s", bucket, exc)


def put_object(*, bucket: str, key: str, body: bytes, content_type: str) -> None:
    client = _get_client()
    client.put_object(
        Bucket=bucket,
        Key=key,
        Body=body,
        ContentType=content_type,
        CacheControl="private, max-age=3600",
    )


def delete_object(*, bucket: str, key: str) -> None:
    client = _get_client()
    try:
        client.delete_object(Bucket=bucket, Key=key)
    except Exception as exc:
        logger.warning("Failed to delete s3://%s/%s: %s", bucket, key, exc)


def presign_get_url(*, bucket: str, key: str) -> str:
    client = _get_public_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=settings.s3_presigned_url_expire_seconds,
    )
