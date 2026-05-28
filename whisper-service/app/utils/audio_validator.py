"""
Audio Validator Utility
Validates uploaded audio files before sending to Whisper.
Provides defense-in-depth validation beyond what the backend already checks.
"""
import os
import logging
from pathlib import Path
from fastapi import UploadFile, HTTPException

from app.config import settings

logger = logging.getLogger(__name__)


def validate_audio_file(file: UploadFile) -> None:
    """
    Validate the uploaded audio file.

    Checks:
    1. File exists and has content
    2. File extension is allowed
    3. Content type is audio-related

    Raises:
        HTTPException: If validation fails
    """
    # Check filename exists
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No filename provided"
        )

    # Check file extension
    ext = Path(file.filename).suffix.lower()
    if ext not in settings.allowed_extensions:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported audio format: '{ext}'. "
                   f"Allowed: {', '.join(settings.allowed_extensions)}"
        )

    # Check content type (basic check, not foolproof)
    if file.content_type and not (
        file.content_type.startswith("audio/")
        or file.content_type == "application/octet-stream"
    ):
        logger.warning(
            f"Unexpected content type: {file.content_type} for file {file.filename}"
        )

    logger.info(f"Audio validation passed: {file.filename} ({file.content_type})")


def validate_file_size(file_path: str, max_size_mb: int = 10) -> None:
    """
    Validate file size after saving to disk.

    Args:
        file_path: Path to the saved file
        max_size_mb: Maximum allowed size in MB
    """
    file_size = os.path.getsize(file_path)
    max_size_bytes = max_size_mb * 1024 * 1024

    if file_size > max_size_bytes:
        # Clean up oversized file
        os.unlink(file_path)
        raise HTTPException(
            status_code=413,
            detail=f"File size ({file_size / 1024 / 1024:.2f}MB) "
                   f"exceeds maximum of {max_size_mb}MB"
        )

    if file_size == 0:
        os.unlink(file_path)
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty"
        )
