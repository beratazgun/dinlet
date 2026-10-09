"""`mix` işi: paragraf kliplerinin sırası, araları ve sonuç biçimi (ffmpeg sahte)."""

import sys
import types

sys.modules.setdefault("synth", types.SimpleNamespace(Synthesizer=object))

import mix
from main import Handlers

SECOND = mix.SAMPLE_RATE * mix.BYTES_PER_SAMPLE


def fake_decode(path):  # type: ignore[no-untyped-def]
    # Dosya içeriği saniye cinsinden süre: b"2" → 2 sn PCM.
    return b"\x01" * (SECOND * int(path.read_bytes()))


def test_clips_are_ordered_with_pauses_and_recap_offset(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    monkeypatch.setattr(mix, "decode_to_pcm", fake_decode)
    monkeypatch.setattr(mix, "_run", lambda args, data=None: b"mp3")

    output = mix.mix_clips([(2, b"1"), (0, b"2"), (1, b"3")], recap_position=2, bitrate="48k")

    assert [(c.position, c.start_ms, c.duration_ms) for c in output.clips] == [
        (0, 0, 2_000),
        (1, 2_000 + mix.PARAGRAPH_PAUSE_MS, 3_000),
        (2, 5_000 + mix.PARAGRAPH_PAUSE_MS + mix.RECAP_PAUSE_MS, 1_000),
    ]
    assert output.duration_ms == 6_000 + mix.PARAGRAPH_PAUSE_MS + mix.RECAP_PAUSE_MS
    assert output.mp3 == b"mp3"


class FakeStorage:
    def __init__(self) -> None:
        self.uploads: dict[str, bytes] = {}

    def download(self, key: str) -> bytes:
        return {"a": b"1", "b": b"2"}[key]

    def upload_mp3(self, key: str, data: bytes) -> None:
        self.uploads[key] = data


def test_handler_downloads_clips_and_uploads_mix(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    monkeypatch.setattr(mix, "decode_to_pcm", fake_decode)
    monkeypatch.setattr(mix, "_run", lambda args, data=None: b"mixed")
    storage = FakeStorage()

    result = Handlers(storage, object())._mix(  # type: ignore[arg-type]
        {
            "recordingId": 3,
            "audioKey": "audio/2/1-x/rec-7.mp3",
            "recapPosition": None,
            "clips": [{"position": 0, "audioKey": "a"}, {"position": 1, "audioKey": "b"}],
        }
    )

    assert storage.uploads == {"audio/2/1-x/rec-7.mp3": b"mixed"}
    assert result["sizeBytes"] == 5
    assert [clip["position"] for clip in result["clips"]] == [0, 1]
