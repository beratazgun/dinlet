"""`tts` işi: bölüm sesi ve aralıklı tekrar klipleri (sahte sentezleyiciyle)."""

import sys
import types
from dataclasses import dataclass

# Hafif test ortamında numpy/torch yok; gerçek sentezleyici yerine sahtesi.
sys.modules.setdefault("synth", types.SimpleNamespace(Synthesizer=object))

from main import Handlers


@dataclass
class FakeOutput:
    mp3: bytes
    duration_ms: int


class FakeSynthesizer:
    def __init__(self) -> None:
        self.clip_calls: list[list[str]] = []

    def synthesize(self, **_kwargs: object) -> FakeOutput:
        return FakeOutput(mp3=b"section", duration_ms=60_000)

    def synthesize_clips(self, texts: list[str], **_kwargs: object) -> list[FakeOutput]:
        self.clip_calls.append(texts)
        return [FakeOutput(mp3=text.encode(), duration_ms=1_000 + i) for i, text in enumerate(texts)]


class FakeStorage:
    def __init__(self) -> None:
        self.uploads: dict[str, bytes] = {}

    def upload_mp3(self, key: str, data: bytes) -> None:
        self.uploads[key] = data


JOB = {
    "sectionId": 7,
    "documentId": 1,
    "userId": 2,
    "title": "Orhan Bey Dönemi",
    "paragraphs": ["Bir.", "İki."],
    "recap": "Bu bölümde…",
    "audioKey": "audio/2/1-x/7-abc.mp3",
    "sampleRate": 24000,
}


def test_section_without_clips_returns_only_section_audio() -> None:
    storage, synthesizer = FakeStorage(), FakeSynthesizer()
    result = Handlers(storage, synthesizer)._tts(dict(JOB))  # type: ignore[arg-type]

    assert result == {"audioKey": JOB["audioKey"], "durationMs": 60_000, "sizeBytes": 7}
    assert synthesizer.clip_calls == []
    assert list(storage.uploads) == [JOB["audioKey"]]


def test_clips_are_synthesized_in_one_call_and_uploaded_separately() -> None:
    storage, synthesizer = FakeStorage(), FakeSynthesizer()
    clips = [
        {"audioKey": "audio/2/1-x/7-abc-recap.mp3", "text": "Bu bölümde…"},
        {"audioKey": "audio/2/1-x/7-abc-q1.mp3", "text": "İlk meydan savaşı?"},
        {"audioKey": "audio/2/1-x/7-abc-a1.mp3", "text": "Maltepe Savaşı."},
    ]
    result = Handlers(storage, synthesizer)._tts({**JOB, "clips": clips})  # type: ignore[arg-type]

    assert synthesizer.clip_calls == [[clip["text"] for clip in clips]]
    assert result["clips"] == [
        {"audioKey": clips[0]["audioKey"], "durationMs": 1_000},
        {"audioKey": clips[1]["audioKey"], "durationMs": 1_001},
        {"audioKey": clips[2]["audioKey"], "durationMs": 1_002},
    ]
    assert storage.uploads[clips[1]["audioKey"]] == "İlk meydan savaşı?".encode()


def test_clips_only_job_skips_section_audio() -> None:
    storage, synthesizer = FakeStorage(), FakeSynthesizer()
    clip = {"audioKey": "audio/2/1-x/mnemonic-5.mp3", "text": "Hafıza kancası. Bİİ."}
    result = Handlers(storage, synthesizer)._tts(  # type: ignore[arg-type]
        {**JOB, "paragraphs": [], "audioKey": "", "clipsOnly": True, "clips": [clip]}
    )

    assert result["clips"] == [{"audioKey": clip["audioKey"], "durationMs": 1_000}]
    assert list(storage.uploads) == [clip["audioKey"]]
