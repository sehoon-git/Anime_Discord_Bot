# Discord Anime AI

Discord Anime AI는 한국어 AI 캐릭터와 텍스트 채팅, 음성 채팅을 함께 사용할 수 있는 Discord 봇 서비스의 웹앱입니다.

현재 웹앱은 Next.js 기반이며 Google 로그인, 서비스 이용 동의, 대시보드, 요금제, 개인정보/약관 페이지를 포함합니다.

## 주요 기능

- Google OAuth 로그인
- 최초 로그인 후 서비스 이용 동의
- 로그인 보호 대시보드
- 요금제와 결제 수단 UI
- 기억 관리와 개인정보 설정 화면
- 이용약관, 개인정보 처리방침, 음성 데이터 정책, 환불 정책, 라이선스 고지 페이지

## 로컬 실행

```bash
npm install
npm.cmd run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다.

## 환경 변수

로컬에서는 `.env.local` 파일을 만들고 아래 값을 설정합니다.

```env
AUTH_SECRET="local-secret"
NEXTAUTH_SECRET="local-secret"
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

`.env.local`은 Git에 올리지 않습니다.

## Google OAuth 설정

로컬 개발용 OAuth 클라이언트에는 다음 값을 등록합니다.

승인된 JavaScript 원본:

```text
http://localhost:3000
```

승인된 리디렉션 URI:

```text
http://localhost:3000/api/auth/callback/google
```

Vercel 등에 배포한 뒤에는 배포 URL도 같은 형식으로 추가합니다.

```text
https://your-domain.vercel.app
https://your-domain.vercel.app/api/auth/callback/google
```

## 배포

Vercel 배포 시 프로젝트 환경 변수에 다음 값을 등록합니다.

```env
NEXTAUTH_URL="https://your-domain.vercel.app"
NEXTAUTH_SECRET="long-random-secret"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

환경 변수를 추가하거나 변경한 뒤에는 다시 배포해야 적용됩니다.
