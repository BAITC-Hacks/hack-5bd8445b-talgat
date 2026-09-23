import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unsupportedFacts } from './guard.js';
import { applyAnswers, extractByRules, questionsByRules } from './fallback.js';
import { AnalyzeOutputSchema } from './schemas.js';
import { evaluate } from '../scoring/scoring.js';

const DRAFT = 'Курьеры часто опаздывают, клиенты жалуются. Нужна какая-то система, чтобы это исправить.';

test('проверка фактов ловит число, которого не было у пользователя', () => {
  const source = 'Выгрузка из 1С за 6 месяцев — около 48 000 доставок в Excel.';
  assert.deepEqual(unsupportedFacts('Выгрузка за 6 месяцев, 48000 доставок в Excel', source), []);
  assert.deepEqual(unsupportedFacts('Выгрузка за 12 месяцев в Excel', source), ['12']);
});

test('проверка фактов ловит новую технологию латиницей', () => {
  const extra = unsupportedFacts('Сделать бота на Python с выгрузкой из Excel', 'Есть таблица в Excel');
  assert.deepEqual(extra, ['python']);
});

test('локальные правила раскладывают черновик без выдумок', () => {
  const { title, fields } = extractByRules(DRAFT);
  assert.equal(fields.context, 'Курьеры часто опаздывают, клиенты жалуются.');
  assert.equal(fields.need, 'Нужна какая-то система, чтобы это исправить.');
  assert.equal(fields.data, '');
  assert.equal(title, 'Курьеры часто опаздывают, клиенты жалуются');
});

test('по слабому черновику задаётся не меньше трёх вопросов', () => {
  const { fields } = extractByRules(DRAFT);
  const questions = questionsByRules(fields);
  assert.ok(questions.length >= 3);
  assert.equal(new Set(questions.map((q) => q.id)).size, questions.length);
  assert.ok(questions.some((q) => q.field === 'data'));
});

test('даже по полной карточке вопросов не меньше трёх', () => {
  const full = {
    context: 'Диспетчер вручную раздаёт заказы, опоздания вечером с 18 до 21.', need: 'Нужно сократить опоздания курьеров.',
    users: 'Диспетчеры смены', data: 'Выгрузка из 1С за 6 месяцев в Excel', constraints: 'Пилот до конца ноября, только обезличенные данные',
    expectedResult: 'Прототип подсказки для диспетчера', successCriteria: 'Опозданий меньше на 10%', contact: 'Айгерим', format: 'Созвон раз в неделю по четвергам',
  };
  assert.equal(evaluate(full).total, 100);
  assert.equal(questionsByRules(full).length, 3);
});

test('ответы дополняют поля и поднимают рейтинг', () => {
  const { fields } = extractByRules(DRAFT);
  const before = evaluate(fields).total;
  const questions = questionsByRules(fields).map((q) =>
    q.field === 'data' ? { ...q, answer: 'Выгрузка из 1С за 6 месяцев — около 48 000 доставок в Excel.' } : q,
  );
  const after = evaluate(applyAnswers(fields, questions)).total;
  assert.ok(after > before, `рейтинг должен вырасти: ${before} → ${after}`);
});

test('схема ответа модели отклоняет неполный JSON', () => {
  const bad = AnalyzeOutputSchema.safeParse({ title: 'x', fields: { context: 'a' }, questions: [] });
  assert.equal(bad.success, false);
});
