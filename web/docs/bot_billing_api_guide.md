# Discord 봇용 요금제·사용량 API 연동 안내

이 문서는 Discord 봇 개발자(B)가 웹사이트의 사용자 요금제와 월 사용 한도를 안전하게 확인하고 적용하기 위한 안내입니다.

## 1. 먼저 알아둘 점

- 요금제 정보는 웹 서비스의 `web_db`에만 있습니다. 봇의 `bot_DB`에 요금제를 복사하거나 동기화할 필요가 없습니다.
- 봇은 기능을 실행하기 직전에 API를 호출해 **현재 요금제, 현재 한도, 이번 달 사용량**을 확인합니다.
- 사용자가 Free, Like, MoreLike, Love 중 다른 플랜으로 변경하면 다음 API 호출부터 변경된 한도가 반영됩니다.
- 따라서 코드에서 `love` 같은 플랜 이름만 보고 영구적으로 허용하지 말고, API 응답의 한도와 허용 여부를 우선 사용해야 합니다.

기본 주소:

```text
https://anime-discord-bot-rw3b.vercel.app
```

## 2. 인증 방법

모든 봇 전용 API 요청에는 아래 헤더가 반드시 필요합니다.

```http
Authorization: Bearer {BOT_SECRET_KEY}
```

- `{BOT_SECRET_KEY}`는 운영자가 별도로 전달하는 비밀 키입니다.
- 키는 소스 코드, Discord 메시지, GitHub 저장소에 직접 작성하지 말고 봇 서버의 환경 변수에 저장하세요.
- 키가 없거나 틀리면 API는 `401 UNAUTHORIZED_BOT`을 반환합니다.

## 3. 지원하는 플랜과 기본 한도

| 플랜 코드 | 월 텍스트 | 월 음성 | 장기기억 | 월 이미지 생성 |
| --- | ---: | ---: | ---: | ---: |
| `free` | 100회 | 10분 | 5개 | 불가 |
| `like` | 500회 | 60분 | 20개 | 불가 |
| `more-like` | 3,000회 | 180분 | 100개 | 불가 |
| `love` | 10,000회 | 500분 | 500개 | 50장 |

실제 기능 허용 여부는 항상 API 응답을 기준으로 처리하세요. 운영 중 한도가 변경될 수 있습니다.

## 4. 현재 요금제·한도·사용량 조회

기능을 실행하기 전에 다음 API를 호출합니다.

```http
GET /api/bot/billing?discordUserId={Discord_사용자_ID}
Authorization: Bearer {BOT_SECRET_KEY}
```

전체 요청 주소 예시:

```text
GET https://anime-discord-bot-rw3b.vercel.app/api/bot/billing?discordUserId=123456789012345678
```

성공 응답 예시:

```json
{
  "ok": true,
  "userId": "2168",
  "plan": {
    "code": "love",
    "name": "Love♥",
    "monthlyTextMessages": 10000,
    "monthlyVoiceMinutes": 500,
    "memoryEnabled": true,
    "longTermMemoryLimit": 500,
    "imageGenerationEnabled": true,
    "monthlyImageGenerations": 50
  },
  "subscription": {
    "status": "active",
    "currentPeriodStart": "2026-08-01T00:00:00.000Z",
    "currentPeriodEnd": "2026-09-01T00:00:00.000Z"
  },
  "usage": {
    "textMessages": 120,
    "voiceMinutes": 42,
    "creditsUsed": 0,
    "imageGenerations": 3
  },
  "imageGeneration": {
    "enabled": true,
    "monthlyLimit": 50,
    "used": 3,
    "remaining": 47,
    "canGenerate": true
  }
}
```

### 조회 응답을 사용하는 방법

| 기능 | 확인할 값 |
| --- | --- |
| 텍스트 대화 | `usage.textMessages`와 `plan.monthlyTextMessages` |
| 음성 기능 | `usage.voiceMinutes`와 `plan.monthlyVoiceMinutes` |
| 장기기억 | `plan.memoryEnabled`, `plan.longTermMemoryLimit` |
| 이미지 생성 | `imageGeneration.canGenerate`와 `imageGeneration.remaining` |

이미지는 `imageGeneration.canGenerate`가 `true`일 때만 생성하세요.

## 5. 실제 기능 실행 전: 사용량 예약 API

단순 조회 후 바로 기능을 실행하지 말고, **기능을 실행하기 직전** 사용량 예약 API를 호출하세요.

이 API는 서버에서 현재 한도를 다시 확인하고 사용량을 기록합니다. 동시에 여러 요청이 와도 월 한도를 넘지 않도록 처리합니다.

```http
POST /api/bot/usage
Authorization: Bearer {BOT_SECRET_KEY}
Content-Type: application/json
```

공통 요청 본문:

```json
{
  "discordUserId": "123456789012345678",
  "eventType": "text_message",
  "amount": 1,
  "requestId": "고유한_요청_ID"
}
```

### `eventType` 값

| 값 | 뜻 | `amount` |
| --- | --- | --- |
| `text_message` | 텍스트 답변 1회 | 보통 `1` |
| `voice_minute` | 음성 사용 시간 | 사용 예정 분 수. 예: 3분이면 `3` |
| `image_generation` | 이미지 생성 | 이미지 1장이면 `1` |

### 요청 ID (`requestId`) 규칙

