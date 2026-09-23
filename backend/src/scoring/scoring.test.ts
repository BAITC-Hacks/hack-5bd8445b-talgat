import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, levelOf, CRITERIA_DEFS } from './scoring.js';

const full = {
  context: 'Курьеры часто опаздывают. Диспетчер вручную раздаёт заказы в чате, опоздания вечером с 18 до 21.',
  need: 'Нужна система, которая поможет сократить опоздания.',
  users: 'Диспетчеры и руководитель доставки.',
  data: 'Выгрузка из 1С за 6 месяцев, около 48 000 доставок в Excel.',
  constraints: 'Пилот до конца ноября, работаем только с обезличенной выгрузкой.',
  expectedResult: 'Прототип подсказки для диспетчера и отчёт о причинах опозданий.',
  successCriteria: 'Доля опозданий больше 15 минут снизится с 23% до 12%.',
  contact: 'Айгерим Сейтказы',
  format: 'Созвон раз в неделю, вопросы в Telegram.',
};

test('веса критериев в сумме дают 100', () => {
  const sum = CRITERIA_DEFS.reduce((s, c) => s + c.max, 0);
  assert.equal(sum, 100);
  for (const c of CRITERIA_DEFS) {
    assert.equal(c.checks.reduce((s, ch) => s + ch.points, 0), c.max, `проверки критерия ${c.id} не равны его весу`);
  }
});

test('пустая карточка — 0 баллов, уровень «Черновик»', () => {
  const ev = evaluate({});
  assert.equal(ev.total, 0);
  assert.equal(ev.level.id, 'DRAFT');
  assert.equal(ev.missing.reduce((s, m) => s + m.points, 0), 100);
});

test('полная карточка — 100 баллов, уровень «Приоритетная»', () => {
  const ev = evaluate(full);
  assert.equal(ev.total, 100);
  assert.equal(ev.level.id, 'PRIORITY');
  assert.equal(ev.missing.length, 0);
});

test('без ограничений и формата встреч — минус 15 баллов', () => {
  const ev = evaluate({ ...full, constraints: '', format: '' });
  assert.equal(ev.total, 85);
  assert.equal(ev.level.id, 'READY');
  assert.deepEqual(ev.missing.map((m) => m.field).sort(), ['constraints', 'constraints', 'format']);
});

test('критерий успеха без чисел получает только балл за признак приёмки', () => {
  const ev = evaluate({ successCriteria: 'Диспетчеры станут реже ошибаться при назначении' });
  const success = ev.criteria.find((c) => c.id === 'success');
  assert.equal(success?.earned, 8);
});

test('пороги уровней соответствуют кейсу', () => {
  assert.equal(levelOf(39).id, 'DRAFT');
  assert.equal(levelOf(40).id, 'WORKING');
  assert.equal(levelOf(69).id, 'WORKING');
  assert.equal(levelOf(70).id, 'READY');
  assert.equal(levelOf(89).id, 'READY');
  assert.equal(levelOf(90).id, 'PRIORITY');
  assert.equal(levelOf(100).id, 'PRIORITY');
});

test('функция чистая: одинаковый вход — одинаковый результат, вход не меняется', () => {
  const input = { ...full };
  const a = evaluate(input);
  const b = evaluate(input);
  assert.deepEqual(a, b);
  assert.deepEqual(input, full);
});
