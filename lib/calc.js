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
 * Честная часовая ставка из желаемого дохода, расходов работы, недельной
 * загрузки, отпуска и простоя между заказами. Формула и её обоснование —
 * PLAN.md, раздел «Что человек видит».
 *
 * Две календарные константы года (52 недели, 5-дневная неделя для перевода
 * дней отпуска в недели) фиксированы в теле функции, а не приходят полями:
 * это не личный выбор человека, а норма (D5, D2 в PLAN.md/DATA.md).
 *
 * Границы вводов (vacationDays 0–60, downtimePercent 0–90 при hoursPerWeek
 * ≥ 1) валидирует форма по product.json:inputs — calc() их не проверяет
 * повторно и остаётся чистой арифметикой; на входах вне этих границ она
 * честно возвращает NaN/Infinity, а не молчаливый ноль.
 *
 * @param {Record<string, unknown>} input значения полей из product.json:inputs
 * @returns {Record<string, unknown>} значения по product.json:outputs
 */
export function calc(input) {
  const income = Number(input.income ?? 0);
  const expenses = Number(input.expenses ?? 0);
  const hoursPerWeek = Number(input.hoursPerWeek ?? 0);
  const vacationDays = Number(input.vacationDays ?? 0);
  const downtimePercent = Number(input.downtimePercent ?? 0);

  const vacationWeeks = vacationDays / 5;
  const workingWeeksPerYear = 52 - vacationWeeks;
  const grossHoursPerYear = hoursPerWeek * workingWeeksPerYear;
  const payableHoursPerYear = grossHoursPerYear * (1 - downtimePercent / 100);
  const payableHoursPerMonth = payableHoursPerYear / 12;
  const hourlyRate = (income + expenses) / payableHoursPerMonth;
  const dailyRate = hourlyRate * 8;

  return { hourlyRate, payableHoursPerMonth, dailyRate };
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
