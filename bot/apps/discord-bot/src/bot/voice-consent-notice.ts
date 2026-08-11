export function voiceConsentRequiredNotice(websiteUrl: string): string {
  return [
    'Voice chat is locked until you allow voice processing on the LoveAI website.',
    'Please open the website, enable voice processing, then return to Discord.',
    `<${websiteUrl}>`
  ].join('\n');
}