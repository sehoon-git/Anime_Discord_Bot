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
  assert.equal(reply.voiceProfile?.id, 'en-female-seline-expressive-v1');
  assert.equal(reply.voiceProfile?.provider, 'gemini');
  assert.equal(reply.voiceProfile?.settings.voice, 'Sulafat');
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

  assert.equal(reply.voiceProfile?.id, 'en-female-seline-expressive-v1');
  assert.equal(reply.voiceProfile?.settings.voice, 'Sulafat');
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