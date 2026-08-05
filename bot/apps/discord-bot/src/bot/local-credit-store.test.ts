import assert from 'node:assert/strict';
import test from 'node:test';
import { LocalCreditStore } from './local-credit-store.js';

test("local credit store persists a user's usage within its SQLite database", () => {
  const store = new LocalCreditStore(10, ':memory:');

  assert.equal(store.tryConsume('user-1', 3), true);
  assert.deepEqual(store.getUsage('user-1'), {
    usedCredits: 3,
    remainingCredits: 7,
    includedCredits: 10
  });
});

test('local credit store aggregates LLM usage by feature', () => {
  const store = new LocalCreditStore(10, ':memory:');
  store.recordModelUsage({ userId: 'user-1', feature: 'chat_llm', model: 'test-model', inputTokens: 11, outputTokens: 4, totalTokens: 15 });
  store.recordModelUsage({ userId: 'user-1', feature: 'chat_llm', model: 'test-model', inputTokens: 6, outputTokens: 3, totalTokens: 9 });
  store.recordModelUsage({ userId: 'user-1', feature: 'voice_llm', model: 'test-model', inputTokens: 7, outputTokens: 2, totalTokens: 9 });

  assert.deepEqual(store.getModelUsage('user-1'), [
    { feature: 'chat_llm', inputTokens: 17, outputTokens: 7, totalTokens: 24 },
    { feature: 'voice_llm', inputTokens: 7, outputTokens: 2, totalTokens: 9 }
  ]);
});