"""Kendi sesinle kayıt: paragraf kliplerini tek bölüm sesine birleştirir.

Uygulama her paragrafı ayrı dosya (iOS/Android'de genelde AAC/M4A) olarak
yükler. Klipler mono PCM'e açılır, aralarına seslendirmedeki gibi kısa
sessizlik eklenir, ses seviyesi eşitlenir ve bölüm sesleriyle aynı biçimde
MP3'e çevrilir. M4A'nın `moov` kutusu dosya sonunda olabildiği için klipler
pipe yerine geçici dosyadan okunur.
"""

import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

SAMPLE_RATE = 24_000
BYTES_PER_SAMPLE = 2
PARAGRAPH_PAUSE_MS = 450
RECAP_PAUSE_MS = 900


@dataclass
class MixedClip:
    position: int
    start_ms: int
    duration_ms: int


@dataclass
class MixOutput:
    mp3: bytes
    duration_ms: int
    clips: list[MixedClip]


def _silence(ms: int) -> bytes:
    return b"\x00" * (SAMPLE_RATE * ms // 1000 * BYTES_PER_SAMPLE)


def _ms(pcm: bytes) -> int:
    return len(pcm) * 1000 // (SAMPLE_RATE * BYTES_PER_SAMPLE)


def _run(args: list[str], data: bytes | None = None) -> bytes:
    process = subprocess.run(args, input=data, capture_output=True, check=False)
    if process.returncode != 0:
        raise RuntimeError(f"ffmpeg başarısız: {process.stderr.decode(errors='replace')}")
    return process.stdout


def decode_to_pcm(path: Path) -> bytes:
    return _run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(path),
        "-f", "s16le", "-ar", str(SAMPLE_RATE), "-ac", "1", "pipe:1",
    ])


def mix_clips(
    clips: list[tuple[int, bytes]],
    *,
    recap_position: int | None,
    bitrate: str,
) -> MixOutput:
    """`clips`: (sıra, dosya içeriği) — sıraya göre birleştirilir."""
    if not clips:
        raise ValueError("Birleştirilecek kayıt yok")
    pcm = bytearray()
    placed: list[MixedClip] = []
    with tempfile.TemporaryDirectory(prefix="dinlet-mix-") as tmp:
        for index, (position, data) in enumerate(sorted(clips, key=lambda clip: clip[0])):
            if index > 0:
                pause = RECAP_PAUSE_MS if position == recap_position else PARAGRAPH_PAUSE_MS
                pcm += _silence(pause)
            path = Path(tmp) / f"{position}.audio"
            path.write_bytes(data)
            clip_pcm = decode_to_pcm(path)
            placed.append(MixedClip(position, _ms(bytes(pcm)), _ms(clip_pcm)))
            pcm += clip_pcm

    mp3 = _run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error",
            "-f", "s16le", "-ar", str(SAMPLE_RATE), "-ac", "1", "-i", "pipe:0",
            # Telefon mikrofonu: uğultuyu kes, sesi bölüm sesleriyle aynı seviyeye getir.
            "-af", "highpass=f=80,loudnorm=I=-16:TP=-1.5:LRA=11",
            "-ar", str(SAMPLE_RATE),
            "-codec:a", "libmp3lame", "-b:a", bitrate, "-ac", "1",
            "-f", "mp3", "pipe:1",
        ],
        bytes(pcm),
    )
    return MixOutput(mp3=mp3, duration_ms=_ms(bytes(pcm)), clips=placed)
