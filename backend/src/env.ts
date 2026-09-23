import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

// backend/.env имеет приоритет, общий .env в корне проекта — запасной вариант
for (const file of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '..', '.env')]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL не задан — скопируйте .env.example в .env'),
  EXPRESS_PORT: z.coerce.number().int().positive().default(4000),
  FRONTEND_ORIGIN: z.string().default('http://localhost:3000'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-5.6-terra'),
  OPENAI_REASONING_EFFORT: z.enum(['none', 'minimal', 'low', 'medium', 'high']).default('low'),
  OPENAI_TIMEOUT_MS: z.coerce.number().int().positive().default(25000),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Ошибка конфигурации:', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  process.exit(1);
}

const placeholderKey = (key?: string) => !key || key.trim() === '' || key.includes('your_openai_api_key');

export const env = {
  ...parsed.data,
  /** Ключ OpenAI задан по-настоящему (не плейсхолдер из .env.example) */
  openaiEnabled: !placeholderKey(parsed.data.OPENAI_API_KEY),
};
