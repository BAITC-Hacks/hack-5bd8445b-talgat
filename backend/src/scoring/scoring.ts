/**
 * Рейтинг готовности задачи — чистая функция без ИИ и без обращения к БД.
 * Веса из кейса: 20 / 20 / 15 / 15 / 10 / 10 / 10 = 100.
 * Каждый критерий разбит на проверки с понятной подписью, поэтому любой балл можно объяснить.
 */

export const CARD_FIELDS = [
  'context',
  'need',
  'users',
  'data',
  'constraints',
  'expectedResult',
  'successCriteria',
  'contact',
  'format',
] as const;

export type CardField = (typeof CARD_FIELDS)[number];
export type CardFields = Record<CardField, string>;

export type CriterionId = 'contextNeed' | 'data' | 'result' | 'success' | 'constraints' | 'users' | 'link';
export type LevelId = 'DRAFT' | 'WORKING' | 'READY' | 'PRIORITY';

export interface Level {
  id: LevelId;
  name: string;
  min: number;
  max: number;
  note: string;
}

export const LEVELS: Level[] = [
  { id: 'DRAFT', name: 'Черновик', min: 0, max: 39, note: 'видна в каталоге, но требует уточнения' },
  { id: 'WORKING', name: 'Рабочая', min: 40, max: 69, note: 'можно откликаться, система может рекомендовать' },
  { id: 'READY', name: 'Готовая', min: 70, max: 89, note: 'повышенная позиция в каталоге' },
  { id: 'PRIORITY', name: 'Приоритетная', min: 90, max: 100, note: 'полностью готова и выделена в каталоге' },
];

export function levelOf(score: number): Level {
  return LEVELS.find((l) => score >= l.min && score <= l.max) ?? LEVELS[0];
}

const len = (v: string | undefined) => (v ?? '').trim().length;
const DATA_HINT = /\d|excel|xlsx|csv|json|api|sql|1с|1c|выгрузк|таблиц|http/i;
const RESULT_HINT = /прототип|отч[её]т|бот|сайт|приложени|дашборд|модел|алгоритм|api|mvp|сервис|скрипт|интерфейс|панел/i;
const DATE_HINT = /недел|месяц|дн[ейя]|срок|квартал|январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр|до \d/i;

interface CheckDef {
  label: string;
  points: number;
  field: CardField;
  test: (f: CardFields) => boolean;
}

interface CriterionDef {
  id: CriterionId;
  name: string;
  short: string;
  max: number;
  hint: string;
  checks: CheckDef[];
}

