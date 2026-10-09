"""Kapasite ölçümü (doküman §6 "Benchmark — ilk iş").

  python bench.py tts [--minutes 10]   → ema-lightning gerçek zamana oranı (RTF)
  python bench.py extract dosya.pdf    → Docling sayfa başına süre

VPS üzerinde, production container'ıyla aynı CPU limitinde çalıştırılmalıdır.
"""

import argparse
import os
import time
from pathlib import Path

SAMPLE = (
    "Osmanlı Devleti on dördüncü yüzyılın başında Söğüt ve Domaniç çevresinde kuruldu. "
    "Kuruluş döneminde devlet, Bizans sınırındaki bir uç beyliğiydi. "
    "Orhan Bey döneminde Bursa alındı ve ilk düzenli ordu kuruldu. "
    "Bu bölümde kuruluş dönemi padişahlarını ve önemli olayları tekrar edeceğiz. "
)
# Ortalama Türkçe konuşma hızı ~ dakikada 900 karakter.
CHARS_PER_MINUTE = 900


def bench_tts(minutes: float) -> None:
    import torch
    from ema_lightning import EMA

    from synth import use_mkldnn

    torch.set_num_threads(int(os.environ.get("TORCH_THREADS", "1")))
    torch.backends.mkldnn.enabled = use_mkldnn(os.environ.get("TORCH_MKLDNN", "auto"))
    tts = EMA()
    tts.say("Isınma.", sample_rate=24_000, seed=0)

    paragraphs, total = [], 0
    while total < minutes * CHARS_PER_MINUTE:
        paragraphs.append(SAMPLE)
        total += len(SAMPLE)

    started = time.perf_counter()
    speeches = tts.say(paragraphs, sample_rate=24_000, seed=0)
    elapsed = time.perf_counter() - started
    audio_seconds = sum(speech.duration for speech in speeches)
    print(f"Ses: {audio_seconds / 60:.1f} dk, süre: {elapsed:.1f} sn")
    print(f"RTF (ses/süre): {audio_seconds / elapsed:.2f}x gerçek zaman")
    print(f"Saatlik kapasite: ~{audio_seconds / elapsed:.1f} saat ses / saat")


def bench_extract(path: str) -> None:
    import pdfplumber

    import extract

    with pdfplumber.open(path) as pdf:
        pages = len(pdf.pages)
    extract.warm_up()
    data = Path(path).read_bytes()
    started = time.perf_counter()
    result = extract.extract_markdown(data)
    elapsed = time.perf_counter() - started
    print(f"{pages} sayfa, {result.chars} karakter, {result.ocr_pages} OCR sayfa")
    print(f"Süre: {elapsed:.1f} sn, sayfa başına {elapsed / max(1, pages):.2f} sn")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    tts_parser = sub.add_parser("tts")
    tts_parser.add_argument("--minutes", type=float, default=10)
    extract_parser = sub.add_parser("extract")
    extract_parser.add_argument("pdf")
    args = parser.parse_args()
    if args.command == "tts":
        bench_tts(args.minutes)
    else:
        bench_extract(args.pdf)
