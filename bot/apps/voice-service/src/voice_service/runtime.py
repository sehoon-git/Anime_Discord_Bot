from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
import os
from pathlib import Path
import subprocess
import tempfile
from threading import Lock
from typing import Any

import numpy as np
import soundfile as sf

from .settings import Settings

PCM_SAMPLE_RATE = 48_000
PCM_CHANNELS = 2
PCM_SAMPLE_WIDTH_BYTES = 2


class ModelUnavailableError(RuntimeError):
    """선택한 로컬 음성 모델이 설치 또는 초기화되지 않았을 때 발생한다."""


@dataclass(frozen=True)
class SpeechRequest:
    text: str
    profile_id: str
    provider: str
    language: str
    settings: dict[str, str | int | float | bool]


class VoiceRuntime:
    """모델을 지연 로드하고, 입력/출력 오디오는 요청 수명 안에서만 유지한다."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self._lock = Lock()
        self._whisper: Any | None = None
        self._kokoro: Any | None = None
        self._melo: Any | None = None

    def transcribe_pcm(self, pcm: bytes) -> tuple[str, float | None]:
        mono_audio = pcm_to_mono_float32(pcm, self.settings.max_pcm_bytes)
        model = self._get_whisper()
        segments, info = model.transcribe(
            mono_audio,
            beam_size=5,
            vad_filter=True,
            language=None,
            condition_on_previous_text=False,
        )
        # faster-whisper의 segments는 generator이므로 여기서 끝까지 소비해야 실제 추론이 끝난다.
        text = "".join(segment.text for segment in segments).strip()
        return text, getattr(info, "language_probability", None)

    def synthesize_ogg_opus(self, request: SpeechRequest) -> bytes:
        if request.provider == "kokoro":
            samples, sample_rate = self._synthesize_kokoro(request)
        elif request.provider == "melotts":
            samples, sample_rate = self._synthesize_melo(request)
        else:
            raise ValueError(f"지원하지 않는 음성 제공자입니다: {request.provider}")
        return encode_ogg_opus(samples, sample_rate, self.settings.ffmpeg_bin)

    def loaded_models(self) -> dict[str, bool]:
        return {
            "faster_whisper": self._whisper is not None,
            "kokoro": self._kokoro is not None,
            "melotts": self._melo is not None,
        }

    def _get_whisper(self) -> Any:
        with self._lock:
            if self._whisper is not None:
                return self._whisper
            try:
                from faster_whisper import WhisperModel
            except ImportError as error:
                raise ModelUnavailableError("faster-whisper가 설치되지 않았습니다. pip install -e '.[models]'를 실행하세요.") from error
            self._whisper = WhisperModel(
                self.settings.whisper_model,
                device=self.settings.whisper_device,
                compute_type=self.settings.whisper_compute_type,
            )
            return self._whisper

    def _synthesize_kokoro(self, request: SpeechRequest) -> tuple[np.ndarray, int]:
        if request.language != "en-US":
            raise ValueError("Kokoro MVP 제공자는 en-US 보이스 프로필만 지원합니다.")
        with self._lock:
            if self._kokoro is None:
                try:
                    from kokoro import KPipeline
                except ImportError as error:
                    raise ModelUnavailableError("Kokoro가 설치되지 않았습니다. pip install -e '.[models]'를 실행하세요.") from error
                self._kokoro = KPipeline(lang_code="a")
            pipeline = self._kokoro

        voice = string_setting(request.settings, "voice", "af_heart")
        speed = numeric_setting(request.settings, "speed", 0.95)
        pieces = [audio for _, _, audio in pipeline(request.text, voice=voice, speed=speed)]
        if not pieces:
            raise ValueError("Kokoro가 합성 오디오를 생성하지 못했습니다.")
        return np.concatenate(pieces).astype(np.float32), 24_000

    def _synthesize_melo(self, request: SpeechRequest) -> tuple[np.ndarray, int]:
        if request.language != "ko":
            raise ValueError("MeloTTS MVP 제공자는 한국어 보이스 프로필만 지원합니다.")
        with self._lock:
            if self._melo is None:
                try:
                    from melo.api import TTS
                except ImportError as error:
                    raise ModelUnavailableError("MeloTTS가 설치되지 않았습니다. pip install -e '.[models]'를 실행하세요.") from error
                self._melo = TTS(language="KR", device="auto")
            model = self._melo

        speed = numeric_setting(request.settings, "speed", 1.0)
        speaker_ids = model.hps.data.spk2id
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temporary_file:
            output_path = Path(temporary_file.name)
        try:
            model.tts_to_file(request.text, speaker_ids["KR"], str(output_path), speed=speed)
            samples, sample_rate = sf.read(output_path, dtype="float32", always_2d=False)
            return np.asarray(samples, dtype=np.float32), int(sample_rate)
        finally:
            os.unlink(output_path)


def pcm_to_mono_float32(pcm: bytes, max_pcm_bytes: int) -> np.ndarray:
    if not pcm:
        raise ValueError("빈 PCM 오디오는 전사할 수 없습니다.")
    if len(pcm) > max_pcm_bytes:
        raise ValueError("PCM 오디오가 허용된 최대 크기를 넘었습니다.")
    frame_bytes = PCM_CHANNELS * PCM_SAMPLE_WIDTH_BYTES
    if len(pcm) % frame_bytes:
        raise ValueError("PCM 프레임 경계가 올바르지 않습니다.")

    stereo = np.frombuffer(pcm, dtype="<i2").reshape(-1, PCM_CHANNELS)
    return stereo.mean(axis=1, dtype=np.float32) / np.float32(32768.0)


def encode_ogg_opus(samples: np.ndarray, sample_rate: int, ffmpeg_bin: str) -> bytes:
    wav_buffer = BytesIO()
    sf.write(wav_buffer, samples, sample_rate, format="WAV", subtype="PCM_16")
    try:
        result = subprocess.run(
            [
                ffmpeg_bin,
                "-hide_banner",
                "-loglevel",
                "error",
                "-i",
                "pipe:0",
                "-c:a",
                "libopus",
                "-ar",
                "48000",
                "-f",
                "ogg",
                "pipe:1",
            ],
            input=wav_buffer.getvalue(),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )
    except FileNotFoundError as error:
        raise ModelUnavailableError("ffmpeg가 PATH에 없습니다. Ogg Opus 출력을 위해 ffmpeg를 설치하세요.") from error
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg Ogg Opus 인코딩 실패: {result.stderr.decode('utf-8', errors='replace')}")
    return result.stdout


def string_setting(settings: dict[str, str | int | float | bool], key: str, default: str) -> str:
    value = settings.get(key, default)
    return value if isinstance(value, str) else default


def numeric_setting(settings: dict[str, str | int | float | bool], key: str, default: float) -> float:
    value = settings.get(key, default)
    if isinstance(value, bool):
        return default
    if isinstance(value, (int, float)):
        return float(value)
    return default
