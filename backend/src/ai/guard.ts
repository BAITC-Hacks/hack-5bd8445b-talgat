/**
 * Проверка «ИИ не добавляет фактов». Число или латинское название в ответе модели
 * должно встречаться в том, что написал сам бизнес. Иначе поле считается подозрительным.
 */

const NUMBER = /\d+(?:[.,]\d+)?/g;
const LATIN_WORD = /[A-Za-z][A-Za-z0-9+#.-]*/g;

const squashSpaces = (s: string) => s.replace(/(\d)[\s ]+(?=\d)/g, '$1');

export function extractFacts(text: string): { numbers: string[]; words: string[] } {
  const clean = squashSpaces(text);
  const numbers = (clean.match(NUMBER) ?? []).map((n) => n.replace(',', '.'));
  const words = (clean.match(LATIN_WORD) ?? []).map((w) => w.toLowerCase().replace(/[.-]+$/, '')).filter((w) => w.length > 1);
  return { numbers, words };
}

/** Возвращает факты из candidate, которых нет в source */
export function unsupportedFacts(candidate: string, source: string): string[] {
  const got = extractFacts(candidate);
  const have = extractFacts(source);
  const numbers = new Set(have.numbers);
  const words = new Set(have.words);
  const extra = [
    ...got.numbers.filter((n) => !numbers.has(n)),
    ...got.words.filter((w) => !words.has(w)),
  ];
  return [...new Set(extra)];
}
