"""
YouTube Audio Stream Service
Extracts direct audio stream URLs from YouTube videos using yt-dlp.

Flow:
1. Validates the YouTube URL
2. Extracts video info (title, duration) and direct audio stream URL
3. Returns the stream URL — NO file is downloaded to disk
4. Whisper reads audio directly from the stream URL via FFmpeg

Why streaming instead of downloading?
- Zero disk usage: No temp files are created on the server
- Faster startup: No waiting for the full download to complete before transcription
- Simpler cleanup: Nothing to delete after processing

Security:
- Duration is checked before streaming to prevent abuse
- URL is validated against known YouTube patterns
"""
import re
import logging
from typing import Optional

import yt_dlp

from app.config import settings

logger = logging.getLogger(__name__)

# YouTube URL patterns
YOUTUBE_URL_PATTERNS = [
    r"(?:https?://)?(?:www\.)?youtube\.com/watch\?v=[\w-]+",
    r"(?:https?://)?(?:www\.)?youtu\.be/[\w-]+",
    r"(?:https?://)?(?:www\.)?youtube\.com/shorts/[\w-]+",
    r"(?:https?://)?(?:m\.)?youtube\.com/watch\?v=[\w-]+",
]


class YouTubeDownloadError(Exception):
    """Raised when YouTube stream extraction fails."""
    pass


class YouTubeDownloader:
    """
    Extracts direct audio stream URLs from YouTube videos using yt-dlp.
    No files are downloaded to disk — the stream URL is passed directly
    to Whisper which reads it via FFmpeg.
    """

    @staticmethod
    def validate_url(url: str) -> bool:
        """Check if the URL is a valid YouTube URL."""
        if not url or not isinstance(url, str):
            return False
        return any(re.match(pattern, url.strip()) for pattern in YOUTUBE_URL_PATTERNS)

    def get_stream_info(self, url: str) -> tuple[str, dict]:
        """
        Extract the direct audio stream URL and video metadata from YouTube.
        NO file is downloaded — only metadata and the CDN link are retrieved.

        Flow:
        1. Validate URL format
        2. Use yt-dlp to extract info (including direct stream URLs)
        3. Check video duration against the configured maximum
        4. Return the best audio stream URL and video metadata

        Args:
            url: YouTube video URL

        Returns:
            Tuple of (audio_stream_url, video_info_dict)

        Raises:
            YouTubeDownloadError: If extraction or validation fails
        """
        url = url.strip()

        # Step 1: Validate URL
        if not self.validate_url(url):
            raise YouTubeDownloadError(
                "Invalid YouTube URL. Please provide a valid YouTube video link."
            )

        # Step 2: Extract info WITHOUT downloading
        # yt-dlp resolves the best audio format and gives us the direct CDN URL
        ydl_opts = {
            "format": "bestaudio/best",
            "quiet": True,
            "no_warnings": True,
            "noplaylist": True,
            # Do NOT download — only extract info and stream URLs
        }

        try:
            logger.info(f"📋 Extracting stream info: {url}")

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)

                if info is None:
                    raise YouTubeDownloadError("Could not extract video info")

                # Step 3: Check duration
                duration = info.get("duration", 0)
                if duration and duration > settings.max_youtube_duration:
                    raise YouTubeDownloadError(
                        f"Video is too long ({duration}s). "
                        f"Maximum allowed duration is {settings.max_youtube_duration}s "
                        f"({settings.max_youtube_duration // 60} minutes)."
                    )

                # Step 4: Get the direct audio stream URL
                # When format="bestaudio/best", yt-dlp selects the best audio-only
                # stream and puts its direct CDN URL in info["url"]
                stream_url = info.get("url")
                if not stream_url:
                    raise YouTubeDownloadError(
                        "Could not extract audio stream URL. "
                        "The video may be restricted or unavailable."
                    )

                video_info = {
                    "title": info.get("title", "Unknown"),
                    "duration": duration,
                    "uploader": info.get("uploader", "Unknown"),
                    "view_count": info.get("view_count", 0),
                }

                logger.info(
                    f"📹 Video: \"{video_info['title']}\" | "
                    f"Duration: {duration}s | "
                    f"Uploader: {video_info['uploader']}"
                )
                logger.info(
                    f"🔗 Audio stream URL extracted (no file downloaded to disk)"
                )

                return stream_url, video_info

        except yt_dlp.utils.DownloadError as e:
            logger.error(f"yt-dlp extraction error: {e}")
            raise YouTubeDownloadError(
                f"Failed to extract video info. The video may be private, "
                f"unavailable, or the URL is invalid."
            )
        except YouTubeDownloadError:
            raise
        except Exception as e:
            logger.error(f"Unexpected error extracting stream info: {e}", exc_info=True)
            raise YouTubeDownloadError(f"Failed to process YouTube URL: {str(e)}")


# Singleton instance
youtube_downloader = YouTubeDownloader()
