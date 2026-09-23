import { z } from 'zod';
import { CARD_FIELDS, type CardField, type CardFields, type CriterionId } from '../scoring/scoring.js';

const CRITERION_IDS = ['contextNeed', 'data', 'result', 'success', 'constraints', 'users', 'link'] as const;

/** Поля карточки в ответе модели: все обязательны, пустая строка = сведений нет */
export const FieldsSchema = z.object({
  context: z.string(),
  need: z.string(),
  users: z.string(),
  data: z.string(),
  constraints: z.string(),
  expectedResult: z.string(),
  successCriteria: z.string(),
  contact: z.string(),
  format: z.string(),
});

/** Ответ модели на шаге «разбор черновика» */
export const AnalyzeOutputSchema = z.object({
  title: z.string(),
  fields: FieldsSchema,
  questions: z.array(
    z.object({
      criterion: z.enum(CRITERION_IDS),
      field: z.enum(CARD_FIELDS),
      question: z.string(),
      why: z.string(),
    }),
  ),
});
export type AnalyzeOutput = z.infer<typeof AnalyzeOutputSchema>;

/** Ответ модели на шаге «сборка карточки из ответов» */
export const StructureOutputSchema = z.object({
  title: z.string(),
  fields: FieldsSchema,
});
export type StructureOutput = z.infer<typeof StructureOutputSchema>;

export type AiSource = 'openai' | 'rules';

export interface ClarifyingQuestion {
  id: string;
  criterion: CriterionId;
  field: CardField;
  text: string;
  why: string;
  answer: string;
}

/** Что хранится в Task.clarification */
export interface Clarification {
  source: AiSource;
  model: string | null;
  analyzedAt: string;
  /** Что удалось разложить из черновика (ещё не подтверждено бизнесом) */
  extracted: { title: string; fields: CardFields };
  questions: ClarifyingQuestion[];
  warnings: string[];
  /** Карточка, собранная из ответов, ждёт подтверждения бизнесом */
  proposed?: { title: string; fields: CardFields; source: AiSource; model: string | null; warnings: string[]; createdAt: string } | null;
}
