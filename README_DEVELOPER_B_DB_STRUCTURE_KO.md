# 개발자 B용: 웹 DB · 봇 DB · API 연동 구조

## 1. 전체 원칙

서비스는 Neon PostgreSQL 데이터베이스를 두 개 사용합니다.

| 구분 | 환경 변수 | 역할 |
| --- | --- | --- |
| 웹 DB | `WEB_DATABASE_URL` (호환: `DATABASE_URL`) | 웹 계정, Discord 연결, 약관/음성 동의, 설정, 구독·크레딧 |
| 봇 DB | `BOT_DATABASE_URL` | Discord 서버/채널 설정, 대화·기억, 음성 세션, 성능 로그 |

두 DB는 서로 다른 PostgreSQL 데이터베이스입니다. 따라서 DB 간 `FOREIGN KEY`나 직접 `JOIN`은 없습니다.

**봇은 웹 DB에 직접 연결하지 않고, 웹 API를 호출해 계정·권한·동의·설정을 확인합니다.**

```text
Discord 이벤트의 discordUserId (문자열)
  → 웹 API
  → WEB_DB.user_accounts에서 웹 사용자(users.id) 조회
  → API 응답의 userId를 BOT_DB.user_id에 저장
```

## 2. 식별자 규칙

| 값 | 형식 | 사용처 |
| --- | --- | --- |
| `users.id` | BIGINT | 웹 서비스의 기준 사용자 ID. API가 `userId`로 반환 |
| Discord 사용자 ID | TEXT | Discord Snowflake. 항상 문자열로 처리 |
| `guild_id`, `channel_id` | TEXT | Discord 서버/채널 Snowflake. 항상 문자열로 처리 |

Discord ID는 JavaScript `Number`로 바꾸면 정밀도가 깨질 수 있으므로 **반드시 문자열 그대로** 저장·전달합니다.

## 3. 웹 DB 구조 (WEB_DATABASE_URL)

### 3-1. 계정과 Discord 연결

```text
users
  ├─ user_profiles
  ├─ user_consents
  ├─ voice_consents
  ├─ user_accounts  ← Discord ID 매칭의 기준
  ├─ language_settings / memory_settings / text_style_settings / voice_behavior
  ├─ subscriptions / usage_events / credit_balances
  └─ model_usage_events
```

| 테이블 | 키 | 역할 |
| --- | --- | --- |
| `users` | `id` | 웹 계정의 기준 테이블 (`email` unique) |
| `user_profiles` | `user_id → users.id` | 이름, 닉네임, 성별, 생년월일, 언어 |
| `user_accounts` | `user_id → users.id` | Google/Discord 등 외부 계정 연결 |

Discord 계정 연결은 `user_accounts`에서 아래 조건으로 판단합니다.

```sql
SELECT user_id, provider_user_id AS discord_user_id
FROM user_accounts
WHERE provider = 'discord'
  AND provider_user_id = $1;
```

`user_accounts`의 중요 컬럼:

```text
user_id             웹 users.id
provider            'discord'
provider_user_id    Discord 사용자 ID 문자열
username            Discord username
global_name         Discord display name
avatar              Discord avatar
```

제약 조건은 `UNIQUE (user_id, provider)`, `UNIQUE (provider, provider_user_id)`입니다. 즉, Discord 계정 하나는 웹 계정 하나에만 연결됩니다.

### 3-2. 약관 동의와 실제 음성 처리 동의

| 테이블 | 핵심 값 | 의미 |
| --- | --- | --- |
| `user_consents` | `consent_type = 'voice'`, `accepted_at` | 가입 필수 약관의 음성 데이터 처리 동의 |
| `voice_consents` | `speech_recognition_allowed` | 봇이 음성 처리를 해도 되는지 결정하는 실제 허용값 |

필수 약관 종류:

```text
terms, privacy, overseas, memory, voice
```

현재 웹 저장 로직은 가입/약관 동의 시 두 테이블을 함께 기록합니다.

```text
user_consents: consent_type='voice', accepted_at=동의 시각
voice_consents: speech_recognition_allowed=true, accepted_at=동의 시각
```

