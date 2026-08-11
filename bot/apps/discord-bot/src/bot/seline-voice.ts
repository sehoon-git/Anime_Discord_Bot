import type { VoiceProfile } from '@anime/contracts';

export type SelineVoiceDelivery = 'normal' | 'playful' | 'soft' | 'whisper';

type VoiceDeliveryInput = {
  userText: string;
  assistantText?: string;
};

const SELINE_VOICE = 'Leda';

const DELIVERY_SETTINGS: Record<SelineVoiceDelivery, { style: string; gainDb: number }> = {
  normal: {
    gainDb: 0,
    style:
      'A warm, youthful adult woman in a one-to-one voice chat. Sound present, natural, and conversational. Let meaning create small believable shifts in pace, warmth, curiosity, or amusement; do not flatten every line into the same friendly tone. Keep the pitch natural and the articulation clear; never sound like an announcer, a child, or a caricature.'
  },
  playful: {
    gainDb: 0.5,
    style:
      'A bright, warm, youthful adult woman in a one-to-one voice chat. Let a small smile and light playfulness come through naturally. Keep the pitch natural, the words clear, and the energy believable; never use baby talk, sing-song delivery, or exaggerated cuteness.'
  },
  soft: {
    gainDb: 1,
    style:
      'A warm, youthful adult woman speaking gently in a one-to-one voice chat. Be calm, reassuring, and emotionally grounded, with a relaxed pace and clear articulation. Keep it intimate but everyday, never breathy or theatrical.'
  },
  whisper: {
    gainDb: 2.5,
    style:
      'A warm, youthful adult woman speaking in a quiet conversational whisper. Use only subtle breathiness and keep every word fully intelligible at normal Discord listening volume. Use a measured pace. Do not add ASMR mouth sounds, sensual delivery, theatrical suspense, or extra sound effects.'
  }
};

export function createSelineVoiceProfile(
  delivery: SelineVoiceDelivery = 'normal',
  language: 'en-US' | 'ko' = 'en-US'
): VoiceProfile {
  const settings = DELIVERY_SETTINGS[delivery];
  return {
    id: `${language === 'ko' ? 'ko' : 'en'}-female-seline-leda-${delivery}-v2`,
    version: 2,
    provider: 'gemini',
    language,settings: {
      voice: SELINE_VOICE,
      delivery,
      gainDb: settings.gainDb,
      style: settings.style
    },
    status: 'published'
  };
}

/**
 * Whispering is opt-in: it must be explicitly requested in the user's words.
 * Other cues can soften or brighten a reply but never turn it into a whisper.
 */
export function selectSelineVoiceProfile(input: VoiceDeliveryInput): VoiceProfile {
  return createSelineVoiceProfile(
    selectSelineVoiceDelivery(input),
    /[\uac00-\ud7a3]/u.test(input.assistantText ?? input.userText) ? 'ko' : 'en-US'
  );
}

export function selectSelineVoiceDelivery(input: VoiceDeliveryInput): SelineVoiceDelivery {
  if (explicitlyRequestsWhisper(input.userText)) return 'whisper';

  const cue = input.assistantText?.match(/^\s*\[([^\]]+)\]/i)?.[1]?.toLowerCase();
  if (cue === 'softly' || cue === 'warmly') return 'soft';
  if (cue === 'smiles' || cue === 'gently teasing' || cue === 'a small laugh') return 'playful';
  return 'normal';
}

function explicitlyRequestsWhisper(text: string): boolean {
  return /\b(?:whisper|whispering|in a whisper|speak quietly|say it quietly|talk quietly)\b/i.test(text)
    || /(?:속삭|귓속말|작게\s*(?:말|얘기)|조용히\s*(?:말|얘기))/u.test(text);
}
