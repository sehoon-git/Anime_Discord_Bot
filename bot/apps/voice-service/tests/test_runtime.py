from __future__ import annotations

import unittest

import numpy as np

from voice_service.runtime import pcm_to_mono_float32, numeric_setting, string_setting


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


if __name__ == "__main__":
    unittest.main()
