import assert from 'node:assert/strict';
import test from 'node:test';
import { CreditExhaustedError, creditsForTokens, runWithTokenCredit, TestCreditStore } from './credits.js';

test('token usage is rounded up to the configured credit unit', () => {
  assert.equal(creditsForTokens(0, 100), 0);
  assert.equal(creditsForTokens(1, 100), 1);
  assert.equal(creditsForTokens(100, 100), 1);
  assert.equal(creditsForTokens(235, 100), 3);
});

test('successful Gemini response deducts credits based on total tokens', async () => {
  const store = new TestCreditStore(5);
  const delivered: string[] = [];

  await runWithTokenCredit({
    store,
    userId: 'user-1',
    operation: async () => ({ text: 'AI reply', usage: { totalTokens: 235 } }),
    creditCost: (reply) => creditsForTokens(reply.usage.totalTokens, 100),
    deliver: async (reply) => {
      delivered.push(reply.text);
    }
  });

  assert.deepEqual(delivered, ['AI reply']);
  assert.equal(store.getBalance('user-1'), 2);
});

test('failed Gemini response or Discord delivery does not keep charged credits', async () => {
  const store = new TestCreditStore(5);

  await assert.rejects(
    runWithTokenCredit({
      store,
      userId: 'user-2',
      operation: async () => {
        throw new Error('Gemini unavailable');
      },
      creditCost: () => 1,
      deliver: async () => undefined
    }),
    /Gemini unavailable/
  );
  assert.equal(store.getBalance('user-2'), 5);

  await assert.rejects(
    runWithTokenCredit({
      store,
      userId: 'user-2',
      operation: async () => ({ usage: { totalTokens: 200 } }),
      creditCost: (reply) => creditsForTokens(reply.usage.totalTokens, 100),
      deliver: async () => {
        throw new Error('Discord delivery failed');
      }
    }),
    /Discord delivery failed/
  );
  assert.equal(store.getBalance('user-2'), 5);
});

test('insufficient credit does not deliver the generated response', async () => {
  const store = new TestCreditStore(1);
  let delivered = false;

  await assert.rejects(
    runWithTokenCredit({
      store,
      userId: 'user-3',
      operation: async () => ({ usage: { totalTokens: 250 } }),
      creditCost: (reply) => creditsForTokens(reply.usage.totalTokens, 100),
      deliver: async () => {
        delivered = true;
      }
    }),
    CreditExhaustedError
  );

  assert.equal(delivered, false);
  assert.equal(store.getBalance('user-3'), 1);
});