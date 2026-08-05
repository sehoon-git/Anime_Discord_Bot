from __future__ import annotations

import unittest

import numpy as np

from voice_service.runtime import SpeechRequest, VoiceRuntime, gemini_tts_prompt, pcm_to_mono_float32, numeric_setting, string_setting
from voice_service.settings import Settings


class RuntimeTest(unittest.TestCase):
    def test_pcm_is_downmixed_from_stereo_to_mono(self) -> None:
        pcm = np.array([[32767, -32768], [16384, 16384]], dtype="<i2").tobytes()

        samples = pcm_to_mono_float32(pcm, max_pcm_bytes=64)

        np.testing.assert_allclose(samples, np.array([-1 / 65536, 0.5], dtype=np.float32), rtol=0, atol=1e-6)

    def test_pcm_rejects_misaligned_frames(self) -> None:
        with self.assertRaises(ValueError):
            pcm_to_mono_float32(b"abc", max_pcm_bytes=64)

    def test_settings_helpers_do_not_accept_booleans_as_speed(self) -> None:
        self.assertEqual(numeric_setting({"speed": True}, "speed", 0.95), 0.95)
        self.assertEqual(string_setting({"voice": "af_heart"}, "voice", "fallback"), "af_heart")


    def test_gemini_tts_english_prompt_uses_style_and_delivery_cues(self) -> None:
        prompt = gemini_tts_prompt(
            'en-US',
            {'style': 'warm and quietly playful'},
            '[softly] Hey, I missed you.'
        )

        self.assertIn('Perform the English transcript exactly as written.', prompt)
        self.assertIn('warm and quietly playful', prompt)
        self.assertIn('silent performance direction', prompt)
        self.assertIn('[softly] Hey, I missed you.', prompt)


    def test_gemini_tts_retries_an_empty_stream_once(self) -> None:
        runtime = VoiceRuntime(
            Settings(
                whisper_model="tiny",
                whisper_device="cpu",
                whisper_compute_type="int8",
                max_pcm_bytes=1024,
                ffmpeg_bin="ffmpeg",
                gemini_api_key="test-key",
            )
        )
        request = SpeechRequest(
            text="Hello there.",
            profile_id="test-profile",
            provider="gemini",
            language="en-US",
            settings={},
        )
        attempts = 0

        def fake_stream(_request):
            nonlocal attempts
            attempts += 1
            if attempts == 1:
                raise RuntimeError("Gemini TTS returned no audio stream.")
            yield np.array([0.0], dtype=np.float32)

        runtime._synthesize_gemini_stream_locked = fake_stream  # type: ignore[method-assign]
        chunks = list(runtime._synthesize_gemini_stream(request))

        self.assertEqual(attempts, 2)
        self.assertEqual(len(chunks), 1)

if __name__ == "__main__":
    unittest.main()
