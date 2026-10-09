"""Türkçe sayı okunuşu (tam sayı ve sıra sayısı).

`num2words`'ün Türkçe çıktısı kelimeleri bitişik yazıyor ("kırkbeş");
TTS kelime sınırına ihtiyaç duyduğu için okunuş burada üretilir.
"""

ONES = ["", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"]
TENS = ["", "on", "yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş", "seksen", "doksan"]
SCALES = ["", "bin", "milyon", "milyar", "trilyon", "katrilyon"]

BACK_VOWELS = "aıou"
VOWELS = "aeıioöuü"
# Sıra eki ünlüsü, kelimenin son ünlüsüne göre (dört yollu ünlü uyumu).
ORDINAL_VOWEL = {"a": "ı", "ı": "ı", "e": "i", "i": "i", "o": "u", "u": "u", "ö": "ü", "ü": "ü"}


def _below_thousand(value: int) -> list[str]:
    hundreds, rest = divmod(value, 100)
    tens, ones = divmod(rest, 10)
    words: list[str] = []
    if hundreds:
        words += ["yüz"] if hundreds == 1 else [ONES[hundreds], "yüz"]
    if tens:
        words.append(TENS[tens])
    if ones:
        words.append(ONES[ones])
    return words


def number_to_words(value: int) -> str:
    """1923 → "bin dokuz yüz yirmi üç"."""
    if value == 0:
        return "sıfır"
    if value < 0:
        return f"eksi {number_to_words(-value)}"

    groups: list[str] = []
    scale = 0
    while value > 0:
        value, chunk = divmod(value, 1_000)
        if chunk:
            if scale >= len(SCALES):
                raise ValueError("sayı çok büyük")
            # 1000 "bin" okunur, "bir bin" değil.
            words = [] if (scale == 1 and chunk == 1) else _below_thousand(chunk)
            if SCALES[scale]:
                words.append(SCALES[scale])
            groups.insert(0, " ".join(words))
        scale += 1
    return " ".join(groups)


def ordinal_to_words(value: int) -> str:
    """19 → "on dokuzuncu", 4 → "dördüncü"."""
    words = number_to_words(value).split(" ")
    words[-1] = _ordinal_word(words[-1])
    return " ".join(words)


def _ordinal_word(word: str) -> str:
    if word == "dört":
        return "dördüncü"
    last_vowel = next(char for char in reversed(word) if char in VOWELS)
    vowel = ORDINAL_VOWEL[last_vowel]
    if word[-1] in VOWELS:
        return f"{word}nc{vowel}"
    return f"{word}{vowel}nc{vowel}"
