"""
EnglishStation Whisper Service
FastAPI application for speech-to-text transcription using faster-whisper.

This service is designed to run as a separate microservice,
receiving audio files via REST API and returning transcriptions.

Architecture:
- FastAPI handles HTTP requests
- faster-whisper performs the actual transcription
- Model is loaded once at startup via lifespan context manager
- Temp files are always cleaned up after processing

Endpoints:
- POST /transcribe  → Accepts audio file, returns transcription
- GET  /health      → Health check with model status
"""
import os
import logging
import tempfile
import time
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.config import settings
from app.services.whisper_service import whisper_service
from app.services.youtube_downloader import youtube_downloader, YouTubeDownloadError
from app.utils.audio_validator import validate_audio_file, validate_file_size

# ============================================
# Logging Configuration
# ============================================

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


# ============================================
# Application Lifespan (Startup / Shutdown)
# ============================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    - Startup: Load the Whisper model into memory
    - Shutdown: Unload the model and clean up resources

    The model is loaded ONCE and reused for all requests.
    This is critical for performance — loading the model takes
    several seconds and should not happen per-request.
    """
    logger.info("🚀 Starting EnglishStation Whisper Service...")
    logger.info(f"📦 Model: {settings.whisper_model_size}")
    logger.info(f"💻 Device: {settings.whisper_device}")
    logger.info(f"🔢 Compute Type: {settings.whisper_compute_type}")

    # Load model at startup
    whisper_service.load_model()

    yield  # Application runs here

    # Cleanup on shutdown
    logger.info("Shutting down Whisper service...")
    whisper_service.unload_model()


# ============================================
# FastAPI Application
# ============================================

app = FastAPI(
    title="EnglishStation Whisper Service",
    description="Speech-to-text transcription service using faster-whisper",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow Express backend to call this service
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to backend URL only
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ============================================
# Global Exception Handler
# ============================================

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Catch unhandled exceptions and return a clean JSON response."""
    logger.error(f"Unhandled error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "An internal error occurred during transcription",
            "error_type": type(exc).__name__,
        },
    )


# ============================================
# API Endpoints
# ============================================

@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """
    Transcribe an uploaded audio file to text.

    Flow:
    1. Validate the uploaded file (extension, content type)
    2. Save to a temporary file on disk
    3. Validate file size
    4. Send to Whisper model for transcription
    5. Clean up temp file
    6. Return transcription result

    Args:
        file: Audio file (wav, mp3, ogg, webm, flac, m4a, aac, mp4)

    Returns:
        JSON with transcription text, language, confidence,
        duration, and timed segments
    """
    logger.info(f"📥 Received audio file: {file.filename} ({file.content_type})")

    # Step 1: Validate file metadata
    validate_audio_file(file)

    # Step 2: Save to temp file
    # Using tempfile ensures cleanup even if errors occur
    temp_path = None
    try:
        suffix = Path(file.filename or "audio.wav").suffix.lower()
        with tempfile.NamedTemporaryFile(
            suffix=suffix,
            delete=False,
            dir=tempfile.gettempdir(),
        ) as temp_file:
            # Read and write in chunks for memory efficiency
            content = await file.read()
            temp_file.write(content)
            temp_path = temp_file.name

        logger.info(
            f"Saved temp file: {temp_path} "
            f"({os.path.getsize(temp_path) / 1024:.1f}KB)"
        )

        # Step 3: Validate file size on disk
        validate_file_size(temp_path)

        # Step 4: Transcribe
        start_time = time.time()
        result = whisper_service.transcribe(temp_path)
        elapsed = time.time() - start_time

        logger.info(f"✅ Transcription completed in {elapsed:.2f}s")

        return result

    except HTTPException:
        # Re-raise FastAPI HTTP exceptions as-is
        raise
    except FileNotFoundError as e:
        logger.error(f"File not found: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        logger.error(f"Runtime error: {e}")
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Transcription failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Transcription failed: {str(e)}",
        )
    finally:
        # Step 5: Always clean up temp file
        if temp_path and os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
                logger.debug(f"Cleaned up temp file: {temp_path}")
            except OSError as e:
                logger.warning(f"Failed to clean up temp file: {e}")


# ---- Pydantic Models ----

class YouTubeTranscribeRequest(BaseModel):
    """Request body for YouTube transcription."""
    url: str


@app.post("/transcribe_youtube")
async def transcribe_youtube(request: YouTubeTranscribeRequest):
    """
    Stream audio directly from a YouTube video and transcribe it.
    No files are downloaded to disk — zero disk usage.

    Flow:
    1. Validate YouTube URL format
    2. Extract direct audio stream URL via yt-dlp (no download)
    3. Pass stream URL to Whisper — FFmpeg reads it on-the-fly
    4. Return transcription result with video metadata

    Args:
        request: JSON body with "url" field containing YouTube URL

    Returns:
        JSON with transcription text, language, confidence,
        duration, segments, and video metadata
    """
    url = request.url.strip()
    logger.info(f"🎬 YouTube stream transcription request: {url}")

    # Step 1: Validate URL format
    if not youtube_downloader.validate_url(url):
        raise HTTPException(
            status_code=400,
            detail="Invalid YouTube URL. Please provide a valid YouTube video link "
                   "(e.g., https://youtube.com/watch?v=... or https://youtu.be/...)"
        )

    try:
        # Step 2: Extract direct audio stream URL (no file download)
        # yt-dlp resolves the CDN URL; nothing is written to disk
        stream_url, video_info = youtube_downloader.get_stream_info(url)

        # Step 3: Transcribe by passing the stream URL directly to Whisper
        # faster-whisper uses FFmpeg internally, which can read from URLs
        logger.info("🎙️ Starting transcription from audio stream (no disk write)...")
        start_time = time.time()
        result = whisper_service.transcribe(stream_url)
        elapsed = time.time() - start_time

        logger.info(
            f"✅ YouTube stream transcription completed in {elapsed:.2f}s | "
            f"Video: \"{video_info['title']}\""
        )

        # Enrich result with YouTube metadata
        result["youtube"] = {
            "title": video_info["title"],
            "uploader": video_info["uploader"],
            "video_duration": video_info["duration"],
            "url": url,
        }

        return result

    except YouTubeDownloadError as e:
        logger.error(f"YouTube stream extraction failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except RuntimeError as e:
        logger.error(f"Runtime error: {e}")
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"YouTube transcription failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"YouTube transcription failed: {str(e)}",
        )
    # No finally/cleanup needed — no temp files were created


@app.get("/health")
async def health_check():
    """
    Health check endpoint.
    Returns service status and model information.
    Used by the Express backend to verify this service is running.
    """
    return {
        "status": "ok",
        "service": "whisper-service",
        "model_loaded": whisper_service.is_loaded,
        "model_size": settings.whisper_model_size,
        "device": settings.whisper_device,
        "compute_type": settings.whisper_compute_type,
    }


# ============================================
# Run with Uvicorn (for local development)
# ============================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.whisper_host,
        port=settings.whisper_port,
        reload=True,
        log_level=settings.log_level,
    )
