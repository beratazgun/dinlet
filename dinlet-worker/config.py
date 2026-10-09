"""Ortam değişkenlerinden okunan ayarlar (tek yer)."""

import os
from dataclasses import dataclass


def _int(name: str, default: int) -> int:
    value = os.environ.get(name)
    return int(value) if value else default


@dataclass(frozen=True)
class Settings:
    redis_url: str
    queue_prefix: str
    r2_endpoint: str
    r2_access_key_id: str
    r2_secret_access_key: str
    r2_bucket: str
    # Torch/Docling iş parçacığı sayısı; benchmark'a göre 1 veya 2.
    torch_threads: int
    # oneDNN (mkldnn) çekirdekleri: auto | on | off. "auto" arm64'te kapatır:
    # Apple Silicon üzerindeki Docker VM'inde ses decoder'ının konvolüsyonu
    # SIGILL ile çöküyor. x86_64 (production) üzerinde açık kalır.
    torch_mkldnn: str
    # BullMQ kilit süresi (ms). Uzun işler sırasında kilit arka planda yenilenir.
    lock_duration_ms: int
    mp3_bitrate: str
    paragraph_pause_ms: int
    recap_pause_ms: int
    clip_tail_ms: int
    title_pause_ms: int


def load_settings() -> Settings:
    password = os.environ.get("REDIS_PASSWORD") or ""
    auth = f":{password}@" if password else ""
    host = os.environ.get("REDIS_HOST", "localhost")
    port = os.environ.get("REDIS_PORT", "6379")
    return Settings(
        redis_url=os.environ.get("REDIS_URL") or f"redis://{auth}{host}:{port}",
        queue_prefix=os.environ.get("QUEUE_PREFIX", "bull"),
        r2_endpoint=os.environ["R2_ENDPOINT"],
        r2_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        r2_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        r2_bucket=os.environ["R2_BUCKET_NAME"],
        torch_threads=_int("TORCH_THREADS", 1),
        torch_mkldnn=os.environ.get("TORCH_MKLDNN", "auto"),
        lock_duration_ms=_int("LOCK_DURATION_MS", 120_000),
        mp3_bitrate=os.environ.get("MP3_BITRATE", "48k"),
        paragraph_pause_ms=_int("PARAGRAPH_PAUSE_MS", 600),
        recap_pause_ms=_int("RECAP_PAUSE_MS", 1_200),
        clip_tail_ms=_int("CLIP_TAIL_MS", 250),
        title_pause_ms=_int("TITLE_PAUSE_MS", 800),
    )
