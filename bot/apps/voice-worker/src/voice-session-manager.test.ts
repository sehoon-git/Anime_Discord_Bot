import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import { endpointSilenceMs, isExpectedCaptureClose, isExplicitInterrupt, isLikelyPlaybackEcho, nextChunkWithTimeout, VoiceSessionManager, voiceTranscriptionIsConfident, waitForDrainWithTimeout } from './voice-session-manager.js';

test('recognizes spaced and attached shut up interruption phrases', () => {
  assert.equal(isExplicitInterrupt('Seline, shut up.'), true);
  assert.equal(isExplicitInterrupt('seline shutup'), true);
  assert.equal(isExplicitInterrupt('wait a second'), true);
  assert.equal(isExplicitInterrupt('do you like baseball?'), false);
});
test('waits through a natural pause before treating speech as a completed turn', () => {
  assert.equal(endpointSilenceMs(500), 750);
  assert.equal(endpointSilenceMs(700), 1_050);
  assert.equal(endpointSilenceMs(2_000), 1_050);
});

test('treats Discord subscription close as a normal capture endpoint', () => {
  const error = Object.assign(new Error('Premature close'), { code: 'ERR_STREAM_PREMATURE_CLOSE' });
  assert.equal(isExpectedCaptureClose(error, { destroyed: true }), true);
  assert.equal(isExpectedCaptureClose(error, { destroyed: false }), false);
  assert.equal(isExpectedCaptureClose(new Error('decoder failed'), { destroyed: true }), false);
});
test('ignores a likely microphone echo of recent Seline speech only while it is substantial', () => {
  assert.equal(isLikelyPlaybackEcho("I'll be here.", ["[smiles] I'll be here."]), true);
  assert.equal(isLikelyPlaybackEcho('How was your day?', ["I'll be here."]), false);
  assert.equal(isLikelyPlaybackEcho('Always.', ['Always.']), false);
});
test('rejects low-confidence voice transcriptions before they can trigger a reply', () => {
  assert.equal(voiceTranscriptionIsConfident(0.49), false);
  assert.equal(voiceTranscriptionIsConfident(0.5), true);
  assert.equal(voiceTranscriptionIsConfident(undefined), true);
});test('forces a stalled TTS input stream to close at its deadline', async () => {
  const stream = new PassThrough();
  await assert.rejects(nextChunkWithTimeout(stream[Symbol.asyncIterator](), stream, 20), /PCM stream stalled/);
  assert.equal(stream.destroyed, true);
});

test('forces a stalled TTS output backpressure wait to close at its deadline', async () => {
  const stream = new PassThrough();
  await assert.rejects(waitForDrainWithTimeout(stream, 20), /PCM output stalled/);
  assert.equal(stream.destroyed, true);
});
test('immediate interruption setting stops active voice playback without waiting for a stop command', async () => {
  let bargeInCalls = 0;
  let abortCalls = 0;
  let stopCalls = 0;
  const manager = new VoiceSessionManager({
    conversationApi: { createTurn: async () => ({ conversationId: 'unused', text: 'unused' }) },
    voiceService: {},
    canProcessVoice: async () => true,
    shouldInterruptImmediately: async () => true,
    onBargeIn: async () => { bargeInCalls += 1; }
  } as any);
  const session = {
    channel: { id: 'channel-1', guild: { id: 'guild-1' } },
    player: { state: { status: 'playing' }, stop: () => { stopCalls += 1; } },
    activeRequest: { abort: () => { abortCalls += 1; } }
  };

  await (manager as any).confirmBargeIn(session, 'user-1');

  assert.equal(bargeInCalls, 1);
  assert.equal(abortCalls, 1);
  assert.equal(stopCalls, 1);
});
test('stop-command-only setting leaves active playback running during normal speech', async () => {
  let stopCalls = 0;
  const manager = new VoiceSessionManager({
    conversationApi: { createTurn: async () => ({ conversationId: 'unused', text: 'unused' }) },
    voiceService: {},
    canProcessVoice: async () => true,
    shouldInterruptImmediately: async () => false
  } as any);
  const session = {
    channel: { id: 'channel-1', guild: { id: 'guild-1' } },
    player: { state: { status: 'playing' }, stop: () => { stopCalls += 1; } }
  };
  await (manager as any).confirmBargeIn(session, 'user-1');

  assert.equal(stopCalls, 0);
});
