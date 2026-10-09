"""Seslendirmeden önce kural tabanlı Türkçe normalizasyon (doküman §6).

Hem Free hem Pro metnine uygulanır. Pro'da LLM bunların çoğunu bağlama
uygun biçimde zaten yapar; bu adım güvenlik ağıdır. ema-lightning'in kendi
normalizer'ı (`normalizer-tr`) da çalışır; burada alan sözlüğü ve not
metinlerine özgü kalıplar (madde işaretleri, sıra sayıları, semboller)
önceden çözülür.
"""

import json
import re
from functools import lru_cache
from pathlib import Path

from numbers_tr import number_to_words, ordinal_to_words

MONTHS = [
    "ocak", "şubat", "mart", "nisan", "mayıs", "haziran",
    "temmuz", "ağustos", "eylül", "ekim", "kasım", "aralık",
]

SYMBOLS = [
    ("°C", " derece santigrat"),
    ("°", " derece"),
    ("→", " ise "),
    ("⇒", " ise "),
    ("←", " "),
    ("≈", " yaklaşık "),
    ("≤", " küçük eşittir "),
    ("≥", " büyük eşittir "),
    ("≠", " eşit değildir "),
    ("±", " artı eksi "),
    ("×", " çarpı "),
    ("÷", " bölü "),
    ("=", " eşittir "),
    ("²", " kare"),
    ("³", " küp"),
    ("&", " ve "),
    ("…", "."),
]

# Yalnızca sembol maddeleri: "1. Dünya Savaşı" gibi sıra sayılarıyla
# karışmasın diye numaralı listeler burada ayıklanmaz (backend temizler).
BULLET_LINE = re.compile(r"^\s*[-*+•▪◦●○–]\s+", re.MULTILINE)
INLINE_BULLET = re.compile(r"\s*[•▪◦●]\s*")
DATE = re.compile(r"\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b")
PERCENT = re.compile(r"%\s?(\d+(?:,\d+)?)")
THOUSANDS = re.compile(r"\b\d{1,3}(?:\.\d{3})+\b(?!\.\d)")
DECIMAL = re.compile(r"\b(\d+),(\d+)\b")
# "1. Dünya Savaşı", "19. yüzyıl": en fazla üç basamaklı sayı + nokta + kelime.
ORDINAL = re.compile(r"\b(\d{1,3})\.\s+(?=[A-Za-zÇĞİÖŞÜçğıöşü])")
# "1923'te", "5'i": kesme işaretli ekler sayının okunuşuna bitişir.
SUFFIXED_NUMBER = re.compile(r"\b(\d+)['’]([a-zçğıöşü]+)")
NUMBER = re.compile(r"\b\d+\b")
SENTENCE_END = re.compile(r"[.!?…:;]$")


@lru_cache(maxsize=1)
def _abbreviations() -> list[tuple[re.Pattern[str], str]]:
    path = Path(__file__).with_name("abbreviations.tr.json")
    entries = {
        key: value
        for key, value in json.loads(path.read_text(encoding="utf-8")).items()
        if not key.startswith("_")
    }
    # Uzun kısaltma önce: "M.Ö." "MÖ"den, "km²" "km"den önce denenir.
    patterns = []
    for key in sorted(entries, key=len, reverse=True):
        boundary_end = r"(?![\wçğıöşüÇĞİÖŞÜ])" if key[-1].isalnum() else ""
        patterns.append(
            (re.compile(rf"(?<![\wçğıöşüÇĞİÖŞÜ]){re.escape(key)}{boundary_end}"), entries[key])
        )
    return patterns


def normalize(text: str) -> str:
    """Tek bir paragrafı/başlığı seslendirmeye hazırlar."""
    text = _bullets(text)
    text = DATE.sub(_date, text)
    text = PERCENT.sub(lambda m: f"yüzde {_decimal_words(m.group(1))}", text)
    text = THOUSANDS.sub(lambda m: m.group(0).replace(".", ""), text)
    text = DECIMAL.sub(lambda m: _decimal_words(f"{m.group(1)},{m.group(2)}"), text)
    text = ORDINAL.sub(lambda m: f"{ordinal_to_words(int(m.group(1)))} ", text)
    text = SUFFIXED_NUMBER.sub(lambda m: number_to_words(int(m.group(1))) + m.group(2), text)
    for pattern, replacement in _abbreviations():
        text = pattern.sub(replacement, text)
    text = NUMBER.sub(lambda m: number_to_words(int(m.group(0))), text)
    for symbol, replacement in SYMBOLS:
        text = text.replace(symbol, replacement)
    return re.sub(r"\s+", " ", text).strip()


def _bullets(text: str) -> str:
    """Madde işaretlerini kaldırır; her madde ayrı cümle olarak biter."""
    has_markers = bool(BULLET_LINE.search(text) or INLINE_BULLET.search(text))
    lines = [line.strip() for line in BULLET_LINE.sub("", text).splitlines() if line.strip()]
    if not has_markers and len(lines) <= 1:
        return " ".join(lines)

    sentences = []
    for line in lines:
        for part in INLINE_BULLET.split(line):
            part = part.strip()
            if part:
                sentences.append(part if SENTENCE_END.search(part) else f"{part}.")
    return " ".join(sentences)


def _date(match: re.Match[str]) -> str:
    day, month, year = (int(group) for group in match.groups())
    if not (1 <= day <= 31 and 1 <= month <= 12):
        return match.group(0)
    return f"{number_to_words(day)} {MONTHS[month - 1]} {number_to_words(year)}"


def _decimal_words(value: str) -> str:
    whole, _, fraction = value.partition(",")
    words = number_to_words(int(whole))
    if not fraction:
        return words
    # "3,05" → "üç virgül sıfır beş": baştaki sıfırlar okunur.
    leading = len(fraction) - len(fraction.lstrip("0"))
    rest = fraction.lstrip("0")
    zeros = " ".join(["sıfır"] * leading)
    tail = number_to_words(int(rest)) if rest else ""
    return " ".join(part for part in [words, "virgül", zeros, tail] if part)
