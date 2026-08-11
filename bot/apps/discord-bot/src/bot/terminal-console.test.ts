import assert from 'node:assert/strict';
import test from 'node:test';
import { ConsolePasswordGuard, completeTerminalCommand, inlineTerminalSuggestion, searchLogLines, terminalModeStatus, terminalSearchResult, terminalSearchStatus, toggleTerminalLogMode } from './terminal-console.js';

test('Tab completion suggests supported CUI commands from a prefix', () => {
  assert.deepEqual(completeTerminalCommand('vo'), [['voice leave'], 'vo']);
  assert.deepEqual(completeTerminalCommand('voice l'), [['voice leave'], 'voice l']);
  assert.deepEqual(completeTerminalCommand('logs'), [['logs compact', 'logs detail'], 'logs']);
  assert.deepEqual(completeTerminalCommand(''), [['help', 'status', 'announce', 'logs compact', 'logs detail', 'voice leave', 'clear', 'restart', 'exit'], '']);
});

test('inline suggestions show a dimmable suffix or the available Tab choices', () => {
  assert.equal(inlineTerminalSuggestion('vo'), 'ice leave');
  assert.equal(inlineTerminalSuggestion('logs'), '  [Tab: logs compact | logs detail]');
  assert.equal(inlineTerminalSuggestion('logs d'), 'etail');
  assert.equal(inlineTerminalSuggestion('unknown'), '');
});

test('terminal status renders for both log modes', () => {
  assert.equal(typeof terminalModeStatus('detail'), 'string');
  assert.equal(typeof terminalModeStatus('compact'), 'string');
});

test('toggles detailed logging between detail and compact modes', () => {
  assert.equal(toggleTerminalLogMode('compact'), 'detail');
  assert.equal(toggleTerminalLogMode('detail'), 'compact');
});

test('console password locks after five failed attempts for 30 seconds', () => {
  const guard = new ConsolePasswordGuard('correct password');
  for (let attempt = 1; attempt < 5; attempt += 1) {
    const result = guard.submit('incorrect', 1_000);
    assert.equal(result.locked, false);
    assert.equal(result.remainingAttempts, 5 - attempt);
  }
  const locked = guard.submit('incorrect', 1_000);
  assert.deepEqual(locked, { authenticated: false, locked: true, remainingAttempts: 0, lockRemainingMs: 30_000 });
  assert.equal(guard.submit('correct password', 30_999).locked, true);
  assert.equal(guard.submit('correct password', 31_000).authenticated, true);
});

test('log search finds case-insensitive matches and shows navigable result status', () => {
  const matches = searchLogLines([
    '[10:00:00] INFO [bot] Ready',
    '[10:01:00] WARNING [voice] Connection lost',
    '[10:02:00] INFO [voice] Reconnected'
  ], 'VOICE');

  assert.deepEqual(matches, [
    '[10:01:00] WARNING [voice] Connection lost',
    '[10:02:00] INFO [voice] Reconnected'
  ]);
  assert.match(terminalSearchResult('voice', matches.length, 1, matches[1]), /2\/2: \[10:02:00\]/);
  assert.match(terminalSearchStatus('voice', matches.length, 1), /2\/2 matches/);
  assert.match(terminalSearchStatus('missing', 0, 0), /No matches/);
});