import { env } from '../env.js';
import { FIELD_LABELS } from '../domain.js';
import { CARD_FIELDS, evaluate, normalizeFields, type CardField, type CardFields } from '../scoring/scoring.js';
import { applyAnswers, extractByRules, questionsByRules } from './fallback.js';
import { unsupportedFacts } from './guard.js';
import { askStructured, describeAiError } from './openai.js';
import { ANALYZE_SYSTEM_PROMPT, STRUCTURE_SYSTEM_PROMPT, analyzeUserMessage, structureUserMessage } from './prompts.js';
import { AnalyzeOutputSchema, StructureOutputSchema, type Clarification, type ClarifyingQuestion } from './schemas.js';

const MAX_QUESTIONS = 6;

/** Баллы, которые приносит конкретное поле (по проверкам этого поля) */
function fieldPoints(fields: CardFields, field: CardField): number {
  return evaluate(fields).criteria.flatMap((c) => c.checks).filter((ch) => ch.field === field && ch.ok).reduce((s, ch) => s + ch.points, 0);
}

/** Шаг 1. Разобрать черновик: поля из слов бизнеса и минимум три уточняющих вопроса */
export async function analyzeDraft(input: { rawDraft: string; topic: string; businessName: string; contact: string }): Promise<Clarification> {
  const analyzedAt = new Date().toISOString();
  const rules = extractByRules(input.rawDraft);
  rules.fields.contact = input.contact;

  try {
    const out = await askStructured({ system: ANALYZE_SYSTEM_PROMPT, user: analyzeUserMessage(input), schema: AnalyzeOutputSchema, name: 'draft_analysis' });
    const warnings: string[] = [];
    const fields = normalizeFields(out.fields);
    fields.contact = input.contact;

    // Защита от выдуманных фактов: всё, чего нет в черновике, заменяем словами самого бизнеса
    for (const f of CARD_FIELDS) {
      if (f === 'contact' || !fields[f]) continue;
      const extra = unsupportedFacts(fields[f], input.rawDraft);
      if (extra.length) {
        warnings.push(`«${FIELD_LABELS[f]}»: убрали «${extra.join(', ')}» — этого нет в черновике.`);
        fields[f] = rules.fields[f];
      }
    }
    let title = out.title.trim();
    if (!title || unsupportedFacts(title, input.rawDraft).length) title = rules.title;

    const seen = new Set<CardField>();
    let questions: ClarifyingQuestion[] = [];
    for (const q of out.questions) {
      const text = q.question.trim();
      if (!text || seen.has(q.field) || q.field === 'contact') continue;
      seen.add(q.field);
      questions.push({ id: '', criterion: q.criterion, field: q.field, text, why: q.why.trim(), answer: '' });
    }
    questions = questions.slice(0, MAX_QUESTIONS);
    if (questions.length < 3) {
      const extra = questionsByRules(fields).filter((q) => !seen.has(q.field));
      questions = [...questions, ...extra].slice(0, Math.max(3, questions.length));
      warnings.push('Модель задала меньше трёх вопросов — добавили вопросы по шаблону.');
    }
    questions = questions.map((q, i) => ({ ...q, id: `q${i + 1}` }));

    return { source: 'openai', model: env.OPENAI_MODEL, analyzedAt, extracted: { title, fields }, questions, warnings, proposed: null };
  } catch (err) {
    return {
      source: 'rules',
      model: null,
      analyzedAt,
      extracted: rules,
      questions: questionsByRules(rules.fields),
      warnings: [describeAiError(err)],
      proposed: null,
    };
  }
}

/** Поля до ответов: подтверждённые значения, а где их нет — то, что разобрали из черновика */
export function baseFields(confirmed: CardFields, clarification: Clarification | null): CardFields {
  const out = { ...confirmed };
  if (!clarification) return out;
  for (const f of CARD_FIELDS) {
    if (!out[f].trim() && clarification.extracted.fields[f]) out[f] = clarification.extracted.fields[f];
  }
  return out;
}

/** Предварительный расчёт, пока бизнес отвечает: ответы ложатся в поля по правилам, без модели */
export function previewFields(confirmed: CardFields, clarification: Clarification | null): CardFields {
  const base = baseFields(confirmed, clarification);
  return clarification ? applyAnswers(base, clarification.questions) : base;
}

/** Шаг 2. Собрать карточку из черновика и ответов — результат ждёт подтверждения человеком */
export async function structureAnswers(input: {
  rawDraft: string;
  topic: string;
  title: string;
  confirmed: CardFields;
  clarification: Clarification;
}): Promise<NonNullable<Clarification['proposed']>> {
  const createdAt = new Date().toISOString();
  const base = baseFields(input.confirmed, input.clarification);
  const byRules = applyAnswers(base, input.clarification.questions);
  const answered = input.clarification.questions.filter((q) => q.answer.trim());
  const source = [input.rawDraft, ...Object.values(base), ...answered.map((q) => q.answer)].join('\n');
  const title = input.title || input.clarification.extracted.title;

  try {
    const out = await askStructured({
      system: STRUCTURE_SYSTEM_PROMPT,
      user: structureUserMessage({
        rawDraft: input.rawDraft,
        topic: input.topic,
        fields: base,
        qa: input.clarification.questions.map((q) => ({ field: q.field, question: q.text, answer: q.answer })),
      }),
      schema: StructureOutputSchema,
      name: 'task_card',
    });
    const warnings: string[] = [];
    const fields = normalizeFields(out.fields);
    if (!fields.contact) fields.contact = base.contact;

    for (const f of CARD_FIELDS) {
      const extra = fields[f] ? unsupportedFacts(fields[f], source) : [];
      if (extra.length) {
        warnings.push(`«${FIELD_LABELS[f]}»: ИИ добавил «${extra.join(', ')}» — этого нет в ваших ответах, оставили ваш текст.`);
        fields[f] = byRules[f];
      } else if (fieldPoints(fields, f) < fieldPoints(byRules, f)) {
        // Модель сократила текст и потеряла сведения — возвращаем формулировку бизнеса
        warnings.push(`«${FIELD_LABELS[f]}»: в сжатом варианте терялись сведения — оставили ваш текст.`);
        fields[f] = byRules[f];
      }
    }
    let outTitle = out.title.trim();
    if (!outTitle || unsupportedFacts(outTitle, source).length) outTitle = title;

    return { title: outTitle, fields, source: 'openai', model: env.OPENAI_MODEL, warnings, createdAt };
  } catch (err) {
    return { title, fields: byRules, source: 'rules', model: null, warnings: [describeAiError(err)], createdAt };
  }
}
