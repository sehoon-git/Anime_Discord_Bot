import assert from 'node:assert/strict';
import test from 'node:test';
import { makeTextTurn, splitDiscordMessage } from './discord-text.js';

test('makeTextTurn creates a text envelope without audio data', () => {
  const turn = makeTextTurn({
    guildId: 'guild-1',
    channelId: 'channel-1',
    userId: 'user-1',
    text: '  hello  '
  });

  assert.equal(turn.modality, 'text');
  assert.equal(turn.canonicalText, 'hello');
  assert.equal(turn.conversationId, 'text:guild-1:channel-1:user-1');
  assert.equal('audio' in turn, false);
});

test('splitDiscordMessage keeps every chunk within Discord message limits', () => {
  const source = `${'가'.repeat(1_900)} ${'나'.repeat(1_900)}`;
  const chunks = splitDiscordMessage(source);

  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.length <= 2_000));
  assert.equal(chunks.join(' '), source);
});
