import assert from 'node:assert/strict';
import test from 'node:test';
import { VoiceServiceClient } from './voice-service-client.js';

test('transcribe sends in-memory PCM with Discord routing headers', async () => {
  let request: Request | undefined;
  const client = new VoiceServiceClient({
    baseUrl: 'http://voice.local',
    fetchImpl: async (input, init) => {
      request = new Request(input, init);
      return Response.json({ text: '안녕하세요', confidence: 0.91 });
    }
  });

  const result = await client.transcribe({
    pcm: Buffer.from([1, 2, 3]),
    guildId: 'guild-1',
    channelId: 'channel-1',
    userId: 'user-1'
  });

  assert.equal(result.text, '안녕하세요');
  assert.equal(result.confidence, 0.91);
  assert.equal(request?.url, 'http://voice.local/v1/transcriptions');
  assert.equal(request?.headers.get('x-guild-id'), 'guild-1');
  assert.equal(request?.headers.get('content-type'), 'audio/L16;rate=48000;channels=2');
  assert.deepEqual([...new Uint8Array(await request!.arrayBuffer())], [1, 2, 3]);
});

test('synthesize accepts only Ogg Opus for Discord playback', async () => {
  const client = new VoiceServiceClient({
    baseUrl: 'http://voice.local',
    fetchImpl: async () =>
      new Response(new Uint8Array([79, 103, 103, 83]), {
        headers: { 'content-type': 'audio/ogg; codecs=opus' }
      })
  });

  const stream = await client.synthesize({
    text: 'hello',
    voiceProfile: {
      id: 'en-female-heart-v1',
      version: 1,
      provider: 'kokoro',
      language: 'en-US',
      settings: { voice: 'af_heart', speed: 0.95 },
      status: 'published'
    }
  });
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));

  assert.deepEqual(Buffer.concat(chunks), Buffer.from([79, 103, 103, 83]));
});
