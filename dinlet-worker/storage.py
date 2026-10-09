"""R2 (S3 uyumlu) okuma/yazma."""

import boto3
from botocore.config import Config

from config import Settings

# MP3 anahtarı metin özeti içerir; içerik değişirse anahtar da değişir.
IMMUTABLE_CACHE = "public, max-age=31536000, immutable"


class Storage:
    def __init__(self, settings: Settings):
        self._bucket = settings.r2_bucket
        self._client = boto3.client(
            "s3",
            endpoint_url=settings.r2_endpoint,
            aws_access_key_id=settings.r2_access_key_id,
            aws_secret_access_key=settings.r2_secret_access_key,
            region_name="auto",
            config=Config(s3={"addressing_style": "path"}, retries={"max_attempts": 5}),
        )

    def download(self, key: str) -> bytes:
        return self._client.get_object(Bucket=self._bucket, Key=key)["Body"].read()

    def upload_text(self, key: str, text: str, content_type: str = "text/markdown") -> None:
        self._client.put_object(
            Bucket=self._bucket,
            Key=key,
            Body=text.encode("utf-8"),
            ContentType=f"{content_type}; charset=utf-8",
        )

    def upload_mp3(self, key: str, data: bytes) -> None:
        self._client.put_object(
            Bucket=self._bucket,
            Key=key,
            Body=data,
            ContentType="audio/mpeg",
            CacheControl=IMMUTABLE_CACHE,
        )
