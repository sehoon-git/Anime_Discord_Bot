export type CommandLanguage = 'en-US' | 'ko';

export function commandText(language: CommandLanguage, english: string, korean: string): string {
  return language === 'ko' ? korean : english;
}
