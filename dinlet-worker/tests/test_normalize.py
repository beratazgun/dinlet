import pytest

from normalize import normalize
from numbers_tr import number_to_words, ordinal_to_words


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (0, "sıfır"),
        (7, "yedi"),
        (10, "on"),
        (45, "kırk beş"),
        (100, "yüz"),
        (101, "yüz bir"),
        (999, "dokuz yüz doksan dokuz"),
        (1_000, "bin"),
        (1_299, "bin iki yüz doksan dokuz"),
        (2_000, "iki bin"),
        (1_000_000, "bir milyon"),
        (1_250_000, "bir milyon iki yüz elli bin"),
        (3_000_001, "üç milyon bir"),
    ],
)
def test_number_to_words(value: int, expected: str) -> None:
    assert number_to_words(value) == expected


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (1, "birinci"),
        (2, "ikinci"),
        (3, "üçüncü"),
        (4, "dördüncü"),
        (5, "beşinci"),
        (6, "altıncı"),
        (9, "dokuzuncu"),
        (10, "onuncu"),
        (19, "on dokuzuncu"),
        (20, "yirminci"),
        (40, "kırkıncı"),
        (60, "altmışıncı"),
        (100, "yüzüncü"),
        (1_000, "bininci"),
    ],
)
def test_ordinal_to_words(value: int, expected: str) -> None:
    assert ordinal_to_words(value) == expected


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("Cumhuriyet 1923 yılında ilan edildi.", "Cumhuriyet bin dokuz yüz yirmi üç yılında ilan edildi."),
        ("Oran %45 oldu.", "Oran yüzde kırk beş oldu."),
        ("Oran %3,5 oldu.", "Oran yüzde üç virgül beş oldu."),
        ("Değer 3,5 birim.", "Değer üç virgül beş birim."),
        ("Değer 3,05 birim.", "Değer üç virgül sıfır beş birim."),
        ("1. Dünya Savaşı başladı.", "birinci Dünya Savaşı başladı."),
        ("19. yüzyılda değişti.", "on dokuzuncu yüzyılda değişti."),
        ("29.10.1923 tarihinde.", "yirmi dokuz ekim bin dokuz yüz yirmi üç tarihinde."),
        ("1923'te ilan edildi.", "bin dokuz yüz yirmi üçte ilan edildi."),
        ("Nüfus 1.250.000 kişi.", "Nüfus bir milyon iki yüz elli bin kişi."),
        ("TBMM açıldı.", "Türkiye Büyük Millet Meclisi açıldı."),
        ("Örnekler vb. şeyler.", "Örnekler ve benzeri şeyler."),
        ("DNA ve RNA farklıdır.", "de en a ve re en a farklıdır."),
        ("MÖ 3000 yılında.", "milattan önce üç bin yılında."),
        ("x² = 4", "x kare eşittir dört"),
        ("A → B", "A ise B"),
        ("Alan 5 km² dir.", "Alan beş kilometrekare dir."),
    ],
)
def test_normalize(text: str, expected: str) -> None:
    assert normalize(text) == expected


def test_bullets_become_sentences() -> None:
    text = "• Kuruluş: 1299\n• Kurucu: Osman Bey\n- Başkent Söğüt"
    assert normalize(text) == (
        "Kuruluş: bin iki yüz doksan dokuz. Kurucu: Osman Bey. Başkent Söğüt."
    )


def test_inline_bullets_are_split() -> None:
    assert normalize("Kuruluş 1299 • Kurucu Osman Bey") == (
        "Kuruluş bin iki yüz doksan dokuz. Kurucu Osman Bey."
    )


def test_abbreviation_does_not_match_inside_words() -> None:
    # "AB" kısaltması "ABD" veya "KABA" içinde eşleşmemeli.
    assert normalize("ABD ve AB") == "a be de ve a be"
    assert normalize("KABA bir taslak") == "KABA bir taslak"


def test_invalid_date_is_not_read_as_date() -> None:
    assert "ekim" not in normalize("45.13.2020")
