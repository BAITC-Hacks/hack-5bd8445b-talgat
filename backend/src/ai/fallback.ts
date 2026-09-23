/**
 * Локальная заглушка без внешнего API: работает, если ключ OpenAI не задан
 * или модель вернула ошибку. Правила простые и предсказуемые — ничего не выдумывают.
 */
import { emptyFields, evaluate, type CardField, type CardFields, type CriterionId } from '../scoring/scoring.js';
import type { ClarifyingQuestion } from './schemas.js';

interface Template {
  criterion: CriterionId;
  field: CardField;
  text: string;
  why: string;
}

/** Шаблоны вопросов в порядке веса критериев */
export const QUESTION_TEMPLATES: Template[] = [
  { criterion: 'contextNeed', field: 'context', text: 'Как всё устроено сейчас: где и когда возникает проблема, как часто?', why: 'Команде нужно понять текущую ситуацию, чтобы решать настоящую проблему.' },
  { criterion: 'contextNeed', field: 'need', text: 'Что именно должно измениться, когда задача будет решена?', why: 'Так команда увидит цель, а не только симптомы.' },
  { criterion: 'data', field: 'data', text: 'Какие данные, примеры или документы вы можете передать команде? В каком виде и за какой период?', why: 'Без данных команда не сможет проверить гипотезы.' },
  { criterion: 'result', field: 'expectedResult', text: 'Что команда должна передать вам в итоге: прототип, отчёт, модель, сервис?', why: 'Заранее понятно, что считать готовой работой.' },
  { criterion: 'success', field: 'successCriteria', text: 'По какому измеримому признаку вы поймёте, что решение работает?', why: 'Число или срок помогают принять работу без споров.' },
  { criterion: 'constraints', field: 'constraints', text: 'Есть ли сроки, требования к технологиям или ограничения по доступу к данным?', why: 'Команда спланирует работу в реальных рамках.' },
  { criterion: 'users', field: 'users', text: 'Кто будет пользоваться решением каждый день?', why: 'Команде важно понимать, для кого делать интерфейс.' },
  { criterion: 'link', field: 'format', text: 'Как часто вы готовы созваниваться с командой и где удобно отвечать на вопросы?', why: 'Команде нужна понятная обратная связь по ходу работы.' },
];

const NEED = /(нужн|надо|хотим|хочу|требуется|необходим|цель|задача|помогите|исправить|автоматизир)/i;
const DATA = /(данн|выгрузк|таблиц|excel|1с|база|журнал|csv|отчёт|отчет|архив)/i;
const TERMS = /(срок|до конца|недел|месяц|квартал|бюджет|доступ|нельзя|только)/i;

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function shortTitle(text: string): string {
  const first = splitSentences(text)[0] ?? text;
  const clean = first.replace(/[.!?…]+$/, '');
  return clean.length > 80 ? `${clean.slice(0, 77).trimEnd()}…` : clean;
}

/** Раскладывает черновик по полям только по ключевым словам: без перефразирования */
export function extractByRules(rawDraft: string): { title: string; fields: CardFields } {
  const fields = emptyFields();
  const context: string[] = [];
  for (const s of splitSentences(rawDraft)) {
    if (NEED.test(s)) fields.need = [fields.need, s].filter(Boolean).join(' ');
    else if (DATA.test(s)) fields.data = [fields.data, s].filter(Boolean).join(' ');
    else if (TERMS.test(s)) fields.constraints = [fields.constraints, s].filter(Boolean).join(' ');
    else context.push(s);
  }
  fields.context = context.join(' ');
  const titleSource = fields.context || fields.need || rawDraft;
  return { title: shortTitle(titleSource), fields };
}

/** Вопросы по пунктам, где не хватает баллов; минимум три */
export function questionsByRules(fields: CardFields, count = 5): ClarifyingQuestion[] {
  const ev = evaluate(fields);
  const weakFields = new Set(ev.missing.map((m) => m.field));
  let picked = QUESTION_TEMPLATES.filter((t) => weakFields.has(t.field));
  if (picked.length < 3) {
    const extra = QUESTION_TEMPLATES.filter((t) => !picked.includes(t));
    picked = [...picked, ...extra].slice(0, 3);
  }
  return picked.slice(0, Math.max(3, count)).map((t, i) => ({ id: `q${i + 1}`, criterion: t.criterion, field: t.field, text: t.text, why: t.why, answer: '' }));
}

/** Добавляет ответы в поля: контекст дополняется, остальные поля заполняются ответом */
export function applyAnswers(base: CardFields, questions: ClarifyingQuestion[]): CardFields {
  const out = { ...base };
  for (const q of questions) {
    const answer = q.answer.trim();
    if (!answer) continue;
    const current = out[q.field].trim();
    if (!current) out[q.field] = answer;
    else if (!current.includes(answer)) out[q.field] = `${current} ${answer}`;
  }
  return out;
}
