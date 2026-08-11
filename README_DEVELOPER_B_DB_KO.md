# 개발자 B 인수인계: 웹 DB와 봇 DB

## 현재 DB 구성

| 구분 | Neon DB | 저장하는 데이터 |
| --- | --- | --- |
| 웹 DB | `neondb` | 사용자 계정, Google/Discord 연결, 프로필, 약관 동의, 요금제, 크레딧 |
| 봇 DB | `bot_db` | Discord 대화, 장기기억, 서버/채널 음성 설정, 음성 세션, 성능 이벤트 |

`bot_db.conversation_turns`에서 확인된 `test-guild-001`과 `test-channel-001`은 테스트 데이터입니다. 실제 Discord 서버·채널 ID는 긴 숫자(Snowflake)여야 합니다. 따라서 현재 `bot_db`에는 실제 초대된 서버의 대화 기록이 아직 없습니다.

## 사용자 매칭 방식

웹 DB와 봇 DB는 서로 다른 PostgreSQL 데이터베이스이므로 외래 키로 직접 연결하지 않습니다. 아래 키로 논리적으로 연결합니다.

```text
웹 DB users.id
  └─ user_accounts.provider = 'discord'
       └─ provider_user_id = Discord 사용자 ID
            └─ 봇 DB conversation_turns.user_id / discord_user_id
```

봇은 Discord의 `discordUserId`로 웹 DB에서 연결된 웹 사용자 ID를 찾고, 봇 DB에는 `user_id`와 `discord_user_id`를 함께 저장합니다. 같은 서버의 다른 사람은 이 매칭이 없으면 결제·동의·기억을 공유하거나 사용할 수 없습니다.

## Vercel 환경변수

웹 API가 배포된 Vercel의 Production 및 Preview 환경변수를 아래처럼 분리합니다.

```env
# 웹 DB: 계정·동의·결제
WEB_DATABASE_URL=<Neon neondb 연결 문자열>

# 기존 코드 호환용. WEB_DATABASE_URL과 동일한 웹 DB 주소
DATABASE_URL=<Neon neondb 연결 문자열>

# 봇 DB: 대화·기억·서버 설정
BOT_DATABASE_URL=<Neon bot_db 연결 문자열>
```

`BOT_DATABASE_URL`이 비어 있으면 안 됩니다. 누락된 경우 웹 DB로 대체하지 말고 환경변수를 수정해야 합니다. 그렇지 않으면 웹 DB와 봇 DB 데이터가 섞이거나 실제 봇 기록을 찾을 수 없습니다.

봇 배포 서비스에는 아래 값도 설정합니다.

```env
BOT_API_BASE_URL=https://anime-discord-bot-rw3b.vercel.app
BOT_SECRET_KEY=<Vercel의 BOT_SECRET_KEY와 같은 값>
DISCORD_TOKEN=<Discord 봇 토큰>
DISCORD_CLIENT_ID=<Discord 애플리케이션 ID>
```

연결 문자열과 토큰은 GitHub, README, Discord 채널에 절대 기록하지 않습니다.

## 스키마 적용 위치

| SQL 파일 | 실행할 DB |
| --- | --- |
| `web/docs/web_settings_schema.sql` | 웹 DB (`neondb`) |
| `web/docs/feature_completion_web_schema.sql` | 웹 DB (`neondb`) |
| `web/docs/memory_schema.sql` | 봇 DB (`bot_db`) |
| `web/docs/bot_runtime_schema.sql` | 봇 DB (`bot_db`) |
| `web/docs/feature_completion_bot_schema.sql` | 봇 DB (`bot_db`) |

`guild_settings`가 `neondb`에서 없다는 오류는 정상입니다. 이 테이블은 봇 DB인 `bot_db`에만 생성해야 합니다.

## 운영 확인 SQL

### 현재 선택한 DB 확인

```sql
SELECT current_database(), current_user;
```

### 실제 Discord 서버 대화가 봇 DB에 들어오는지 확인

실제 서버에서 봇에게 메시지를 보낸 뒤 `bot_db`에서 실행합니다.

```sql
SELECT
  guild_id,
  channel_id,
  discord_user_id,
  user_id,
  role,
  input_type,
  created_at
FROM conversation_turns
ORDER BY created_at DESC
LIMIT 50;
```

정상이라면 실제 긴 숫자 `guild_id`와 `channel_id`가 표시되고, `user`와 `assistant` 행이 한 쌍으로 추가됩니다. `test-guild-001`만 보이면 배포된 웹 API의 `BOT_DATABASE_URL` 또는 봇의 `BOT_API_BASE_URL`/`BOT_SECRET_KEY`를 확인합니다.

### 웹 계정과 Discord 계정 연결 확인

웹 DB `neondb`에서 실행합니다.

```sql
SELECT
  u.id AS web_user_id,
  u.email,
  ua.provider_user_id AS discord_user_id,
  ua.username AS discord_username
FROM users u
JOIN user_accounts ua
  ON ua.user_id = u.id
 AND ua.provider = 'discord'
ORDER BY u.id DESC;
```

이 결과의 `web_user_id`/`discord_user_id`가 봇 DB `conversation_turns`의 같은 열과 일치해야 합니다.

## 배포 점검 순서

1. Vercel에 웹 DB와 봇 DB 환경변수를 각각 설정합니다.
2. 환경변수 변경 뒤 Vercel을 재배포합니다.
3. 실제 Discord 서버에서 연결된 계정으로 봇에게 메시지를 보냅니다.
4. `bot_db` 조회 결과에 실제 서버 ID가 생성됐는지 확인합니다.
5. 기록이 없으면 봇 배포 서비스의 API 주소와 비밀 키가 Vercel 값과 일치하는지 확인합니다.
