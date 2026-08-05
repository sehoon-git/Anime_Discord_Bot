# Shared developer user API

Set `SHARED_DEVELOPER_API_KEY` in Vercel Environment Variables. Share the value with the co-developer through a secure password manager or private channel, never in source control.

## Request

```http
GET /api/external/users
x-api-key: YOUR_SHARED_DEVELOPER_API_KEY
```

The same key can be sent as `Authorization: Bearer YOUR_SHARED_DEVELOPER_API_KEY`.

Optional query parameters:

- `userId`: return one user only
- `limit`: number of users, from 1 to 100, default 100

## Response

```json
{
  "ok": true,
  "count": 1,
  "users": [
    {
      "userId": "123",
      "nickname": "호랑이",
      "gender": "male",
      "birthDate": "2000-08-02",
      "locale": "ko-KR"
    }
  ]
}
```
