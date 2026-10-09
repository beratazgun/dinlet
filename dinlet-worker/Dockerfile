# Dinlet worker: Docling (PDF → Markdown) + ema-lightning (Türkçe TTS) + ffmpeg.

# --- Bağımlılık derleme aşaması -------------------------------------------
# Bazı paketlerin (ör. Rust ile yazılmış normalizer-tr) her mimaride hazır
# wheel'i yok; derleyiciler yalnızca bu aşamada bulunur, çalışma imajına girmez.
FROM python:3.12-slim AS builder

ENV PIP_NO_CACHE_DIR=1 \
    CARGO_HOME=/opt/cargo \
    RUSTUP_HOME=/opt/rustup \
    PATH=/opt/cargo/bin:$PATH

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential curl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
       | sh -s -- -y --profile minimal --default-toolchain stable

RUN pip install uv==0.5.11

WORKDIR /app
COPY pyproject.toml ./
# CPU-only PyTorch: NVIDIA paketleri (~1.5 GB) imaja girmez.
RUN uv venv /opt/venv \
    && VIRTUAL_ENV=/opt/venv uv pip install -r pyproject.toml --extra ml \
       --extra-index-url https://download.pytorch.org/whl/cpu \
       --index-strategy unsafe-best-match

# --- Çalışma aşaması --------------------------------------------------------
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PATH=/opt/venv/bin:$PATH \
    HF_HOME=/models/huggingface \
    EASYOCR_MODULE_PATH=/models/easyocr \
    XDG_CACHE_HOME=/models/cache

# ffmpeg: PCM → MP3. libgl1/libglib2.0-0: Docling ve EasyOCR görüntü bağımlılıkları.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /opt/venv /opt/venv

WORKDIR /app
COPY *.py abbreviations.tr.json ./

RUN useradd --create-home --uid 10001 worker \
    && mkdir -p /models \
    && chown -R worker /models
USER worker

# Model ağırlıkları ilk çalıştırmada /models'a iner; volume ile kalıcı tutulur.
VOLUME ["/models"]

CMD ["python", "main.py"]