export const CRITERIA_DEFS: CriterionDef[] = [
  {
    id: 'contextNeed', name: 'Контекст и потребность', short: 'Контекст', max: 20,
    hint: 'Понятно, что происходит сейчас и что необходимо изменить',
    checks: [
      { label: 'Описана текущая ситуация', points: 8, field: 'context', test: (f) => len(f.context) >= 30 },
      { label: 'Есть подробности: где, когда, как часто', points: 6, field: 'context', test: (f) => len(f.context) >= 100 || /\d/.test(f.context) },
      { label: 'Понятно, что нужно изменить', points: 6, field: 'need', test: (f) => len(f.need) >= 25 },
    ],
  },
  {
    id: 'data', name: 'Данные и материалы', short: 'Данные', max: 20,
    hint: 'Указаны доступные данные, примеры или источники',
    checks: [
      { label: 'Перечислены доступные данные', points: 10, field: 'data', test: (f) => len(f.data) >= 30 },
      { label: 'Указан объём, формат или источник', points: 10, field: 'data', test: (f) => len(f.data) >= 30 && DATA_HINT.test(f.data) },
    ],
  },
  {
    id: 'result', name: 'Ожидаемый результат', short: 'Результат', max: 15,
    hint: 'Описан конкретный результат работы команды',
    checks: [
      { label: 'Описан результат работы команды', points: 10, field: 'expectedResult', test: (f) => len(f.expectedResult) >= 30 },
      { label: 'Назван формат: прототип, отчёт, модель', points: 5, field: 'expectedResult', test: (f) => RESULT_HINT.test(f.expectedResult) },
    ],
  },
  {
    id: 'success', name: 'Критерии успеха', short: 'Успех', max: 15,
    hint: 'Есть измеримые признаки принятия решения',
    checks: [
      { label: 'Есть признак приёмки', points: 8, field: 'successCriteria', test: (f) => len(f.successCriteria) >= 20 },
      { label: 'Признак измерим: число, доля или срок', points: 7, field: 'successCriteria', test: (f) => /\d/.test(f.successCriteria) },
    ],
  },
  {
    id: 'constraints', name: 'Ограничения', short: 'Рамки', max: 10,
    hint: 'Указаны сроки, технологии, доступы или иные границы',
    checks: [
      { label: 'Указан срок', points: 5, field: 'constraints', test: (f) => DATE_HINT.test(f.constraints) },
      { label: 'Названы технологии, доступы или иные границы', points: 5, field: 'constraints', test: (f) => len(f.constraints) >= 40 },
    ],
  },
  {
    id: 'users', name: 'Пользователи', short: 'Люди', max: 10,
    hint: 'Понятно, для кого создаётся решение',
    checks: [
      { label: 'Понятно, для кого решение', points: 10, field: 'users', test: (f) => len(f.users) >= 15 },
    ],
  },
  {
    id: 'link', name: 'Связь с бизнесом', short: 'Связь', max: 10,
    hint: 'Есть контакт, формат консультаций и порядок обратной связи',
    checks: [
      { label: 'Есть контактное лицо', points: 5, field: 'contact', test: (f) => len(f.contact) >= 5 },
      { label: 'Описан формат консультаций и обратной связи', points: 5, field: 'format', test: (f) => len(f.format) >= 20 },
    ],
  },
];

export interface CheckResult {
  label: string;
  points: number;
  field: CardField;
  ok: boolean;
}

export interface CriterionResult {
  id: CriterionId;
  name: string;
  short: string;
  max: number;
  earned: number;
  checks: CheckResult[];
}

export interface MissingItem {
  criterionId: CriterionId;
  criterion: string;
  label: string;
  points: number;
  field: CardField;
}

export interface Evaluation {
  total: number;
  level: Level;
  criteria: CriterionResult[];
  missing: MissingItem[];
}

export function emptyFields(): CardFields {
  return Object.fromEntries(CARD_FIELDS.map((f) => [f, ''])) as CardFields;
}

/** Приводит произвольный объект к полному набору полей карточки (обрезая пробелы). */
export function normalizeFields(input: Partial<Record<string, unknown>>): CardFields {
  const out = emptyFields();
  for (const f of CARD_FIELDS) {
    const v = input[f];
    out[f] = typeof v === 'string' ? v.trim() : '';
  }
  return out;
}

export function evaluate(input: Partial<CardFields>): Evaluation {
  const fields = normalizeFields(input);
  const criteria = CRITERIA_DEFS.map((c) => {
    const checks = c.checks.map((ch) => ({ label: ch.label, points: ch.points, field: ch.field, ok: ch.test(fields) }));
    const earned = checks.reduce((sum, ch) => sum + (ch.ok ? ch.points : 0), 0);
    return { id: c.id, name: c.name, short: c.short, max: c.max, earned, checks };
  });
  const total = criteria.reduce((sum, c) => sum + c.earned, 0);
  const missing = criteria
    .flatMap((c) => c.checks.filter((ch) => !ch.ok).map((ch) => ({ criterionId: c.id, criterion: c.name, label: ch.label, points: ch.points, field: ch.field })))
    .sort((a, b) => b.points - a.points);
  return { total, level: levelOf(total), criteria, missing };
}

/** Описание формулы для интерфейса: веса, подписи проверок, пороги уровней. */
export function formulaMeta() {
  return {
    criteria: CRITERIA_DEFS.map((c) => ({
      id: c.id,
      name: c.name,
      short: c.short,
      max: c.max,
      hint: c.hint,
      checks: c.checks.map((ch) => ({ label: ch.label, points: ch.points, field: ch.field })),
    })),
    levels: LEVELS,
  };
}
