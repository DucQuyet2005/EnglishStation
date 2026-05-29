"""
YouTube Audio Downloader Service
Downloads audio from YouTube videos using yt-dlp.

Flow:
1. Validates the YouTube URL
2. Extracts video info (title, duration)
3. Downloads audio in best quality as mp3
4. Returns the path to the downloaded audio file

Security:
- Files are saved to /tmp/youtube_audio with unique names
- Files must be cleaned up by the caller after processing
- Duration is checked before downloading to prevent abuse
"""
import os
import re
import uuid
import logging
from pathlib import Path
from typing import Optional

import yt_dlp

from app.config import settings

logger = logging.getLogger(__name__)

# Directory for temporary YouTube audio files
YOUTUBE_TEMP_DIR = "/tmp/youtube_audio"

# YouTube URL patterns
YOUTUBE_URL_PATTERNS = [
    r"(?:https?://)?(?:www\.)?youtube\.com/watch\?v=[\w-]+",
    r"(?:https?://)?(?:www\.)?youtu\.be/[\w-]+",
    r"(?:https?://)?(?:www\.)?youtube\.com/shorts/[\w-]+",
    r"(?:https?://)?(?:m\.)?youtube\.com/watch\?v=[\w-]+",
]


class YouTubeDownloadError(Exception):
    """Raised when YouTube download fails."""
    pass


class YouTubeDownloader:
    """
    Downloads audio from YouTube videos using yt-dlp.
    Designed to work with the Whisper transcription pipeline.
    """

    def __init__(self):
        # Ensure temp directory exists
        os.makedirs(YOUTUBE_TEMP_DIR, exist_ok=True)

    @staticmethod
    def validate_url(url: str) -> bool:
        """Check if the URL is a valid YouTube URL."""
        if not url or not isinstance(url, str):
            return False
        return any(re.match(pattern, url.strip()) for pattern in YOUTUBE_URL_PATTERNS)

    def get_video_info(self, url: str) -> dict:
        """
        Extract video metadata without downloading.

        Returns:
            dict with title, duration (seconds), uploader, etc.

        Raises:
            YouTubeDownloadError: If extraction fails
        """
        ydl_opts = {
            "quiet": True,
            "no_warnings": True,
            "extract_flat": False,
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                if info is None:
                    raise YouTubeDownloadError("Could not extract video info")

                return {
                    "title": info.get("title", "Unknown"),
                    "duration": info.get("duration", 0),
                    "uploader": info.get("uploader", "Unknown"),
                    "view_count": info.get("view_count", 0),
                }
        except yt_dlp.utils.DownloadError as e:
            logger.error(f"yt-dlp extraction error: {e}")
            raise YouTubeDownloadError(
                f"Failed to get video info. The video may be private, "
                f"unavailable, or the URL is invalid."
            )
        except Exception as e:
            logger.error(f"Unexpected error getting video info: {e}")
            raise YouTubeDownloadError(f"Failed to process YouTube URL: {str(e)}")

    def download_audio(self, url: str) -> tuple[str, dict]:
        """
        Download audio from a YouTube video.

        Flow:
        1. Validate URL format
        2. Get video info and check duration
        3. Download audio in best quality
        4. Convert to mp3 using ffmpeg

        Args:
            url: YouTube video URL

        Returns:
            Tuple of (audio_file_path, video_info_dict)

        Raises:
            YouTubeDownloadError: If download or validation fails
        """
        url = url.strip()

        # Step 1: Validate URL
        if not self.validate_url(url):
            raise YouTubeDownloadError(
                "Invalid YouTube URL. Please provide a valid YouTube video link."
            )

        # Step 2: Get video info and check duration
        logger.info(f"📋 Extracting video info: {url}")
        video_info = self.get_video_info(url)
        duration = video_info.get("duration", 0)

        if duration and duration > settings.max_youtube_duration:
            raise YouTubeDownloadError(
                f"Video is too long ({duration}s). "
                f"Maximum allowed duration is {settings.max_youtube_duration}s "
                f"({settings.max_youtube_duration // 60} minutes)."
            )

        logger.info(
            f"📹 Video: \"{video_info['title']}\" | "
            f"Duration: {duration}s | "
            f"Uploader: {video_info['uploader']}"
        )

        # Step 3: Download audio
        unique_id = uuid.uuid4().hex[:12]
        output_path = os.path.join(YOUTUBE_TEMP_DIR, f"yt_{unique_id}")

        ydl_opts = {
            "format": "bestaudio/best",
            "outtmpl": output_path + ".%(ext)s",
            "postprocessors": [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": "192",
                }
            ],
            # This line can be deleted after setup ---chu y duong dan den ffmpeg tren may cua ban
            "ffmpeg_location": r"C:\Users\Quyet\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg.Essentials_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-essentials_build\bin",
            "quiet": True,
            "no_warnings": True,
            "noplaylist": True,  # Don't download playlists
        }

        try:
            logger.info("⬇️ Downloading audio from YouTube...")
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])

            # The output file will have .mp3 extension after postprocessing
            audio_path = output_path + ".mp3"

            if not os.path.exists(audio_path):
                # Sometimes yt-dlp might use a different extension
                # Check for other common extensions
                for ext in [".mp3", ".m4a", ".webm", ".opus", ".wav"]:
                    candidate = output_path + ext
                    if os.path.exists(candidate):
                        audio_path = candidate
                        break
                else:
                    raise YouTubeDownloadError(
                        "Download completed but audio file not found. "
                        "The video may not have an audio track."
                    )

            file_size = os.path.getsize(audio_path)
            logger.info(
                f"✅ Audio downloaded: {audio_path} "
                f"({file_size / 1024 / 1024:.1f}MB)"
            )

            return audio_path, video_info

        except yt_dlp.utils.DownloadError as e:
            logger.error(f"yt-dlp download error: {e}")
            raise YouTubeDownloadError(
                "Failed to download audio. The video may be restricted, "
                "age-gated, or unavailable in this region."
            )
        except YouTubeDownloadError:
            raise
        except Exception as e:
            logger.error(f"Unexpected download error: {e}", exc_info=True)
            raise YouTubeDownloadError(f"Failed to download audio: {str(e)}")

    @staticmethod
    def cleanup(file_path: str) -> None:
        """Remove a temporary audio file."""
        try:
            if file_path and os.path.exists(file_path):
                os.unlink(file_path)
                logger.debug(f"Cleaned up YouTube audio: {file_path}")
        except OSError as e:
            logger.warning(f"Failed to cleanup YouTube audio: {e}")


# Singleton instance
youtube_downloader = YouTubeDownloader()
