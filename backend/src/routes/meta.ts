import { Router } from 'express';
import { z } from 'zod';
import { env } from '../env.js';
import { FIELD_LABELS, FIELD_PLACEHOLDERS, TOPICS } from '../domain.js';
import { ANALYZE_SYSTEM_PROMPT, STRUCTURE_SYSTEM_PROMPT, analyzeUserMessage, structureUserMessage } from '../ai/prompts.js';
import { AnalyzeOutputSchema, StructureOutputSchema } from '../ai/schemas.js';
import { parseBody } from '../lib/http.js';
import { CARD_FIELDS, CRITERIA_DEFS, emptyFields, evaluate, formulaMeta } from '../scoring/scoring.js';

export const metaRouter = Router();

const FIELD_CRITERION = Object.fromEntries(CRITERIA_DEFS.flatMap((c) => c.checks.map((ch) => [ch.field, c.id])));

metaRouter.get('/health', (_req, res) => {
  res.json({ ok: true });
});

/** Формула, уровни, темы и поля — чтобы интерфейс не дублировал справочники */
metaRouter.get('/meta', (_req, res) => {
  res.json({
    ...formulaMeta(),
    topics: TOPICS,
    fields: CARD_FIELDS.map((id) => ({ id, label: FIELD_LABELS[id], placeholder: FIELD_PLACEHOLDERS[id], criterion: FIELD_CRITERION[id] })),
  });
});

/** Предварительный расчёт рейтинга для неподтверждённых правок */
metaRouter.post('/score/preview', (req, res) => {
  const { fields } = parseBody(z.object({ fields: z.record(z.string(), z.string().max(2000)) }), req.body);
  res.json(evaluate({ ...emptyFields(), ...fields }));
});

/** Прозрачность ИИ: промпты, формат входа и выхода, обработка некорректного ответа */
metaRouter.get('/ai/info', (_req, res) => {
  res.json({
    enabled: env.openaiEnabled,
    provider: env.openaiEnabled ? 'OpenAI Responses API' : 'локальные правила (ключ не задан)',
    model: env.OPENAI_MODEL,
    reasoningEffort: env.OPENAI_REASONING_EFFORT,
    steps: [
      {
        id: 'analyze',
        title: 'Разбор черновика и уточняющие вопросы',
        endpoint: 'POST /api/tasks',
        systemPrompt: ANALYZE_SYSTEM_PROMPT,
        inputExample: analyzeUserMessage({ rawDraft: 'Курьеры часто опаздывают, клиенты жалуются. Нужна какая-то система, чтобы это исправить.', topic: 'Логистика', businessName: 'Жетісу Логистик' }),
        outputSchema: z.toJSONSchema(AnalyzeOutputSchema),
      },
      {
        id: 'structure',
        title: 'Сборка карточки из ответов',
        endpoint: 'POST /api/tasks/:id/structure',
        systemPrompt: STRUCTURE_SYSTEM_PROMPT,
        inputExample: structureUserMessage({
          rawDraft: 'Курьеры часто опаздывают, клиенты жалуются. Нужна какая-то система, чтобы это исправить.',
          topic: 'Логистика',
          fields: { ...emptyFields(), context: 'Курьеры часто опаздывают, клиенты жалуются.', need: 'Нужна система, чтобы сократить опоздания.' },
          qa: [{ field: 'data', question: 'Какие данные о доставках у вас есть?', answer: 'Выгрузка из 1С за 6 месяцев — около 48 000 доставок в Excel.' }],
        }),
        outputSchema: z.toJSONSchema(StructureOutputSchema),
      },
    ],
    safeguards: [
      'Structured Outputs: модель обязана вернуть JSON по схеме, ответ дополнительно проверяется zod.',
      'Если JSON не прошёл проверку, запрос повторяется один раз с описанием ошибки.',
      'Ошибка сети, таймаут, отказ модели или повторная ошибка схемы — сработают локальные правила, интерфейс покажет предупреждение.',
      'Меньше трёх вопросов — недостающие добавляются из шаблонов по самым весомым пустым пунктам.',
      'Проверка фактов: число или латинское название, которого нет в словах бизнеса, отменяет поле — остаётся текст самого бизнеса.',
      'Если в сжатом ИИ варианте поле теряет баллы, остаётся формулировка бизнеса.',
      'Баллы считает формула, а не модель. Карточка попадает в каталог только после подтверждения человеком.',
    ],
  });
});
