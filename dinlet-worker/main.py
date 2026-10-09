"""Dinlet worker: `extract` ve `tts` BullMQ kuyruklarını tüketir.

`tts` kuyruğunda iki tür iş vardır: `synthesize` (seslendirme) ve `mix`
(kullanıcının kendi sesiyle kaydettiği paragrafları tek sese birleştirme).

Sözleşme NestJS tarafındaki `document-queue.types.ts` ile birebir aynıdır.
Worker veritabanına dokunmaz: job'u alır, çıktıyı R2'ye yazar, sonucu job
dönüş değeri olarak verir; durumları NestJS `QueueEvents` ile günceller.
Hata fırlatılırsa BullMQ, NestJS'in verdiği deneme/bekleme ayarlarıyla
yeniden dener.
"""

import asyncio
import logging
import signal
from typing import Any

from bullmq import Job, Worker

import extract
import mix
from config import load_settings
from scheduler import EXTRACT_PRIORITY, TTS_PRIORITY, HeavyWorkSlot
from storage import Storage
from synth import Synthesizer

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("dinlet-worker")

EXTRACT_QUEUE = "extract"
TTS_QUEUE = "tts"
MIX_JOB = "mix"


class Handlers:
    def __init__(self, storage: Storage, synthesizer: Synthesizer, bitrate: str = "48k"):
        self._storage = storage
        self._synthesizer = synthesizer
        self._bitrate = bitrate
        self._slot = HeavyWorkSlot()

    async def extract(self, job: Job, _token: str) -> dict[str, Any]:
        data = job.data
        logger.info(
            "▶️ extract başladı: belge#%s (pdfKey=%s)",
            data.get("documentId"),
            data.get("pdfKey"),
        )
        try:
            async with self._slot.acquire(EXTRACT_PRIORITY):
                # CPU-yoğun iş thread'de: olay döngüsü BullMQ kilidini yenilemeye devam eder.
                result = await asyncio.to_thread(self._extract, data["pdfKey"], data["extractedKey"])
            logger.info(
                "✅ extract tamam: belge#%s, %s karakter, %s OCR sayfa",
                data["documentId"], result["chars"], result["ocrPages"],
            )
            return result
        except Exception:
            logger.exception("❌ extract hata: belge#%s", data.get("documentId"))
            raise

    def _extract(self, pdf_key: str, extracted_key: str) -> dict[str, Any]:
        output = extract.extract_markdown(self._storage.download(pdf_key))
        self._storage.upload_text(extracted_key, output.markdown)
        return {"extractedKey": extracted_key, "chars": output.chars, "ocrPages": output.ocr_pages}

    async def tts(self, job: Job, _token: str) -> dict[str, Any]:
        if job.name == MIX_JOB:
            return await self.mix(job)
        data = job.data
        logger.info(
            "▶️ tts başladı: bölüm#%s (başlık='%s', %d paragraf)",
            data.get("sectionId"),
            data.get("title"),
            len(data.get("paragraphs") or []),
        )
        try:
            async with self._slot.acquire(TTS_PRIORITY):
                result = await asyncio.to_thread(self._tts, data)
            logger.info(
                "✅ tts tamam: bölüm#%s, %s ms, %s bayt",
                data["sectionId"], result["durationMs"], result["sizeBytes"],
            )
            return result
        except Exception:
            logger.exception("❌ tts hata: bölüm#%s", data.get("sectionId"))
            raise

    def _tts(self, data: dict[str, Any]) -> dict[str, Any]:
        if data.get("clipsOnly"):
            # Bölüm sesi yok; yalnızca kısa sesler (ör. hafıza kancası).
            return {"audioKey": "", "durationMs": 0, "sizeBytes": 0, **self._clips(data)}

        output = self._synthesizer.synthesize(
            title=data["title"],
            paragraphs=data["paragraphs"],
            recap=data.get("recap"),
            sample_rate=int(data["sampleRate"]),
            # Aynı bölüm aynı sesle üretilsin (yeniden denemede tutarlılık).
            seed=int(data["sectionId"]) % (2**31),
        )
        self._storage.upload_mp3(data["audioKey"], output.mp3)
        result: dict[str, Any] = {
            "audioKey": data["audioKey"],
            "durationMs": output.duration_ms,
            "sizeBytes": len(output.mp3),
        }

        # Aralıklı tekrar sesleri: özet, sorular ve cevaplar ayrı MP3.
        result.update(self._clips(data))
        return result

    async def mix(self, job: Job) -> dict[str, Any]:
        data = job.data
        logger.info(
            "▶️ mix başladı: kayıt#%s (%d klip)", data.get("recordingId"), len(data.get("clips") or [])
        )
        try:
            async with self._slot.acquire(TTS_PRIORITY):
                result = await asyncio.to_thread(self._mix, data)
            logger.info("✅ mix tamam: kayıt#%s, %s ms", data["recordingId"], result["durationMs"])
            return result
        except Exception:
            logger.exception("❌ mix hata: kayıt#%s", data.get("recordingId"))
            raise

    def _mix(self, data: dict[str, Any]) -> dict[str, Any]:
        clips = [(int(clip["position"]), self._storage.download(clip["audioKey"])) for clip in data["clips"]]
        output = mix.mix_clips(
            clips,
            recap_position=data.get("recapPosition"),
            bitrate=self._bitrate,
        )
        self._storage.upload_mp3(data["audioKey"], output.mp3)
        return {
            "audioKey": data["audioKey"],
            "durationMs": output.duration_ms,
            "sizeBytes": len(output.mp3),
            "clips": [
                {"position": clip.position, "startMs": clip.start_ms, "durationMs": clip.duration_ms}
                for clip in output.clips
            ],
        }

    def _clips(self, data: dict[str, Any]) -> dict[str, Any]:
        clips = data.get("clips") or []
        if not clips:
            return {}
        outputs = self._synthesizer.synthesize_clips(
            [clip["text"] for clip in clips],
            sample_rate=int(data["sampleRate"]),
            seed=int(data["sectionId"]) % (2**31),
        )
        uploaded = []
        for clip, clip_output in zip(clips, outputs, strict=True):
            self._storage.upload_mp3(clip["audioKey"], clip_output.mp3)
            uploaded.append({"audioKey": clip["audioKey"], "durationMs": clip_output.duration_ms})
        return {"clips": uploaded}


async def main() -> None:
    settings = load_settings()
    storage = Storage(settings)

    logger.info("Modeller yükleniyor (ema-lightning, Docling)...")
    synthesizer = await asyncio.to_thread(Synthesizer, settings)
    await asyncio.to_thread(extract.warm_up)
    handlers = Handlers(storage, synthesizer, settings.mp3_bitrate)

    options = {
        "connection": settings.redis_url,
        "prefix": settings.queue_prefix,
        # Her kuyruktan aynı anda tek job; ağır işler ayrıca ortak yuvayla sıralanır.
        "concurrency": 1,
        "lockDuration": settings.lock_duration_ms,
    }
    workers = [
        Worker(EXTRACT_QUEUE, handlers.extract, options),
        Worker(TTS_QUEUE, handlers.tts, options),
    ]
    logger.info("Worker hazır: %s, %s", EXTRACT_QUEUE, TTS_QUEUE)

    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for signum in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(signum, stop.set)
    await stop.wait()

    logger.info("Kapanıyor: çalışan job'lar bitirilecek...")
    await asyncio.gather(*(worker.close() for worker in workers))


if __name__ == "__main__":
    asyncio.run(main())
