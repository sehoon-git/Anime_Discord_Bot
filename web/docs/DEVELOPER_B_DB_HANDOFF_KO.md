# 개발자 B 인수인계: 웹 DB와 봇 DB 분리 운영

## 1. 현재 확인된 상황

Neon 프로젝트에는 역할이 다른 두 데이터베이스가 있습니다.

| 구분 | 운영 데이터베이스 | 저장 데이터 |
| --- | --- | --- |
| 웹 DB | `neondb` | 사용자 계정, Google/Discord 연결, 프로필, 필수 동의, 요금제, 크레딧 |
| 봇 DB | `bot_db` | Discord 대화, 장기기억, 서버/채널 음성 설정, 음성 세션, 성능 이벤트 |

`bot_db.conversation_turns`에서 확인된 `test-guild-001` / `test-channel-001`은 실제 Discord 서버가 아닌 테스트 데이터입니다. 실제 Discord 서버 ID는 긴 숫자(Snowflake)여야 합니다. 따라서 현재 `bot_db`에는 실제 초대된 서버의 기록이 아직 없습니다.

## 2. 반드시 지켜야 할 연결 규칙

웹 DB와 봇 DB는 물리적으로 분리되어 있으므로 PostgreSQL 외래 키로 직접 연결하지 않습니다. 대신 아래 식별자로 논리적으로 연결합니다.

```text
웹 DB users.id
  └─ user_accounts.provider = 'discord'
       └─ user_accounts.provider_user_id = Discord 사용자 ID
            └─ 봇 DB의 conversation_turns.user_id / discord_user_id
```

봇이 메시지를 처리할 때 Discord에서 받은 `discordUserId`로 웹 DB의 `user_accounts`를 조회해 웹 사용자 `users.id`를 찾습니다. 그 뒤 봇 DB에 `user_id`와 `discord_user_id`를 함께 기록합니다. 서버 안에 다른 사람이 있어도 이 연결이 있는 사용자만 해당 사용자의 요금제·동의·기억을 사용할 수 있습니다.

## 3. 배포 환경변수: 가장 중요

Vercel(웹 API가 배포된 서비스)의 Production / Preview 환경변수에 아래를 **각각 명시**합니다.

```env
# 계정·동의·결제 DB (Neon: neondb)
WEB_DATABASE_URL=<neondb 연결 문자열>

# 기존 코드 호환용. WEB_DATABASE_URL과 같은 웹 DB 주소를 넣는다.
DATABASE_URL=<neondb 연결 문자열>

# 대화·기억·서버 설정 DB (Neon: bot_db)
BOT_DATABASE_URL=<bot_db 연결 문자열>
```

`BOT_DATABASE_URL`이 빠진 상태에서 `DATABASE_URL`로 자동 대체되면 웹 DB와 봇 DB가 섞일 수 있습니다. 이 저장소에서는 해당 자동 대체를 제거했습니다. 그러므로 `BOT_DATABASE_URL` 누락은 설정 오류로 바로 발견하고 수정해야 합니다.

봇 프로세스가 웹 API를 호출하는 구조라면 봇 배포 서비스에는 아래 값도 필요합니다.

```env
BOT_API_BASE_URL=https://anime-discord-bot-rw3b.vercel.app
BOT_SECRET_KEY=<Vercel의 BOT_SECRET_KEY와 동일한 값>
DISCORD_TOKEN=<Discord 봇 토큰>
DISCORD_CLIENT_ID=<Discord 애플리케이션 ID>
```

연결 문자열과 토큰은 README, Git, Discord 채널에 절대 붙여 넣지 않습니다.

## 4. Neon 스키마 적용 위치

| 파일 | 실행할 데이터베이스 |
| --- | --- |
| `web/docs/web_settings_schema.sql` | 웹 DB (`neondb`) |
| `web/docs/feature_completion_web_schema.sql` | 웹 DB (`neondb`) |
| `web/docs/memory_schema.sql` | 봇 DB (`bot_db`) |
| `web/docs/bot_runtime_schema.sql` | 봇 DB (`bot_db`) |
| `web/docs/feature_completion_bot_schema.sql` | 봇 DB (`bot_db`) |

`guild_settings`가 `neondb`에서 없다는 오류는 정상입니다. 이 테이블은 `bot_db`에만 있어야 합니다.

## 5. 배포 후 확인 쿼리

### 5-1. 현재 선택한 DB 확인

```sql
SELECT current_database(), current_user;
```

### 5-2. 실제 Discord 서버 메시지가 봇 DB에 들어오는지 확인

실제 서버에서 봇에게 메시지를 보낸 직후 `bot_db`에서 실행합니다.

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

정상이라면 `guild_id`와 `channel_id`가 실제 Discord의 긴 숫자 ID이고, `user`와 `assistant` 행이 한 쌍으로 추가됩니다. `test-guild-001`만 계속 보이면 배포된 웹 API가 다른 `BOT_DATABASE_URL`을 보고 있거나 봇이 운영 API를 호출하지 않는 상태입니다.

### 5-3. 웹 사용자와 Discord 계정 연결 확인

웹 DB (`neondb`)에서 실행합니다.

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

위 쿼리의 `web_user_id`와 봇 DB의 `conversation_turns.user_id`, 그리고 `discord_user_id`가 각각 일치해야 합니다.

## 6. 운영 점검 순서

1. Vercel의 `WEB_DATABASE_URL`, `DATABASE_URL`, `BOT_DATABASE_URL`을 위 역할대로 설정한다.
2. 환경변수 변경 뒤 Vercel을 재배포한다.
3. 실제 Discord 서버에서 연결된 계정으로 봇에게 메시지를 보낸다.
4. `bot_db`의 대화 조회 쿼리에서 실제 긴 숫자 `guild_id`가 생성됐는지 확인한다.
5. 실패하면 봇 배포 서비스의 `BOT_API_BASE_URL`, `BOT_SECRET_KEY`가 Vercel 값과 일치하는지 확인한다.

이 순서를 통과하기 전에는 테스트 데이터만 보고 서버별 권한·결제 문제로 판단하지 않습니다.
