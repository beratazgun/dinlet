"""PDF → Markdown (doküman §6 "Metin çıkarma").

Docling başlık, liste ve tabloları koruyarak Markdown üretir; metin katmanı
olmayan (taranmış) sayfalarda OCR'ı devreye girer. Docling başarısız olursa
pdfplumber ile düz metin çıkarılır (yapı kaybolur ama belge işlenir).
"""

import logging
import tempfile
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

logger = logging.getLogger(__name__)

# Bundan az metni olan sayfa taranmış sayılır (OCR gerekir).
SCANNED_PAGE_MAX_CHARS = 20


@dataclass(frozen=True)
class ExtractResult:
    markdown: str
    chars: int
    ocr_pages: int


# EasyOCR'ın varsayılan quantize=True seçeneği ARM64 / Linux ortamında
# PyTorch quantized RNN op'larında SIGILL (Illegal instruction, exit 132) hatasına yol açar.
# quantize=False ile float32 ağırlıklar kullanılır ve çökme engellenir.
try:
    import easyocr

    _orig_easyocr_reader_init = easyocr.Reader.__init__

    def _patched_easyocr_reader_init(self, *args, **kwargs):
        kwargs["quantize"] = False
        return _orig_easyocr_reader_init(self, *args, **kwargs)

    easyocr.Reader.__init__ = _patched_easyocr_reader_init
except ImportError:
    # Hafif kurulumda (testler, `ml` extra'sı yok) EasyOCR bulunmaz.
    logger.debug("EasyOCR yüklü değil; quantize yaması atlandı")


@lru_cache(maxsize=1)
def _converter_no_ocr():
    """Taranmamış (dijital) PDF'ler için OCR'sız hızlı dönüştürücü."""
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import PdfPipelineOptions
    from docling.document_converter import DocumentConverter, PdfFormatOption

    options = PdfPipelineOptions(
        do_ocr=False,
        do_table_structure=True,
    )
    return DocumentConverter(
        format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=options)}
    )


@lru_cache(maxsize=1)
def _converter_with_ocr():
    """Taranmış sayfalar için EasyOCR içeren dönüştürücü."""
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import EasyOcrOptions, PdfPipelineOptions
    from docling.document_converter import DocumentConverter, PdfFormatOption

    options = PdfPipelineOptions(
        do_ocr=True,
        do_table_structure=True,
        ocr_options=EasyOcrOptions(lang=["tr", "en"]),
    )
    return DocumentConverter(
        format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=options)}
    )


def warm_up() -> None:
    _converter_no_ocr()


def extract_markdown(pdf: bytes) -> ExtractResult:
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory) / "source.pdf"
        path.write_bytes(pdf)

        ocr_pages = _count_scanned_pages(path)
        need_ocr = ocr_pages > 0
        converter = _converter_with_ocr() if need_ocr else _converter_no_ocr()
        logger.info(
            "Docling dönüştürme başlıyor (OCR: %s, taranmış sayfa: %s)...",
            need_ocr,
            ocr_pages,
        )
        try:
            markdown = converter.convert(path).document.export_to_markdown()
        except Exception:  # her Docling hatasında yedek yol denenir
            logger.exception("Docling başarısız; pdfplumber yedeğine geçiliyor")
            markdown = _plain_text(path)

        markdown = (markdown or "").strip()
        if len(markdown) < 50:
            logger.warning(
                "Docling çıktısı çok kısa (%d karakter); pdfplumber yedeği deneniyor",
                len(markdown),
            )
            plain = _plain_text(path).strip()
            if len(plain) > len(markdown):
                logger.info(
                    "pdfplumber yedeği kullanıldı: %d karakter çıkarıldı", len(plain)
                )
                markdown = plain
    return ExtractResult(markdown=markdown, chars=len(markdown), ocr_pages=ocr_pages)


def _count_scanned_pages(path: Path) -> int:
    import pdfplumber

    with pdfplumber.open(path) as pdf:
        return sum(
            1
            for page in pdf.pages
            if len((page.extract_text() or "").strip()) < SCANNED_PAGE_MAX_CHARS
        )


def _plain_text(path: Path) -> str:
    import pdfplumber

    with pdfplumber.open(path) as pdf:
        return "\n\n".join((page.extract_text() or "").strip() for page in pdf.pages)