`requestId`는 같은 요청이 네트워크 오류 등으로 재시도돼도 중복 차감되지 않게 하는 고유값입니다.

- 텍스트·이미지: Discord 메시지 ID를 사용해도 됩니다.
- 음성: 음성 세션 ID 또는 UUID처럼 매 요청마다 달라지는 값을 사용하세요.
- 한 번 예약한 요청을 재시도할 때는 반드시 **같은** `requestId`를 사용하세요.

### 텍스트 대화 예약 예시

```json
{
  "discordUserId": "123456789012345678",
  "eventType": "text_message",
  "amount": 1,
  "requestId": "135790246801357924"
}
```

### 음성 3분 예약 예시

```json
{
  "discordUserId": "123456789012345678",
  "eventType": "voice_minute",
  "amount": 3,
  "requestId": "voice-session-20260826-001"
}
```

### 이미지 1장 예약 예시

```json
{
  "discordUserId": "123456789012345678",
  "eventType": "image_generation",
  "amount": 1,
  "requestId": "135790246801357924"
}
```

성공 응답 예시:

```json
{
  "ok": true,
  "userId": "2168",
  "quota": {
    "reserved": true,
    "alreadyReserved": false,
    "used": 4,
    "limit": 50,
    "remaining": 46
  }
}
```

한도 초과 응답 예시:

```json
{
  "ok": false,
  "error": "QUOTA_EXCEEDED",
  "quota": {
    "reserved": false,
    "used": 50,
    "limit": 50,
    "remaining": 0
  }
}
```

`403` 또는 `ok: false`가 오면 AI 모델, 음성 처리, 이미지 생성 API를 호출하지 말고 사용자에게 한도 초과 안내를 보내주세요.

## 6. 기능 실행 실패 시: 예약 취소 API

사용량 예약에는 성공했지만 이후 AI 모델, 음성 처리, 이미지 생성이 실패했다면 예약을 취소해야 합니다.

```http
DELETE /api/bot/usage
Authorization: Bearer {BOT_SECRET_KEY}
Content-Type: application/json
```

본문은 예약할 때와 동일한 `discordUserId`, `eventType`, `requestId`를 사용합니다.

```json
{
  "discordUserId": "123456789012345678",
  "eventType": "image_generation",
  "requestId": "135790246801357924"
}
```

성공 응답:

```json
{
  "ok": true,
  "userId": "2168",
  "released": true
}
```

## 7. 권장 처리 순서

### 텍스트 대화

1. `GET /api/bot/billing`으로 현재 상태를 조회합니다.
2. `POST /api/bot/usage`에 `text_message`, `amount: 1`을 보내 예약합니다.
3. 예약 성공 시에만 LLM 또는 답변 생성 기능을 호출합니다.
4. 답변 생성에 실패하면 `DELETE /api/bot/usage`로 예약을 취소합니다.
5. 답변 생성에 성공하면 별도 작업 없이 종료합니다.

### 음성 기능

1. `GET /api/bot/billing`으로 사용 가능 시간을 확인합니다.
2. 처리할 시간을 분 단위로 계산합니다.
3. `POST /api/bot/usage`에 `voice_minute`와 해당 분 수를 보내 예약합니다.
4. 음성 처리 실패 시 `DELETE /api/bot/usage`로 취소합니다.

### 이미지 생성

1. `GET /api/bot/billing` 응답에서 `imageGeneration.canGenerate`가 `true`인지 확인합니다.
2. `POST /api/bot/usage`에 `image_generation`, `amount: 1`을 보내 예약합니다.
3. 예약 성공 시에만 이미지 생성 API를 호출합니다.
4. 생성 실패 시 `DELETE /api/bot/usage`로 예약을 취소합니다.
5. 생성 성공 시 예약을 유지합니다. 이로써 월 이미지 생성 사용량 1장이 기록됩니다.

## 8. 주요 오류 코드

| HTTP 상태 | 오류 코드 | 의미 | 봇 처리 |
| --- | --- | --- | --- |
| 401 | `UNAUTHORIZED_BOT` | 인증 키가 없거나 틀림 | 운영자에게 설정 확인 요청 |
| 404 | `USER_NOT_FOUND` | Discord 계정이 웹 계정에 연결되지 않음 | 웹사이트에서 Discord 연동 안내 |
| 403 | `QUOTA_EXCEEDED` | 이번 달 한도 초과 | 다음 갱신일까지 안내 또는 플랜 변경 안내 |
| 403 | `NO_ACTIVE_SUBSCRIPTION` | 활성 구독 정보 없음 | 웹사이트에서 요금제 상태 확인 안내 |
| 400 | `INVALID_BODY` | 요청 형식 오류 | 봇 코드의 필수 값 확인 |
| 500 | `QUOTA_RESERVATION_FAILED` | 일시적 서버 오류 | 잠시 후 재시도. 반복 호출 시 같은 `requestId` 사용 |

## 9. 보안 주의사항

- `BOT_SECRET_KEY`는 절대 Discord 채팅, 스크린샷, GitHub에 올리지 마세요.
- 봇 서버의 환경 변수로만 관리하세요.
- 사용자 입력을 신뢰하지 말고 `discordUserId`, `amount`, `requestId`를 서버에서 검증하세요.
- 이미지 생성 등 비용이 드는 작업은 반드시 사용량 예약 성공 뒤에 실행하세요.
