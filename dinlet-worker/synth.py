"""Bölüm metnini sese çevirir (doküman §6 "`tts` job işleme adımları").

Başlık, paragraflar ve tekrar özeti ema-lightning ile tek toplu çağrıda
seslendirilir (uzun paragrafları model kendisi cümlelere böler), aralara
sessizlik eklenir ve ffmpeg ile mono MP3'e çevrilir.
"""

import platform
import subprocess
from dataclasses import dataclass

import numpy as np

from config import Settings
from normalize import normalize


@dataclass(frozen=True)
class SynthResult:
    mp3: bytes
    duration_ms: int


class Synthesizer:
    def __init__(self, settings: Settings):
        import torch
        from ema_lightning import EMA

        torch.set_num_threads(settings.torch_threads)
        torch.backends.mkldnn.enabled = use_mkldnn(settings.torch_mkldnn)
        self._settings = settings
        # Model süreç başında bir kez yüklenir; her job'da yeniden yüklenmez.
        self._tts = EMA()

    def synthesize(
        self,
        title: str,
        paragraphs: list[str],
        recap: str | None,
        sample_rate: int,
        seed: int,
    ) -> SynthResult:
        settings = self._settings
        # (metin, ardından eklenecek sessizlik ms)
        segments: list[tuple[str, int]] = [(normalize(title), settings.title_pause_ms)]
        segments += [(normalize(p), settings.paragraph_pause_ms) for p in paragraphs]
        if recap:
            # Özetten önceki duraklama paragraf arasından uzun olur.
            last_text, _ = segments[-1]
            segments[-1] = (last_text, settings.recap_pause_ms)
            segments.append((normalize(recap), 0))
        segments = [(text, pause) for text, pause in segments if text]
        if not segments:
            raise ValueError("Seslendirilecek metin yok")

        speeches = self._tts.say(
            [text for text, _ in segments], sample_rate=sample_rate, seed=seed
        )
        pieces: list[np.ndarray] = []
        for speech, (_, pause_ms) in zip(speeches, segments, strict=True):
            pieces.append(speech.audio.astype(np.float32))
            if pause_ms:
                pieces.append(np.zeros(int(sample_rate * pause_ms / 1000), dtype=np.float32))
        audio = np.concatenate(pieces)

        return SynthResult(
            mp3=encode_mp3(audio, sample_rate, settings.mp3_bitrate),
            duration_ms=round(len(audio) / sample_rate * 1000),
        )


    def synthesize_clips(
        self, texts: list[str], sample_rate: int, seed: int
    ) -> list[SynthResult]:
        """Kısa metinleri (özet, soru, cevap) tek toplu çağrıda seslendirir;
        her biri ayrı MP3 olur. Sonuna kısa bir sessizlik eklenir ki oynatıcı
        bir sonrakine geçerken kelime kesilmesin."""
        normalized = [normalize(text) for text in texts]
        if any(not text for text in normalized):
            raise ValueError("Boş klip metni")
        speeches = self._tts.say(normalized, sample_rate=sample_rate, seed=seed)
        tail = np.zeros(int(sample_rate * self._settings.clip_tail_ms / 1000), dtype=np.float32)
        results: list[SynthResult] = []
        for speech in speeches:
            audio = np.concatenate([speech.audio.astype(np.float32), tail])
            results.append(
                SynthResult(
                    mp3=encode_mp3(audio, sample_rate, self._settings.mp3_bitrate),
                    duration_ms=round(len(audio) / sample_rate * 1000),
                )
            )
        return results


def use_mkldnn(setting: str) -> bool:
    if setting in ("on", "off"):
        return setting == "on"
    return platform.machine().lower() not in ("aarch64", "arm64")


def encode_mp3(audio: np.ndarray, sample_rate: int, bitrate: str) -> bytes:
    """float32 [-1, 1] mono PCM → MP3 (ffmpeg, libmp3lame)."""
    pcm = (np.clip(audio, -1.0, 1.0) * 32767).astype("<i2").tobytes()
    process = subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error",
            "-f", "s16le", "-ar", str(sample_rate), "-ac", "1", "-i", "pipe:0",
            "-codec:a", "libmp3lame", "-b:a", bitrate, "-ac", "1",
            "-f", "mp3", "pipe:1",
        ],
        input=pcm,
        capture_output=True,
        check=False,
    )
    if process.returncode != 0:
        raise RuntimeError(f"ffmpeg başarısız: {process.stderr.decode(errors='replace')}")
    return process.stdout
