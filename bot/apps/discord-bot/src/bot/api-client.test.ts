import assert from 'node:assert/strict';
import test from 'node:test';
import { BackendApiClient, DirectGeminiVoiceApi } from './api-client.js';
import { makeTextTurn } from './discord-text.js';

test('development mode always returns the English default voice profile without calling an API', async () => {
  const client = new BackendApiClient({
    baseUrl: 'http://localhost:3001',
    devEchoMode: true,
    fetchImpl: async () => {
      throw new Error('fetch must not run in development echo mode');
    }
  });

  const reply = await client.createTurn({
    eventId: 'event-1',
    userId: 'user-1',
    conversationId: 'conversation-1',
    modality: 'text',
    canonicalText: 'Hi there!',
    occurredAt: '2026-08-04T00:00:00.000Z'
  });

  assert.equal(reply.text, '[development mode] Hi there!');
  assert.equal(reply.voiceProfile?.id, 'en-female-seline-leda-normal-v2');
  assert.equal(reply.voiceProfile?.provider, 'gemini');
  assert.equal(reply.voiceProfile?.settings.voice, 'Leda');
});

test('development mode selects the English female default voice for English text', async () => {
  const client = new BackendApiClient({ baseUrl: 'http://localhost:3001', devEchoMode: true });
  const reply = await client.createTurn({
    eventId: 'event-2',
    userId: 'user-1',
    conversationId: 'conversation-2',
    modality: 'text',
    canonicalText: 'Hi there!',
    occurredAt: '2026-08-04T00:00:00.000Z'
  });

  assert.equal(reply.voiceProfile?.id, 'en-female-seline-leda-normal-v2');
  assert.equal(reply.voiceProfile?.settings.voice, 'Leda');
});

test('DirectGeminiVoiceApi speaks a recovery prompt when Gemini has no text response', async () => {
  const voiceApi = new DirectGeminiVoiceApi({
    createTurn: async () => ({ text: 'unused' }),
    async *streamTurn(): AsyncGenerator<{ text: string }, { text: string }, void> {
      throw new Error('Gemini returned an empty text response.');
    }
  });

  const replies = [];
  for await (const reply of voiceApi.streamTurn(makeTextTurn({ channelId: 'channel-1', userId: 'user-1', text: 'hi' }))) {
    replies.push(reply.text);
  }
  assert.deepEqual(replies, ['I caught part of that, but say it once more for me?']);
});
test('successful turns report one used credit after the reply is created', async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const client = new BackendApiClient({
    baseUrl: 'https://anime-discord-bot-rw3b.vercel.app',
    apiKey: 'secret',
    devEchoMode: false,
    fetchImpl: async (url, init) => {
      requests.push({ url: String(url), init });
      return requests.length === 1
        ? new Response(JSON.stringify({ text: 'Hello!' }), { status: 200 })
        : new Response(null, { status: 204 });
    }
  });

  const reply = await client.createTurn(makeTextTurn({ guildId: 'guild-1', channelId: 'channel-1', userId: 'user-1', text: 'Hi' }));

  assert.equal(reply.text, 'Hello!');
  assert.equal(requests[0].url, 'https://anime-discord-bot-rw3b.vercel.app/api/bot/turn');
  assert.equal(new Headers(requests[0].init?.headers).get('authorization'), 'Bearer secret');
  assert.equal(requests[1].url, 'https://anime-discord-bot-rw3b.vercel.app/api/bot/metrics');
  assert.deepEqual(JSON.parse(String(requests[1].init?.body)), {
    discordUserId: 'user-1', guildId: 'guild-1', channelId: 'channel-1', modelUsage: { creditsUsed: 1 }
  });
});

test('voice processing requires both user and channel consent from settings', async () => {
  const requests: string[] = [];
  const client = new BackendApiClient({
    baseUrl: 'https://anime-discord-bot-rw3b.vercel.app',
    devEchoMode: false,
    fetchImpl: async (url) => {
      requests.push(String(url));
      return new Response(JSON.stringify({ user: { voice_consent: true }, channel: { voice_allowed: true } }), { status: 200 });
    }
  });

  assert.equal(await client.canProcessVoice({ guildId: 'guild-1', channelId: 'channel-1', userId: 'user-1' }), true);
  assert.match(requests[0], /\/api\/bot\/settings\?discordUserId=user-1&guildId=guild-1&channelId=channel-1$/);
});
test('forwards normalized website personal preferences with a conversation turn', async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const client = new BackendApiClient({
    baseUrl: 'https://anime-discord-bot-rw3b.vercel.app',
    devEchoMode: false,
    fetchImpl: async (url, init) => {
      requests.push({ url: String(url), init });
      return requests.length === 1
        ? new Response(JSON.stringify({ text: 'Hello!' }), { status: 200 })
        : new Response(null, { status: 204 });
    }
  });

  await client.createTurn({
    ...makeTextTurn({ guildId: 'guild-1', channelId: 'channel-1', userId: 'user-1', text: 'Hi' }),
    personalPreferences: { relationshipTone: 'flirting', replyLength: 'short', interruptionMode: 'immediate' }
  });

  assert.deepEqual(JSON.parse(String(requests[0].init?.body)).personalPreferences, {
    relationshipTone: 'flirting',
    replyLength: 'short',
    interruptionMode: 'immediate'
  });
});

test('forwards the website SNS text-style preference with a conversation turn', async () => {
  const requests: Array<{ init?: RequestInit }> = [];
  const client = new BackendApiClient({
    baseUrl: 'https://anime-discord-bot-rw3b.vercel.app',
    devEchoMode: false,
    fetchImpl: async (_url, init) => {
      requests.push({ init });
      return requests.length === 1
        ? new Response(JSON.stringify({ text: 'Hello!' }), { status: 200 })
        : new Response(null, { status: 204 });
    }
  });

  await client.createTurn({
    ...makeTextTurn({ guildId: 'guild-1', channelId: 'channel-1', userId: 'user-1', text: 'Hi' }),
    personalPreferences: { snsStyleEnabled: false }
  });

  assert.deepEqual(JSON.parse(String(requests[0].init?.body)).personalPreferences, { snsStyleEnabled: false });
});
