"""
Whisper Service Configuration
Centralized settings using Pydantic for type safety and validation.
All configuration is loaded from environment variables.
"""
from pydantic_settings import BaseSettings
from typing import Literal


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Whisper Model Configuration
    whisper_model_size: str = "base"
    whisper_device: Literal["cpu", "cuda", "auto"] = "cpu"
    whisper_compute_type: str = "int8"

    # Server Configuration
    whisper_host: str = "0.0.0.0"
    whisper_port: int = 8000

    # Audio Constraints
    max_audio_duration: int = 120  # seconds
    max_youtube_duration: int = 600  # 10 minutes max for YouTube videos

    # Logging
    log_level: str = "info"

    # Supported audio extensions
    allowed_extensions: list[str] = [
        ".wav", ".mp3", ".ogg", ".webm",
        ".flac", ".m4a", ".aac", ".mp4",
    ]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


# Singleton settings instance
settings = Settings()