기존 사용자 호환을 위해 봇 API는 `voice_consents` 행이 없을 경우 `user_consents`의 `voice` 동의를 보조값으로 사용합니다.

따라서 봇이 읽어야 할 값은 API의 `voiceConsent` 또는 `voice_consent`이며, `null`을 자체적으로 해석하지 않아도 됩니다.

### 3-3. 사용자 설정·결제

| 테이블 | 역할 |
| --- | --- |
| `language_settings` | 언어, 시간대 |
| `memory_settings` | 장기기억 사용 여부, 보관 기간 |
| `text_style_settings` | 관계 톤, 응답 길이, 선호/차단 주제 |
| `voice_behavior` | 음성 응답/요약, 음성 스타일, 속도, 볼륨, 끼어들기 방식 |
| `credit_balances` | 크레딧 잔액 |
| `plans` | 플랜 정의 |
| `subscriptions` | 사용자별 구독 플랜 |
| `usage_events` | 텍스트/음성 사용량 |
| `model_usage_events` | 모델 사용량·크레딧·오류 기록 |

위 사용자별 테이블은 모두 `user_id = users.id`를 기준으로 연결됩니다.

## 4. 봇 DB 구조 (BOT_DATABASE_URL)

봇 DB의 `user_id`는 웹 DB의 `users.id` 값을 저장하는 논리적 참조입니다. DB가 다르므로 Foreign Key는 없습니다.

| 테이블 | 주요 키 | 역할 |
| --- | --- | --- |
| `conversation_turns` | `user_id`, `discord_user_id`, `guild_id`, `channel_id` | 사용자/AI 대화 기록 |
| `conversation_summaries` | `user_id` | 사용자별 대화 요약 |
| `user_memories` | `user_id` | 장기기억 |
| `memory_audit_events` | `user_id`, `memory_id` | 기억 변경 감사 로그 |
| `guild_settings` | `guild_id` | 서버 단위 봇/음성 설정 |
| `channel_voice_permissions` | `(guild_id, channel_id)` | 채널별 음성 허용 여부 |
| `voice_join_bot_prompts` | `guild_id` | 입장/퇴장/동의 안내 문구 |
| `voice_sessions` | `guild_id`, `channel_id` | 음성 세션 기록 |
| `performance_events` | `user_id`, `discord_user_id`, `guild_id`, `channel_id` | STT/TTS/LLM 성능·오류 로그 |

예시: `conversation_turns`에 저장할 값

```text
user_id          = 웹 API가 반환한 account.userId
discord_user_id  = Discord 이벤트의 원본 사용자 ID 문자열
guild_id         = Discord 서버 ID 문자열
channel_id       = Discord 채널 ID 문자열
```

## 5. 봇이 호출하는 웹 API

모든 봇 API 요청에는 웹 Vercel과 동일한 `BOT_SECRET_KEY`를 넣습니다.

```http
Authorization: Bearer <BOT_SECRET_KEY>
```

또는:

```http
x-bot-api-key: <BOT_SECRET_KEY>
```

### A. 계정·음성 동의 확인

```http
GET /api/bot/account?discordUserId=<DISCORD_USER_ID>
```

정상 응답 예시:

```json
{
  "ok": true,
  "account": {
    "userId": "192",
    "discordUserId": "533931887471624202",
    "linked": true,
    "voiceConsent": true,
    "voiceConsentUpdatedAt": "2026-08-13T00:00:00.000Z"
  }
}
```

처리 규칙:

| 응답 | 봇 처리 |
| --- | --- |
| HTTP 401 | `BOT_SECRET_KEY` 불일치. 설정 오류로 처리 |
| `account: null` | 웹 계정에 Discord 연결이 없음. 연결 안내 |
| `voiceConsent: false` | 음성 처리 동의 없음. 웹 설정 안내 |
| `voiceConsent: true` | 다음 채널 권한 검사 단계 진행 |

### B. 사용자·서버·채널 설정 확인

```http
GET /api/bot/settings?discordUserId=<DISCORD_USER_ID>&guildId=<GUILD_ID>&channelId=<CHANNEL_ID>
```

중요 응답값:

