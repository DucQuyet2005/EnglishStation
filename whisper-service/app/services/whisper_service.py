"""
Whisper Transcription Service
Core service that manages the faster-whisper model lifecycle
and performs audio transcription.

Model Lifecycle:
- Model is loaded ONCE at application startup (in main.py lifespan)
- Model stays in memory for the entire application lifetime
- This avoids reloading the model per request (which would be very slow)

Why faster-whisper?
- 4x faster than OpenAI's original whisper
- Uses CTranslate2 for optimized inference
- Lower memory usage (especially with int8 quantization)
- Same accuracy as original whisper
- Free and runs locally (no API costs)
"""
import logging
import time
from pathlib import Path
from typing import Optional

from faster_whisper import WhisperModel

from app.config import settings

logger = logging.getLogger(__name__)


class WhisperService:
    """
    Manages the Whisper model instance and transcription operations.
    Designed as a singleton - only one model loaded in memory.
    """

    def __init__(self):
        self._model: Optional[WhisperModel] = None
        self._model_loaded = False

    @property
    def is_loaded(self) -> bool:
        return self._model_loaded

    def load_model(self) -> None:
        """
        Load the Whisper model into memory.
        Called once during application startup.

        Model sizes and their characteristics:
        - tiny:  ~39M params, fastest, lowest accuracy
        - base:  ~74M params, good balance for learning apps
        - small: ~244M params, better accuracy, slower
        - medium: ~769M params, high accuracy
        - large: ~1550M params, highest accuracy, needs GPU
        """
        logger.info(
            f"Loading Whisper model: {settings.whisper_model_size} "
            f"(device={settings.whisper_device}, "
            f"compute_type={settings.whisper_compute_type})"
        )

        start_time = time.time()

        self._model = WhisperModel(
            settings.whisper_model_size,
            device=settings.whisper_device,
            compute_type=settings.whisper_compute_type,
        )

        load_time = time.time() - start_time
        self._model_loaded = True

        logger.info(f"✅ Whisper model loaded in {load_time:.2f}s")

    def unload_model(self) -> None:
        """Release the model from memory."""
        if self._model:
            del self._model
            self._model = None
            self._model_loaded = False
            logger.info("Whisper model unloaded")

    def transcribe(self, audio_path: str) -> dict:
        """
        Transcribe an audio file using the loaded Whisper model.

        Args:
            audio_path: Path to the audio file on disk

        Returns:
            dict with transcription results including:
            - text: Full transcription text
            - language: Detected language code
            - language_probability: Confidence of language detection
            - duration: Audio duration in seconds
            - segments: List of timed text segments

        Raises:
            RuntimeError: If model is not loaded
            Exception: If transcription fails
        """
        if not self._model:
            raise RuntimeError("Whisper model is not loaded")

        file_path = Path(audio_path)
        if not file_path.exists():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        logger.info(f"Starting transcription: {file_path.name}")
        start_time = time.time()

        # Perform transcription
        # beam_size=5 provides good accuracy/speed balance
        # vad_filter=True filters out non-speech segments
        segments_generator, info = self._model.transcribe(
            audio_path,
            beam_size=5,
            language=None,  # Auto-detect language
            vad_filter=True,  # Voice Activity Detection
            vad_parameters=dict(
                min_silence_duration_ms=500,
            ),
        )

        # Collect all segments (generator must be consumed)
        segments = []
        full_text_parts = []

        for segment in segments_generator:
            segments.append({
                "id": segment.id,
                "start": round(segment.start, 2),
                "end": round(segment.end, 2),
                "text": segment.text.strip(),
                "avg_logprob": round(segment.avg_logprob, 4),
                "no_speech_prob": round(segment.no_speech_prob, 4),
            })
            full_text_parts.append(segment.text.strip())

        elapsed = time.time() - start_time
        full_text = " ".join(full_text_parts)

        logger.info(
            f"Transcription completed in {elapsed:.2f}s | "
            f"Language: {info.language} ({info.language_probability:.2%}) | "
            f"Duration: {info.duration:.1f}s | "
            f"Text length: {len(full_text)} chars"
        )

        return {
            "text": full_text,
            "language": info.language,
            "language_probability": round(info.language_probability, 4),
            "duration": round(info.duration, 2),
            "segments": segments,
        }


# Singleton instance used across the application
whisper_service = WhisperService()
