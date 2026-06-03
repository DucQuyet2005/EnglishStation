# ============================================
# EnglishStation Whisper Service Dockerfile
# Python-based service for speech-to-text with faster-whisper
# ============================================

FROM python:3.11-slim AS production

WORKDIR /app

# Install system dependencies required by faster-whisper and ffmpeg
# ffmpeg is needed for audio format conversion
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd --system --gid 1001 whisper && \
    useradd --system --uid 1001 --gid whisper -m whisperuser

# Install Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY app ./app

# Create temp directory for uploaded audio processing (mic recordings, etc.)
# NOTE: No /tmp/youtube_audio directory needed — YouTube audio is now streamed
# directly from CDN via FFmpeg without writing any files to disk.
RUN mkdir -p /tmp/whisper && \
    chown -R whisperuser:whisper /tmp/whisper

# Create HuggingFace cache directory with correct ownership
# This is the mount point for the whisper-models Docker volume.
# Must be created and owned by whisperuser BEFORE the USER switch,
# otherwise the volume mount will be root-owned and cause PermissionError.
RUN mkdir -p /home/whisperuser/.cache/huggingface && \
    chown -R whisperuser:whisper /home/whisperuser/.cache

# Switch to non-root user
USER whisperuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Start with Uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