```json
{
  "ok": true,
  "user": {
    "voice_consent": true,
    "voice_response_enabled": true
  },
  "channel": {
    "voice_allowed": true
  }
}
```

음성 처리 권장 조건:

```text
account.linked === true
AND account.voiceConsent === true
AND settings.channel.voice_allowed === true
AND settings.user.voice_response_enabled !== false
```

### C. 기타 API

| API | 용도 |
| --- | --- |
| `POST /api/bot/voice-consent` | Discord ID로 음성 동의 변경 |
| `POST /api/bot/turn` | 대화 처리 및 봇 DB 대화 기록 |
| `GET/POST /api/bot/memory` | 장기기억 조회/저장 |
| `GET/POST /api/bot/credits` | 크레딧 조회/차감 |
| `POST /api/bot/metrics` | STT/TTS/LLM 성능 기록 |

## 6. 실제 음성 처리 흐름

```text
Discord 음성 이벤트 수신
  → discordUserId, guildId, channelId를 문자열로 확보
  → GET /api/bot/account
  → account.userId 확보 + voiceConsent 검사
  → GET /api/bot/settings
  → channel.voice_allowed, voice_response_enabled 검사
  → 허용 시 STT/TTS 및 대화 처리
  → BOT_DB에 user_id + discord_user_id + guild_id + channel_id로 기록
```

## 7. Neon 점검 SQL

### 웹 DB: Discord 연결과 음성 동의 확인

```sql
SELECT
  u.id AS web_user_id,
  u.email,
  a.provider_user_id AS discord_user_id,
  a.username AS discord_username,
  uc.accepted_at AS required_voice_consent_at,
  vc.speech_recognition_allowed,
  vc.accepted_at AS voice_processing_allowed_at,
  vc.updated_at AS voice_consent_updated_at
FROM users u
JOIN user_accounts a
  ON a.user_id = u.id
 AND a.provider = 'discord'
LEFT JOIN user_consents uc
  ON uc.user_id = u.id
 AND uc.consent_type = 'voice'
LEFT JOIN voice_consents vc
  ON vc.user_id = u.id
WHERE a.provider_user_id = '<DISCORD_USER_ID>';
```

### 웹 DB: 모든 필수 약관 확인

```sql
SELECT
  u.id AS web_user_id,
  a.provider_user_id AS discord_user_id,
  ARRAY_AGG(uc.consent_type ORDER BY uc.consent_type) AS accepted_consents
FROM users u
JOIN user_accounts a
  ON a.user_id = u.id
 AND a.provider = 'discord'
LEFT JOIN user_consents uc
  ON uc.user_id = u.id
 AND uc.accepted_at IS NOT NULL
WHERE a.provider_user_id = '<DISCORD_USER_ID>'
GROUP BY u.id, a.provider_user_id;
```

### 봇 DB: Discord 사용자의 대화 기록 확인

```sql
SELECT
  user_id,
  discord_user_id,
  guild_id,
  channel_id,
  role,
  input_type,
  created_at
FROM conversation_turns
WHERE discord_user_id = '<DISCORD_USER_ID>'
ORDER BY created_at DESC
LIMIT 50;
```

### 봇 DB: 서버·채널 음성 권한 확인

```sql
SELECT *
FROM channel_voice_permissions
WHERE guild_id = '<GUILD_ID>'
  AND channel_id = '<CHANNEL_ID>';
```

## 8. 배포 전 체크리스트

1. Vercel `WEB_DATABASE_URL`/`DATABASE_URL`은 웹 DB를 가리킨다.
2. Vercel `BOT_DATABASE_URL`은 봇 DB를 가리킨다.
3. Vercel과 봇 `.env`의 `BOT_SECRET_KEY`가 동일하다.
4. 봇의 `BOT_API_BASE_URL`은 실제 Vercel 도메인이다.
5. `/api/bot/account?discordUserId=test`는 HTML이 아닌 JSON을 반환한다.
6. 실제 Discord 사용자로 위 웹 DB 점검 SQL을 실행해 `user_accounts` 연결과 `voice` 동의를 확인한다.
7. 봇 재시작 후 실제 서버/채널 ID가 `bot_db` 기록에 들어오는지 확인한다.
