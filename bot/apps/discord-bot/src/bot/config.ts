import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod';

loadProjectEnvironment();

const configSchema = z
  .object({
    DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN이 필요합니다.'),
    DISCORD_CLIENT_ID: z.string().min(1, 'DISCORD_CLIENT_ID가 필요합니다.'),
    DISCORD_GUILD_ID: z.string().trim().transform((value) => value || undefined).optional(),
    BOT_API_BASE_URL: z.string().url().default('http://localhost:3001'),
    // Vercel의 BOT_SECRET_KEY와 같아야 합니다. 봇 전용 API 인증에만 사용합니다.
    BOT_SECRET_KEY: z.string().trim().transform((value) => value || undefined).optional(),
    VOICE_SERVICE_BASE_URL: z.string().url().default('http://localhost:8000'),
    BOT_DEV_ECHO_MODE: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
    BOT_AUTO_REPLY_CHANNEL_ID: z.string().trim().transform((value) => value || undefined).optional(),
    BOT_TEST_DIRECT_GEMINI: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
    GEMINI_API_KEY: z.string().optional(),
    GEMINI_MODEL: z.string().min(1).default('gemini-3.6-flash'),
    GEMINI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(1).max(2_048).default(1024),
    BOT_TEST_CREDITS_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
    BOT_TEST_CREDITS_PER_USER: z.coerce.number().int().min(0).max(100_000).default(100),
    BOT_TOKENS_PER_CREDIT: z.coerce.number().int().min(1).max(100_000).default(100)
  })
  .superRefine((value, context) => {
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
  });

export type BotConfig = z.infer<typeof configSchema>;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): BotConfig {
  return configSchema.parse(environment);
}

function loadProjectEnvironment(): void {
  let directory = process.cwd();
  while (true) {
    const candidate = join(directory, '.env');
    if (existsSync(candidate)) {
      process.loadEnvFile(candidate);
      return;
    }

    const parent = dirname(directory);
    if (parent === directory) return;
    directory = parent;
  }
}
