import assert from 'node:assert/strict';
import test from 'node:test';
import { BackendApiClient } from './api-client.js';

test('development mode returns a Korean voice profile without calling an API', async () => {
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
    canonicalText: '안녕하세요',
    occurredAt: '2026-08-04T00:00:00.000Z'
  });

  assert.equal(reply.text, '[개발 모드] 안녕하세요');
  assert.equal(reply.voiceProfile?.id, 'default-ko-v1');
});

test('development mode selects the English female default voice for English text', async () => {
  const client = new BackendApiClient({ baseUrl: 'http://localhost:3001', devEchoMode: true });
  const reply = await client.createTurn({
    eventId: 'event-2',
    userId: 'user-1',
    conversationId: 'conversation-2',
    modality: 'text',
    canonicalText: 'Hello there!',
    occurredAt: '2026-08-04T00:00:00.000Z'
  });

  assert.equal(reply.voiceProfile?.id, 'en-female-heart-v1');
  assert.equal(reply.voiceProfile?.settings.voice, 'af_heart');
});
