import assert from 'node:assert/strict';
import test from 'node:test';
import { discordLoveAiHelp, localConsoleHelp } from './help-text.js';

test('console help lists only console-local commands with Korean explanations', () => {
  const help = localConsoleHelp().join('\n');

  assert.match(help, /로컬 콘솔 명령어/);
  assert.match(help, /help - 이 콘솔에서 사용할 수 있는 명령어/);
  assert.match(help, /status <서버 ID> - Discord 연결 상태/);
  assert.match(help, /voice leave <서버 ID> - 해당 서버/);
  assert.doesNotMatch(help, /\/loveai/);
});

test('Discord help is localized and excludes process-local commands', () => {
  const english = discordLoveAiHelp('en-US');
  const korean = discordLoveAiHelp('ko');

  assert.match(english, /\*\*LoveAI help\*\*/);
  assert.match(english, /\/loveai voicejoin/);
  assert.match(korean, /\*\*LoveAI 도움말\*\*/);
  assert.match(korean, /셀린에게 텍스트 메시지를 보냅니다/);
  assert.doesNotMatch(english, /status <guild-id>|voice leave <guild-id>|로컬 콘솔/);
  assert.doesNotMatch(korean, /status <서버 ID>|voice leave <서버 ID>|로컬 콘솔/);
});
