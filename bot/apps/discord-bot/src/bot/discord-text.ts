import { randomUUID } from 'node:crypto';
import type { TurnEnvelope } from '@anime/contracts';

export function makeTextTurn(input: {
  guildId?: string;
  channelId: string;
  userId: string;
  text: string;
}): TurnEnvelope {
  return {
    eventId: randomUUID(),
    guildId: input.guildId,
    channelId: input.channelId,
    userId: input.userId,
    conversationId: `text:${input.guildId ?? 'dm'}:${input.channelId}:${input.userId}`,
    modality: 'text',
    canonicalText: input.text.trim(),
    occurredAt: new Date().toISOString()
  };
}

export function splitDiscordMessage(text: string, maxLength = 2_000): string[] {
  const normalized = text.trim();
  if (!normalized) return ['응답 내용이 비어 있습니다.'];
  if (normalized.length <= maxLength) return [normalized];

  const chunks: string[] = [];
  let remaining = normalized;
  while (remaining.length > maxLength) {
    const preferredBreak = Math.max(remaining.lastIndexOf('\n', maxLength), remaining.lastIndexOf(' ', maxLength));
    const cutAt = preferredBreak > Math.floor(maxLength * 0.6) ? preferredBreak : maxLength;
    chunks.push(remaining.slice(0, cutAt).trimEnd());
    remaining = remaining.slice(cutAt).trimStart();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}
