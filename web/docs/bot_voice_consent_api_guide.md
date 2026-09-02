# Discord 봇 음성 처리 동의 확인 API 안내

이 문서는 Discord 봇 개발자(B)가 **사용자가 웹에서 이미 동의한 음성 처리 허용 상태**를 확인할 때 사용합니다.

> 중요: 기존의 `/v1/discord/voice-consents/check` 경로는 현재 Voice With AI 웹사이트의 API가 아닙니다. 아래의 `/api/bot/account` 경로를 사용해야 합니다.

## 1. 준비 환경 변수

봇 서버(Oracle 등)의 `.env`에 아래 두 값을 설정합니다.

```env
BOT_API_BASE_URL=https://anime-discord-bot-rw3b.vercel.app
BOT_SECRET_KEY=Vercel에_설정된_BOT_SECRET_KEY와_동일한_값
```

- `BOT_SECRET_KEY`는 절대로 Discord 메시지, GitHub, 프런트엔드 코드에 넣으면 안 됩니다.
- Vercel의 `BOT_SECRET_KEY`와 Oracle 봇 서버의 값은 완전히 같아야 합니다.
- 웹사이트 주소가 바뀌면 `BOT_API_BASE_URL`만 새 주소로 바꿉니다.

## 2. 음성 처리 동의 조회 (음성 채널 입장 전 필수)

### 요청

```http
GET /api/bot/account?discordUserId={Discord_사용자_ID}
Authorization: Bearer {BOT_SECRET_KEY}
```

예시:

```ts
const response = await fetch(
  `${process.env.BOT_API_BASE_URL}/api/bot/account?discordUserId=${discordUserId}`,
  {
    headers: {
      Authorization: `Bearer ${process.env.BOT_SECRET_KEY}`,
    },
  },
);

if (!response.ok) {
  // 오류일 때는 음성 처리하지 않음 (fail closed)
  return false;
}

const data = await response.json();
const allowed = data.ok === true
  && data.account?.linked === true
  && data.account?.voiceConsent === true;
```

### 성공 응답: 동의 있음

```json
{
  "ok": true,
  "account": {
    "userId": "2168",
    "discordUserId": "1534243135159402547",
    "linked": true,
    "voiceConsent": true,
    "voiceConsentUpdatedAt": "2026-09-02T04:00:00.000Z"
  }
}
```

이 경우에만 해당 사용자의 음성을 STT 처리합니다.

### 성공 응답: Discord 계정 미연동

```json
{
  "ok": true,
  "account": null,
  "user": null
}
```

이 경우 음성을 처리하지 말고, 웹사이트에서 Discord 계정을 연동하도록 안내합니다.

### 성공 응답: 연동됐지만 음성 동의 없음

```json
{
  "ok": true,
  "account": {
    "linked": true,
    "voiceConsent": false
  }
}
```

이 경우 음성을 처리하지 말고 아래 설정 페이지로 안내합니다.

```text
https://anime-discord-bot-rw3b.vercel.app/settings/privacy
```

## 3. 봇에서 동의 상태를 바꾸는 API (선택 사항)

Discord 버튼으로 별도 동의를 받는 기능을 유지하려면 아래 API를 사용합니다.

```http
POST /api/bot/voice-consent
Authorization: Bearer {BOT_SECRET_KEY}
Content-Type: application/json

{
  "discordUserId": "1534243135159402547",
  "enabled": true
}
```

성공 응답:

```json
{
  "ok": true,
  "allowed": true
}
```

다만 현재 회원가입에서 `음성 데이터 처리`가 필수 동의이므로, **봇은 이 API로 자동 동의 처리하면 안 됩니다.**
봇은 2번 조회 API로 웹 동의 상태만 확인하는 방식이 기본입니다.

## 4. 구현 규칙

1. Discord의 `user.id` 원문을 `discordUserId`로 보냅니다. 닉네임, 이메일, 웹사이트 사용자 ID를 보내면 안 됩니다.
2. 사용자가 음성 채널에 들어올 때, 그리고 실제 음성 데이터를 STT로 보내기 직전에 다시 확인합니다.
3. `401`, `404`, `500`, 네트워크 오류, 응답 형식 오류는 모두 `동의 없음`으로 처리합니다.
4. 한 번 확인한 결과는 최대 1~5분만 메모리에 캐시하고, 장시간 저장하지 않습니다. 사용자가 웹 설정에서 동의를 철회할 수 있기 때문입니다.
5. 한 음성 채널에 여러 사람이 있으면 **사람마다** 이 API를 호출해 `voiceConsent: true`인 사람의 음성만 처리합니다.
6. 원본 음성 파일은 영구 저장하지 않습니다.

## 5. 기존 코드에서 교체할 부분

기존 코드의 아래 호출은 현재 웹 API와 맞지 않습니다.

```ts
POST /v1/discord/voice-consents/check
```

이를 아래 호출로 교체합니다.

```ts
GET /api/bot/account?discordUserId=${discordUserId}
```

그리고 반드시 다음 헤더를 추가합니다.

```ts
Authorization: Bearer ${BOT_SECRET_KEY}
```

## 6. 간단한 판정 함수

```ts
async function canProcessVoice(discordUserId: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${BOT_API_BASE_URL}/api/bot/account?discordUserId=${discordUserId}`,
      { headers: { Authorization: `Bearer ${BOT_SECRET_KEY}` } },
    );

    if (!response.ok) return false;
    const data = await response.json();
    return data.ok === true && data.account?.voiceConsent === true;
  } catch {
    return false;
  }
}
```

이 함수가 `true`일 때만 STT, 음성 요약 등 음성 처리를 진행하면 됩니다.
