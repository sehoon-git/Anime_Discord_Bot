import assert from 'node:assert/strict';
import test from 'node:test';
import { formatRemainingUsage } from './usage-display.js';

test('formatRemainingUsage shows the remaining-credit percentage in Korean', () => {
  const filled = '█'.repeat(18);
  const empty = '░'.repeat(2);

  assert.equal(
    formatRemainingUsage({ usedCredits: 11, remainingCredits: 89, includedCredits: 100 }, 'ko'),
    `\`${filled}${empty}\`\n\n## 89% 남음`
  );
});

test('formatRemainingUsage shows the remaining-credit percentage in English', () => {
  assert.equal(
    formatRemainingUsage({ usedCredits: 100, remainingCredits: 0, includedCredits: 100 }, 'en-US'),
    `\`${'░'.repeat(20)}\`\n\n## 0% remaining`
  );
});
