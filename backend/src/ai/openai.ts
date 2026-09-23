import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import type { z } from 'zod';
import { env } from '../env.js';
import { repairMessage } from './prompts.js';

/** Ключ не задан — сразу переходим на локальные правила */
export class AiUnavailableError extends Error {}

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!env.openaiEnabled) throw new AiUnavailableError('OPENAI_API_KEY не задан');
  client ??= new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: env.OPENAI_TIMEOUT_MS, maxRetries: 1 });
  return client;
}

type Message = { role: 'system' | 'user'; content: string };

/**
 * Запрос со Structured Outputs: модель обязана вернуть JSON по схеме.
 * Ответ дополнительно проверяется zod; если проверка не прошла — один повтор
 * с описанием ошибки, после чего вызывающий код переходит на локальные правила.
 */
export async function askStructured<S extends z.ZodType>(opts: { system: string; user: string; schema: S; name: string }): Promise<z.infer<S>> {
  const openai = getClient();
  const base: Message[] = [
    { role: 'system', content: opts.system },
    { role: 'user', content: opts.user },
  ];
  let problem = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const input = attempt === 0 ? base : [...base, { role: 'user' as const, content: repairMessage(problem) }];
    const response = await openai.responses.parse({
      model: env.OPENAI_MODEL,
      reasoning: { effort: env.OPENAI_REASONING_EFFORT } as never,
      input,
      text: { format: zodTextFormat(opts.schema, opts.name) },
    });
    const parsed = response.output_parsed;
    if (parsed == null) {
      problem = 'пустой ответ или отказ модели';
      continue;
    }
    const check = opts.schema.safeParse(parsed);
    if (check.success) return check.data;
    problem = check.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
  }
  throw new Error(`ответ модели не прошёл проверку (${problem})`);
}

export function describeAiError(err: unknown): string {
  if (err instanceof AiUnavailableError) return 'Ключ OpenAI не задан — вопросы и карточка собраны по локальным правилам.';
  const message = err instanceof Error ? err.message : String(err);
  return `OpenAI недоступен (${message.slice(0, 160)}) — сработали локальные правила.`;
}
