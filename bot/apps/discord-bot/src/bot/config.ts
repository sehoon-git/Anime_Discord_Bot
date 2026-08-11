import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod';

loadProjectEnvironment();

const configSchema = z
  .object({
    DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN이 필요합니다.'),
    DISCORD_CLIENT_ID: z.string().min(1, 'DISCORD_CLIENT_ID가 필요합니다.'),
    DISCORD_GUILD_ID: z.string().trim().transform((value) => value || undefined).optional(),
    BOT_CONSOLE_PASSWORD: z.string().trim().transform((value) => value || undefined).optional(),
    BOT_API_BASE_URL: z.string().url().default('https://anime-discord-bot-rw3b.vercel.app'),
    SHARED_DEVELOPER_URL: z.string().url().optional(),
    BOT_SECRET_KEY: z.string().min(1).optional(),
    VOICE_SERVICE_BASE_URL: z.string().url().default('http://localhost:8000'),
    BOT_DEV_ECHO_MODE: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
    BOT_AUTO_REPLY_CHANNEL_ID: z.string().trim().transform((value) => value || undefined).optional(),
    BOT_TEST_DIRECT_GEMINI: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
    GEMINI_API_KEY: z.string().optional(),
    GEMINI_MODEL: z.string().min(1).default('gemini-3.5-flash-lite'),
    GEMINI_AVAILABLE_MODELS: z
      .string()
      .default('gemini-3.5-flash-lite,gemini-3.6-flash')
      .transform((value) => [...new Set(value.split(',').map((model) => model.trim()).filter(Boolean))]),
    GEMINI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(1).max(2_048).default(1024),
    BOT_UPGRADE_URL: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().url().optional()
    ),
    BOT_VOICE_CONSENT_URL: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().url().optional()
    ),
    // Local consent bypass is for isolated development only and is disabled by default.
    BOT_TEMP_VOICE_CONSENT_ALLOW: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
    BOT_TEST_CREDITS_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
    BOT_TEST_CREDITS_PER_USER: z.coerce.number().int().min(0).max(100_000).default(100),
    BOT_TOKENS_PER_CREDIT: z.coerce.number().int().min(1).max(100_000).default(100)
  })
  .superRefine((value, context) => {
    if (!value.BOT_DEV_ECHO_MODE && !value.BOT_SECRET_KEY) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['BOT_SECRET_KEY'],
        message: 'BOT_DEV_ECHO_MODE=false이면 BOT_SECRET_KEY가 필요합니다.'
      });
    }
    if (value.BOT_TEST_DIRECT_GEMINI && !value.GEMINI_API_KEY) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['GEMINI_API_KEY'],
        message: 'BOT_TEST_DIRECT_GEMINI=true이면 GEMINI_API_KEY가 필요합니다.'
      });
    }
    if (value.BOT_TEST_CREDITS_ENABLED && !value.BOT_TEST_DIRECT_GEMINI) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['BOT_TEST_CREDITS_ENABLED'],
        message: '테스트 토큰 크레딧은 BOT_TEST_DIRECT_GEMINI=true일 때만 사용할 수 있습니다.'
      });
    }
    if (!value.GEMINI_AVAILABLE_MODELS.includes(value.GEMINI_MODEL)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['GEMINI_AVAILABLE_MODELS'],
        message: 'GEMINI_AVAILABLE_MODELS must include GEMINI_MODEL.'
      });
    }
  });

export type BotConfig = z.infer<typeof configSchema>;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): BotConfig {
  return configSchema.parse(environment);
}

function loadProjectEnvironment(): void {
  let directory = process.cwd();
  while (true) {
    const candidates = [join(directory, '.env'), join(directory, 'bot', '.env')];
    for (const candidate of candidates) {
      if (!existsSync(candidate)) continue;
      process.loadEnvFile(candidate);
      return;
    }

    const parent = dirname(directory);
    if (parent === directory) return;
    directory = parent;
  }
}