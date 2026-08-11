import type { CommandLanguage } from './command-language.js';

export type UsageSummary = {
  usedCredits: number;
  remainingCredits: number;
  includedCredits: number;
};

const PROGRESS_BAR_SEGMENTS = 20;

export function formatRemainingUsage(usage: UsageSummary, language: CommandLanguage): string {
  const remainingPercent = percentage(usage.remainingCredits, usage.includedCredits);
  const filledSegments = Math.round((remainingPercent / 100) * PROGRESS_BAR_SEGMENTS);
  const progressBar = `${'█'.repeat(filledSegments)}${'░'.repeat(PROGRESS_BAR_SEGMENTS - filledSegments)}`;
  const label = language === 'ko' ? '남음' : 'remaining';

  return `\`${progressBar}\`\n\n## ${remainingPercent}% ${label}`;
}

function percentage(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}
