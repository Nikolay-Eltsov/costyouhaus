/**
 * Единственное место, где живёт расчёт продукта.
 *
 * Чистая функция без DOM, без сети, без времени «сейчас» в аргументах по
 * умолчанию — иначе её нельзя проверить кейсами. Всё, что меняется от запуска
 * к запуску (текущая дата, случайность), приходит ВХОДОМ.
 *
 * Её импортируют трое: страница (app.js), проверка (test/calc.test.mjs) и
 * экран коробки (mobile/tool.dart — там она переписана на Dart, кейсы те же).
 */

/**
 * @param {Record<string, unknown>} input значения полей из product.json:inputs
 * @returns {Record<string, unknown>} значения по product.json:outputs
 */
export function calc(input) {
  // PLACEHOLDER: заменить на расчёт продукта.
  const a = Number(input.a ?? 0);
  return { value: a };
}

/**
 * Человеческое представление результата — то, что реально видит посетитель.
 * Отделено от calc(), чтобы кейсы проверяли числа, а не форматирование.
 *
 * @param {Record<string, unknown>} out результат calc()
 * @returns {Record<string, string>}
 */
export function format(out) {
  return Object.fromEntries(
    Object.entries(out).map(([k, v]) => [k, typeof v === 'number' ? formatNumber(v) : String(v)]),
  );
}

function formatNumber(n) {
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(n);
}
