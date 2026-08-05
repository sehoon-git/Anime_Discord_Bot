import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { CreditStore, CreditUsage } from './credits.js';

export type LocalModelUsage = {
  feature: 'chat_llm' | 'voice_llm';
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export class LocalCreditStore implements CreditStore {
  private readonly database: DatabaseSync;

  constructor(
    private readonly initialCreditsPerUser: number,
    databasePath = resolve(process.cwd(), 'data', 'seline-local.sqlite')
  ) {
    if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true });
    this.database = new DatabaseSync(databasePath);
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS credit_balances (
        user_id TEXT PRIMARY KEY,
        remaining_credits INTEGER NOT NULL,
        used_credits INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS model_usage_events (
        id INTEGER PRIMARY KEY,
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        feature TEXT NOT NULL CHECK(feature IN ('chat_llm', 'voice_llm')),
        model TEXT NOT NULL,
        input_tokens INTEGER NOT NULL,
        output_tokens INTEGER NOT NULL,
        total_tokens INTEGER NOT NULL,
        created_at TEXT NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS model_usage_events_user_feature ON model_usage_events(user_id, feature, id DESC);
    `);
  }

  getBalance(userId: string): number {
    return this.getUsage(userId).remainingCredits;
  }

  getUsage(userId: string): CreditUsage {
    this.ensureUser(userId);
    const row = this.database
      .prepare('SELECT used_credits, remaining_credits FROM credit_balances WHERE user_id = ?')
      .get(userId) as CreditUsageRow;
    return {
      usedCredits: row.used_credits,
      remainingCredits: row.remaining_credits,
      includedCredits: row.used_credits + row.remaining_credits
    };
  }

  recordModelUsage(input: {
    userId: string;
    guildId?: string;
    feature: LocalModelUsage['feature'];
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  }): void {
    this.database
      .prepare(
        `INSERT INTO model_usage_events (user_id, guild_id, feature, model, input_tokens, output_tokens, total_tokens, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.userId,
        input.guildId ?? '',
        input.feature,
        input.model,
        input.inputTokens,
        input.outputTokens,
        input.totalTokens,
        new Date().toISOString()
      );
  }

  getModelUsage(userId: string): LocalModelUsage[] {
    const rows = this.database
      .prepare(
        `SELECT feature, SUM(input_tokens) AS input_tokens, SUM(output_tokens) AS output_tokens, SUM(total_tokens) AS total_tokens
         FROM model_usage_events WHERE user_id = ? GROUP BY feature ORDER BY feature`
      )
      .all(userId) as Array<{ feature: LocalModelUsage['feature']; input_tokens: number; output_tokens: number; total_tokens: number }>;
    return rows.map((row) => ({
      feature: row.feature,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      totalTokens: row.total_tokens
    }));
  }

  tryConsume(userId: string, amount: number): boolean {
    if (!Number.isInteger(amount) || amount < 0) throw new Error('Credit amount must be a non-negative integer.');
    this.ensureUser(userId);
    const result = this.database
      .prepare(
        `UPDATE credit_balances
         SET remaining_credits = remaining_credits - ?, used_credits = used_credits + ?, updated_at = ?
         WHERE user_id = ? AND remaining_credits >= ?`
      )
      .run(amount, amount, new Date().toISOString(), userId, amount);
    return result.changes === 1;
  }

  refund(userId: string, amount: number): void {
    if (!Number.isInteger(amount) || amount < 0) throw new Error('Credit amount must be a non-negative integer.');
    this.ensureUser(userId);
    this.database
      .prepare(
        `UPDATE credit_balances
         SET remaining_credits = remaining_credits + ?, used_credits = MAX(used_credits - ?, 0), updated_at = ?
         WHERE user_id = ?`
      )
      .run(amount, amount, new Date().toISOString(), userId);
  }

  private ensureUser(userId: string): void {
    this.database
      .prepare('INSERT OR IGNORE INTO credit_balances (user_id, remaining_credits, used_credits, updated_at) VALUES (?, ?, 0, ?)')
      .run(userId, this.initialCreditsPerUser, new Date().toISOString());
  }
}

type CreditUsageRow = {
  used_credits: number;
  remaining_credits: number;
};