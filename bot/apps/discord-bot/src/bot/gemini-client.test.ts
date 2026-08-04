import assert from 'node:assert/strict';
import test from 'node:test';
import { makeTextTurn } from './discord-text.js';
import { GeminiTextClient } from './gemini-client.js';

test('GeminiTextClient returns text and the API-reported token usage', async () => {
  const client = new GeminiTextClient({
    apiKey: 'test-key',
    model: 'test-model',
    maxOutputTokens: 256,
    fetchImpl: async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, '/v1beta/models/test-model:generateContent');
      assert.equal(url.searchParams.get('key'), 'test-key');
      assert.deepEqual(JSON.parse(String(init?.body)), {
        contents: [{ role: 'user', parts: [{ text: '안녕' }] }],
        generationConfig: { maxOutputTokens: 256 }
      });
      return Response.json({
        candidates: [{ content: { parts: [{ text: '반가워!' }] } }],
        usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 8, totalTokenCount: 20 }
      });
    }
  });

  const reply = await client.createTurn(
    makeTextTurn({ guildId: 'guild-1', channelId: 'channel-1', userId: 'user-1', text: '안녕' })
  );

  assert.equal(reply.text, '반가워!');
  assert.deepEqual(reply.usage, { promptTokens: 12, outputTokens: 8, totalTokens: 20 });
});

test('GeminiTextClient surfaces provider errors without exposing a response as successful', async () => {
  const client = new GeminiTextClient({
    apiKey: 'test-key',
    model: 'test-model',
    maxOutputTokens: 256,
    fetchImpl: async () => new Response('quota exceeded', { status: 429 })
  });

  await assert.rejects(
    client.createTurn(makeTextTurn({ channelId: 'channel-1', userId: 'user-1', text: '안녕' })),
    /Gemini API 요청 실패 \(429\).*quota exceeded/
  );
});
