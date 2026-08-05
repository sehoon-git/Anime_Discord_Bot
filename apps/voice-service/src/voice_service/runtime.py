from __future__ import annotations

from dataclasses import dataclass
import base64
from io import BytesIO
import json
import os
from pathlib import Path
import subprocess
import tempfile
from threading import Lock
from typing import Any, Iterator
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

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
        self._whisper_inference_lock = Lock()
        self._gemini_tts_lock = Lock()
        self._whisper: Any | None = None
        self._kokoro: Any | None = None
        self._melo: Any | None = None

    def transcribe_pcm(self, pcm: bytes) -> tuple[str, float | None]:
        mono_audio = pcm_to_mono_float32(pcm, self.settings.max_pcm_bytes)
        model = self._get_whisper()
        # CPU inference is serialized because both faster-whisper and the fallback
        # Whisper runtime are not safe to use concurrently in this process.
        with self._whisper_inference_lock:
            if model.__class__.__module__.startswith("faster_whisper"):
                segments, _ = model.transcribe(
                    mono_audio,
                    language="ko",
                    beam_size=1,
                    best_of=1,
                    temperature=0,
                    condition_on_previous_text=False,
                    vad_filter=False,
                )
                return "".join(segment.text for segment in segments).strip(), None
            result = model.transcribe(mono_audio, language=None, fp16=False, verbose=False)
        return str(result.get("text", "")).strip(), None
    def synthesize_ogg_opus(self, request: SpeechRequest) -> bytes:
        if request.provider == "kokoro":
            samples, sample_rate = self._synthesize_kokoro(request)
        elif request.provider == "melotts":
            samples, sample_rate = self._synthesize_melo(request)
        elif request.provider == "gemini":
            samples, sample_rate = self._synthesize_gemini(request)
        else:
            raise ValueError(f"Unsupported voice provider: {request.provider}")
        return encode_ogg_opus(samples, sample_rate, self.settings.ffmpeg_bin)

    def synthesize_pcm_stream(self, request: SpeechRequest) -> Iterator[bytes]:
        """Yield 48 kHz stereo signed-16 PCM as each TTS phrase becomes ready."""
        if request.provider == "gemini":
            try:
                for samples in self._synthesize_gemini_stream(request):
                    yield samples_to_pcm_48k_stereo(samples, 24_000)
            except RuntimeError as error:
                if "returned no audio stream" not in str(error):
                    raise
                fallback = SpeechRequest(
                    text=request.text,
                    profile_id=f"{request.profile_id}-fallback",
                    provider="kokoro",
                    language="en-US",
                    settings={"voice": "af_sarah", "speed": 0.97},
                )
                for pcm in self.synthesize_pcm_stream(fallback):
                    yield pcm
            return
        if request.provider != "kokoro":
            samples, sample_rate = self._synthesize_melo(request)
            yield samples_to_pcm_48k_stereo(samples, sample_rate)
            return
        if request.language != "en-US":
            raise ValueError("Kokoro streaming currently supports en-US profiles only.")
        with self._lock:
            if self._kokoro is None:
                try:
                    from kokoro import KPipeline
                except ImportError as error:
                    raise ModelUnavailableError("Kokoro is not installed. Run pip install -e '.[models]'.") from error
                self._kokoro = KPipeline(lang_code="a")
            pipeline = self._kokoro
        voice = string_setting(request.settings, "voice", "af_heart")
        speed = numeric_setting(request.settings, "speed", 0.95)
        emitted = False
        for _, _, audio in pipeline(request.text, voice=voice, speed=speed):
            pcm = samples_to_pcm_48k_stereo(np.asarray(audio, dtype=np.float32), 24_000)
            if pcm:
                emitted = True
                yield pcm
        if not emitted:
            raise ValueError("Kokoro did not generate speech audio.")
    def loaded_models(self) -> dict[str, bool]:
        return {
            "faster_whisper": self._whisper is not None,
            "kokoro": self._kokoro is not None,
            "melotts": self._melo is not None,
            "gemini_tts": bool(self.settings.gemini_api_key),
        }

    def _get_whisper(self) -> Any:
        with self._lock:
            if self._whisper is not None:
                return self._whisper
            try:
                import whisper
            except ImportError as error:
                raise ModelUnavailableError("openai-whisper is required for transcription.") from error
            # The installed faster-whisper native runtime closes this Windows
            # process while loading/inferencing its current model cache. Use the
            # stable CPU Whisper path until that native runtime is repaired.
            self._whisper = whisper.load_model(self.settings.whisper_model, device=self.settings.whisper_device)
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

    def _synthesize_gemini(self, request: SpeechRequest) -> tuple[np.ndarray, int]:
        pieces = list(self._synthesize_gemini_stream(request))
        if not pieces:
            raise RuntimeError("Gemini TTS did not generate speech audio.")
        return np.concatenate(pieces).astype(np.float32), 24_000

    def _synthesize_gemini_stream(self, request: SpeechRequest) -> Iterator[np.ndarray]:
        # The preview Gemini TTS endpoint intermittently rejects overlapping streams.
        # Serialize requests here; the caller still receives each provider chunk as soon
        # as it is generated, but separate sentences cannot race each other.
        with self._gemini_tts_lock:
            for attempt in range(2):
                try:
                    yield from self._synthesize_gemini_stream_locked(request)
                    return
                except RuntimeError as error:
                    if "returned no audio stream" not in str(error) or attempt == 1:
                        raise

    def _synthesize_gemini_stream_locked(self, request: SpeechRequest) -> Iterator[np.ndarray]:
        if request.language not in {"ko", "en-US"}:
            raise ValueError("Gemini TTS supports only ko and en-US voice profiles.")
        api_key = self.settings.gemini_api_key
        if not api_key:
            raise ModelUnavailableError("GEMINI_API_KEY is required for the Gemini TTS voice profile.")

        voice = string_setting(request.settings, "voice", "Sulafat")
        prompt = gemini_tts_prompt(request.language, request.settings, request.text)
        body = json.dumps(
            {
                "model": "gemini-3.1-flash-tts-preview",
                "input": prompt,
                "response_format": {"type": "audio"},
                "generation_config": {"speech_config": [{"voice": voice}]},
                "stream": True,
            }
        ).encode("utf-8")
        http_request = Request(
            "https://generativelanguage.googleapis.com/v1beta/interactions",
            data=body,
            headers={
                "x-goog-api-key": api_key,
                "Content-Type": "application/json",
                "Accept": "text/event-stream",
                "Api-Revision": "2026-05-20",
            },
            method="POST",
        )
        emitted = False
        try:
            with urlopen(http_request, timeout=60) as response:
                for raw_line in response:
                    line = raw_line.decode("utf-8").strip()
                    if not line.startswith("data:"):
                        continue
                    event_data = line[5:].strip()
                    if not event_data or event_data == "[DONE]":
                        continue
                    try:
                        event = json.loads(event_data)
                    except json.JSONDecodeError:
                        continue
                    delta = event.get("delta") or {}
                    if event.get("event_type") != "step.delta" or delta.get("type") != "audio":
                        continue
                    encoded_audio = delta.get("data")
                    if not isinstance(encoded_audio, str) or not encoded_audio:
                        continue
                    pcm = base64.b64decode(encoded_audio)
                    if len(pcm) % 2:
                        raise RuntimeError("Gemini TTS returned malformed PCM audio.")
                    emitted = True
                    yield np.frombuffer(pcm, dtype="<i2").astype(np.float32) / np.float32(32768.0)
        except HTTPError as error:
            detail = error.read(600).decode("utf-8", errors="replace")
            raise RuntimeError(f"Gemini TTS request failed ({error.code}): {detail}") from error
        except URLError as error:
            raise RuntimeError("Gemini TTS could not reach the Gemini API.") from error
        if not emitted:
            raise RuntimeError("Gemini TTS returned no audio stream.")

