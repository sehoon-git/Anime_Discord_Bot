import assert from 'node:assert/strict';
import test from 'node:test';
import { voiceConsentRequiredNotice } from './voice-consent-notice.js';

test('includes the LoveAI voice-processing guidance and website link', () => {
  assert.equal(
    voiceConsentRequiredNotice('https://loveai.example/settings/voice'),
    [
      'Voice chat is locked until you allow voice processing on the LoveAI website.',
      'Please open the website, enable voice processing, then return to Discord.',
      '<https://loveai.example/settings/voice>'
    ].join('\n')
  );
});