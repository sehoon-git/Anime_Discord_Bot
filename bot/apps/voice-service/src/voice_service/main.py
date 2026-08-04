from __future__ import annotations

from fastapi import FastAPI, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response
from pydantic import BaseModel, Field

from .runtime import ModelUnavailableError, SpeechRequest, VoiceRuntime
from .settings import Settings

app = FastAPI(title="Discord Anime AI Voice Service", version="0.1.0")
runtime = VoiceRuntime(Settings.from_environment())


class VoiceProfilePayload(BaseModel):
    id: str = Field(min_length=1, max_length=120)
    version: int = Field(ge=1)
    provider: str
    language: str
    settings: dict[str, str | int | float | bool] = Field(default_factory=dict)
    status: str


class SpeechPayload(BaseModel):
    text: str = Field(min_length=1, max_length=4_000)
    voiceProfile: VoiceProfilePayload


@app.get("/health")
async def health() -> dict[str, object]:
    return {"status": "ok", "loadedModels": runtime.loaded_models()}


@app.post("/v1/transcriptions")
async def transcriptions(request: Request) -> dict[str, object]:
    content_type = request.headers.get("content-type", "").lower()
    expected = "audio/l16;rate=48000;channels=2"
    if expected not in content_type:
        raise HTTPException(status_code=415, detail=f"Content-Type은 {expected}여야 합니다.")

    pcm = await request.body()
    try:
        text, confidence = await run_in_threadpool(runtime.transcribe_pcm, pcm)
    except ModelUnavailableError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except Exception as error:  # 모델 내부 오류는 원본 오디오를 로그에 남기지 않는다.
        raise HTTPException(status_code=502, detail="음성 인식에 실패했습니다.") from error

    return {"text": text, "confidence": confidence}


@app.post("/v1/speech")
async def speech(payload: SpeechPayload) -> Response:
    profile = payload.voiceProfile
    try:
        ogg_opus = await run_in_threadpool(
            runtime.synthesize_ogg_opus,
            SpeechRequest(
                text=payload.text,
                profile_id=profile.id,
                provider=profile.provider,
                language=profile.language,
                settings=profile.settings,
            ),
        )
    except ModelUnavailableError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except Exception as error:  # 생성 텍스트/보이스 설정 외 원본 오디오는 이 경로에 없다.
        raise HTTPException(status_code=502, detail="음성 합성에 실패했습니다.") from error

    return Response(content=ogg_opus, media_type="audio/ogg; codecs=opus")