def gemini_tts_prompt(language: str, settings: dict[str, str | int | float | bool], text: str) -> str:
    language_name = "English" if language == "en-US" else "Korean"
    default_style = (
        "A warm, youthful, emotionally perceptive woman in a private one-to-one voice chat. "
        "Sound genuinely present, never announcer-like. Let the meaning guide subtle changes in pacing and tone. "
        "Keep emotion intimate and believable, never theatrical."
    )
    style = string_setting(settings, "style", default_style)
    return (
        f"Perform the {language_name} transcript exactly as written.\n\n"
        f"PERFORMANCE DIRECTION:\n{style}\n\n"
        "Treat any bracketed delivery cue such as [softly] or [smiles] as a silent performance direction, not words to say aloud. "
        "Do not add words, explanations, or sound effects that are not implied by those cues.\n\n"
        f"TRANSCRIPT:\n{text}"
    )
def samples_to_pcm_48k_stereo(samples: np.ndarray, sample_rate: int) -> bytes:
    mono = np.asarray(samples, dtype=np.float32).reshape(-1)
    if sample_rate <= 0:
        raise ValueError(f"Invalid audio sample rate: {sample_rate}")
    if sample_rate != PCM_SAMPLE_RATE:
        # Kokoro returns 24 kHz and MeloTTS returns 44.1 kHz. Resample either
        # to Discord's required 48 kHz PCM without introducing another runtime dependency.
        target_length = max(1, round(len(mono) * PCM_SAMPLE_RATE / sample_rate))
        source_positions = np.arange(len(mono), dtype=np.float32)
        target_positions = np.linspace(0, max(0, len(mono) - 1), target_length, dtype=np.float32)
        mono = np.interp(target_positions, source_positions, mono).astype(np.float32)
    interleaved = np.repeat(np.clip(mono, -1.0, 1.0), PCM_CHANNELS)
    return np.rint(interleaved * 32767.0).astype("<i2", copy=False).tobytes()

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
