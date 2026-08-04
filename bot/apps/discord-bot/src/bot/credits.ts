export class CreditExhaustedError extends Error {
  constructor(requiredCredits: number, availableCredits: number) {
    super(`❌ 크레딧이 부족합니다. 이번 답변에는 ${requiredCredits} 크레딧이 필요하지만 ${availableCredits} 크레딧만 남았습니다.`);
    this.name = 'CreditExhaustedError';
  }
}

/**
 * 봇 검증 전용 메모리 잔액입니다. 재시작하면 유저별 잔액도 초기화됩니다.
 * 실제 서비스에서는 PostgreSQL 원장과 결제 권한(entitlement)으로 교체합니다.
 */
export class TestCreditStore {
  private readonly balances = new Map<string, number>();

  constructor(private readonly initialCreditsPerUser: number) {
    if (!Number.isInteger(initialCreditsPerUser) || initialCreditsPerUser < 0) {
      throw new Error('initialCreditsPerUser는 0 이상의 정수여야 합니다.');
    }
  }

  getBalance(userId: string): number {
    return this.balances.get(userId) ?? this.initialCreditsPerUser;
  }

  tryConsume(userId: string, amount: number): boolean {
    if (!Number.isInteger(amount) || amount < 0) throw new Error('차감 크레딧은 0 이상의 정수여야 합니다.');
    const balance = this.getBalance(userId);
    if (balance < amount) return false;
    this.balances.set(userId, balance - amount);
    return true;
  }

  refund(userId: string, amount: number): void {
    if (!Number.isInteger(amount) || amount < 0) throw new Error('환불 크레딧은 0 이상의 정수여야 합니다.');
    this.balances.set(userId, this.getBalance(userId) + amount);
  }
}

export function creditsForTokens(totalTokens: number, tokensPerCredit: number): number {
  if (!Number.isSafeInteger(totalTokens) || totalTokens < 0) throw new Error('totalTokens는 0 이상의 안전한 정수여야 합니다.');
  if (!Number.isSafeInteger(tokensPerCredit) || tokensPerCredit <= 0) {
    throw new Error('tokensPerCredit은 1 이상의 안전한 정수여야 합니다.');
  }
  return Math.ceil(totalTokens / tokensPerCredit);
}

/**
 * Gemini가 반환한 실제 totalTokenCount로 비용을 계산한다.
 * 답장 전 차감하며 Discord 전송이 실패하면 즉시 환불한다.
 * 테스트용 사후 차감 방식이므로 운영 전에는 countTokens 기반의 사전 승인으로 바꾼다.
 */
export async function runWithTokenCredit<T>(input: {
  store?: TestCreditStore;
  userId: string;
  beforeRun?: () => Promise<void>;
  operation: () => Promise<T>;
  creditCost: (result: T) => number;
  deliver: (result: T) => Promise<void>;
}): Promise<T> {
  let chargedCredits = 0;
  let creditWasDeducted = false;
  try {
    await input.beforeRun?.();
    const result = await input.operation();
    chargedCredits = input.store ? input.creditCost(result) : 0;

    if (input.store && !input.store.tryConsume(input.userId, chargedCredits)) {
      throw new CreditExhaustedError(chargedCredits, input.store.getBalance(input.userId));
    }
    creditWasDeducted = Boolean(input.store && chargedCredits > 0);
    await input.deliver(result);
    return result;
  } catch (error) {
    if (input.store && creditWasDeducted) input.store.refund(input.userId, chargedCredits);
    throw error;
  }
}