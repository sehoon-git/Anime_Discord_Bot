from __future__ import annotations

from dataclasses import dataclass
import os


@dataclass(frozen=True)
class Settings:
    whisper_model: str
    whisper_device: str
    whisper_compute_type: str
    max_pcm_bytes: int
    ffmpeg_bin: str
    gemini_api_key: str | None

    @classmethod
    def from_environment(cls) -> "Settings":
        return cls(
            whisper_model=os.getenv("WHISPER_MODEL", "tiny"),
            whisper_device=os.getenv("WHISPER_DEVICE", "cpu"),
            whisper_compute_type=os.getenv("WHISPER_COMPUTE_TYPE", "int8"),
            max_pcm_bytes=int(os.getenv("MAX_PCM_BYTES", str(12 * 1024 * 1024))),
            ffmpeg_bin=os.getenv("FFMPEG_BIN", "ffmpeg"),
            gemini_api_key=os.getenv("GEMINI_API_KEY"),
        )
