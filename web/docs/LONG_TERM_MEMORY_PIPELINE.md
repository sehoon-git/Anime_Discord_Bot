# Long-term memory: central API contract

## Ownership

`POST /api/bot/turn` is the only operational write path for long-term memory.
The Discord bot must not query or write the bot database directly and must not
call `POST /api/bot/memory`; that endpoint now returns
`405 MEMORY_WRITE_OWNED_BY_CONVERSATION_API`.

The bot remains an input/output adapter: it normalizes a Discord message or STT
transcript, sends a `TurnEnvelope`, then renders `reply` or queues it for TTS.

## Required bot request

```http
POST /api/bot/turn
Authorization: Bearer <BOT_SECRET_KEY>
Content-Type: application/json
```

```json
{
  "discordUserId": "123456789012345678",
  "guildId": "...",
  "channelId": "...",
  "messageId": "discord-event-id",
  "inputType": "text",
  "text": "Remember this: I prefer hand-drip coffee.",
  "characterId": "seline",
  "locale": "ko-KR",
  "occurredAt": "2026-08-14T00:00:00.000Z"
}
```

`messageId` must be the stable Discord event/message ID. It is used to prevent
the same event from producing duplicate memory evidence. For voice, send the
same fields with `inputType: "voice"` after B has applied its STT confidence,
empty-input, bot-message, and duplicate-event checks.

## Runtime sequence

1. API maps `discordUserId` in **WEB_DATABASE_URL**:
   `user_accounts(provider='discord', provider_user_id)` → `users.id`.
2. API verifies required consent and `memory_settings.enabled`.
3. API searches only confirmed, active memory in the `(user_id, character_id,
   memory_epoch)` scope and supplies it to the model as untrusted
   personalization data.
4. The API returns the reply. Candidate processing then runs within the API
   boundary using `after()`; the bot does not decide memory eligibility.
5. Candidates that contain sensitive data, temporary status, prompt injection,
   or noise are discarded. The initial rule-based extractor recognizes explicit
   remember requests plus simple preference/profile/goal statements.
6. A normal candidate is confirmed at two pieces of evidence. An explicit
   `remember this` / `기억해줘` request is confirmed immediately. Sources are
   retained in `memory_sources` for auditability and deduplication.

## Tables and data boundaries

| Database | Tables | Purpose |
| --- | --- | --- |
| Web DB (`WEB_DATABASE_URL`) | `users`, `user_accounts`, `user_consents`, `memory_settings` | identity, Discord linkage, consent, retention choice |
| Bot DB (`BOT_DATABASE_URL`) | `conversation_turns`, `conversation_summaries` | short-term context (up to 48 stored turns; text/voice budgets are applied by the caller/model layer) |
| Bot DB (`BOT_DATABASE_URL`) | `memory_items`, `memory_sources` | central long-term memory, evidence, deletion status, future pgvector embeddings |

There is intentionally no cross-database foreign key. The shared reference is
the web `users.id`, stored as `user_id` in bot-db records. **Discord ID never
becomes the memory owner key**; it is only used to resolve the web user.

## Memory commands and deletion

- `/memory off`: B must update the web setting through the central API/UI, then
  stop presenting memory-dependent UX. The API independently stops both search
  and storage on the next request.
- `/memory forget`: call the central deletion endpoint/UI. It marks the memory
  deleted and prevents retrieval immediately. Account deletion removes
  `memory_items` and `memory_sources` as well.
- `GET /api/bot/memory?discordUserId=...&characterId=seline` is read-only and
  returns up to ten confirmed memories for a bot command or diagnostics.

## Current scope and next production step

The checked-in SQL migration enables `pgvector` and adds a nullable embedding
column. Current retrieval is deterministic lexical matching plus evidence
count, so it works before an embedding provider is configured. When an
embedding model is selected, Developer A should fill `embedding` asynchronously
and switch ranking to vector similarity with lexical/evidence fallback.
