# 개발자 B: Discord 봇·음성 워커 연동 계약

## 담당 범위

- `apps/discord-bot`: Slash Command, 봇 멘션, DM, Discord 응답
- `apps/voice-worker`: Voice Channel 연결, 메모리 내 Opus→PCM 변환, STT/TTS HTTP 호출, Ogg Opus 재생
- `packages/contracts`: 개발자 A와 공유하는 대화·보이스 타입

봇과 음성 워커는 Gemini API, 프롬프트, PostgreSQL, 장기기억에 직접 접근하지 않는다. 개발자 A가 제공하는 Conversation API만 사용한다.

## 실행 준비

1. 루트의 `.env.example`을 `.env`로 복사하고 Discord Developer Portal 값과 내부 서비스 주소를 설정한다.
2. Discord Developer Portal에서 **Message Content Intent**를 켠다. 멘션 이외의 메시지는 봇이 읽지 않는다.
3. 개발 서버를 지정하려면 `DISCORD_GUILD_ID`를 설정한 뒤 `npm run register:commands`를 실행한다.
4. `npm run dev:bot`으로 봇을 시작한다.

`BOT_DEV_ECHO_MODE=true`는 Conversation API가 준비되기 전 텍스트 명령만 확인하기 위한 모드다. 실제 서버에서는 반드시 `false`로 둔다. 이 모드는 실제 음성 동의를 대체하지 않는다.

## Conversation API 계약 (개발자 A 구현)

기본 주소는 `BOT_API_BASE_URL`이며, 모든 JSON 본문은 UTF-8이다.

| 메서드·경로 | 요청 | 응답 |
| --- | --- | --- |
| `POST /v1/discord/turns` | `TurnEnvelope` | `{ conversationId, text, voiceProfile? }` |
| `PUT /v1/discord/character-selections` | `CharacterSelection` | `204 No Content` |
| `PUT /v1/discord/memory-consents` | `{ guildId?, userId, enabled }` | `204 No Content` |
| `GET /v1/discord/memories?userId=&guildId=` | 사용자 범위 | `MemorySummary[]` |
| `DELETE /v1/discord/memories` | `{ guildId?, userId }` | `204 No Content` |
| `PUT /v1/discord/voice-consents` | `{ guildId, channelId, userId, enabled }` | `204 No Content` |
| `POST /v1/discord/voice-consents/check` | `{ guildId, channelId, userId }` | `{ allowed: boolean }` |

음성 워커는 `allowed: true`가 아니면 해당 사용자의 Opus 스트림을 구독하지 않는다. API 오류도 동의하지 않은 것으로 처리한다.

## 음성 서비스 계약

기본 주소는 `VOICE_SERVICE_BASE_URL`이다. 서비스는 Python 구현으로 교체 가능하며, 다음 HTTP 경계만 지킨다.

| 메서드·경로 | 요청 | 응답 |
| --- | --- | --- |
| `POST /v1/transcriptions` | 48kHz, 2채널, 16-bit little-endian PCM 본문. `x-guild-id`, `x-channel-id`, `x-user-id` 헤더 | `{ text, confidence? }` |
| `POST /v1/speech` | `{ text, voiceProfile }` | `Content-Type: audio/ogg; codecs=opus` 오디오 스트림 |

음성 서비스는 원본 오디오 파일을 디스크나 객체 저장소에 쓰지 않는다. Discord 재생을 위한 Ogg Opus 인코딩은 음성 서비스에서 수행한다.

## 음성 처리 정책

- `/voice join`은 사용자가 현재 입장한 채널에서만 실행된다.
- `/voice consent enabled:true|false`로 현재 채널의 개별 동의를 저장한다.
- 서버당 음성 세션은 한 개이며, 한 번에 한 명의 발화만 처리한다.
- 새 발화가 시작되면 진행 중 STT/TTS 요청과 재생 중 TTS를 취소한다.
- `/voice leave`는 연결과 재생을 종료한다.
