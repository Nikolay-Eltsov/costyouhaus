#!/usr/bin/env node
/**
 * Проверка насыщения: знает ли продукт, зачем к нему приходят, и на что он
 * опирается.
 *
 * Два шага, которых не было в первых прогонах студии и из-за отсутствия
 * которых выходил голый калькулятор: он считал верно и не был нужен никому.
 *
 *   USE-CASES.md — 20–40 случаев «кто, откуда, зачем открыл, с чем уйдёт».
 *   DATA.md      — какие числа нужны, откуда взяты, когда протухнут.
 *
 * Запуск: node tools/check-research.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const MIN_CASES = 20;
const MAX_CASES = 40;
const MAX_CASE_LEN = 400;

const problems = [];
const fail = (m) => problems.push(m);

// ── Случаи ───────────────────────────────────────────────────────────────────
const ucPath = path.join(ROOT, 'USE-CASES.md');
let cases = [];
if (!existsSync(ucPath)) {
  fail('нет USE-CASES.md — не написано, зачем к продукту приходят. Это Сценарист.');
} else {
  const uc = readFileSync(ucPath, 'utf8');
  cases = [...uc.matchAll(/^\*\*UC(\d+)\.\*\*([\s\S]*?)(?=^\*\*UC\d+\.\*\*|^##|\Z)/gm)]
    .map((m) => ({ n: Number(m[1]), text: m[2].trim() }));

  if (cases.length < MIN_CASES) {
    fail(`случаев ${cases.length}, нужно от ${MIN_CASES}: меньше — значит перечислено очевидное и брошено`);
  }
  if (cases.length > MAX_CASES) {
    fail(`случаев ${cases.length}, больше ${MAX_CASES} — начались повторы`);
  }
  for (const c of cases) {
    if (c.text.length > MAX_CASE_LEN) {
      fail(`UC${c.n}: ${c.text.length} знаков при потолке ${MAX_CASE_LEN} — это зарубка, а не рассказ`);
    }
  }
  const nums = cases.map((c) => c.n);
  const dup = nums.filter((n, i) => nums.indexOf(n) !== i);
  if (dup.length) fail(`повторяющиеся номера случаев: ${[...new Set(dup)].join(', ')}`);

  if (!uc.includes('## Что из этого следует')) {
    fail('USE-CASES.md: нет раздела «## Что из этого следует» — набор случаев без вывода это просто список');
  }
  if (/PLACEHOLDER/i.test(uc)) fail('USE-CASES.md: остался заполнитель');
}

// ── Данные ───────────────────────────────────────────────────────────────────
const dataPath = path.join(ROOT, 'DATA.md');
if (!existsSync(dataPath)) {
  fail('нет DATA.md — не сказано, на какие числа продукт опирается. Это Исследователь.');
} else {
  const data = readFileSync(dataPath, 'utf8');
  const facts = [...data.matchAll(/^\*\*D(\d+)\.\*\*([\s\S]*?)(?=^\*\*D\d+\.\*\*|^##|\Z)/gm)]
    .map((m) => ({ n: Number(m[1]), text: m[2].trim() }));

  if (facts.length === 0) {
    fail('DATA.md: ни одной величины (D1, D2…). Если продукту правда не нужны внешние данные — так и напишите это в «Чего добыть не удалось»');
  }

  // Число без источника — не данные, а уверенная выдумка: продукт будет врать
  // с достоинством. Источник ищем как ссылку либо как названный документ.
  const SOURCE = /(https?:\/\/|источник|по данным|отчёт|статистик|официальн)/i;
  for (const f of facts) {
    if (!SOURCE.test(f.text)) fail(`D${f.n}: нет источника — число без источника хуже отсутствующего`);
    if (!/20\d\d/.test(f.text)) fail(`D${f.n}: не назван год данных — ставки и цены протухают молча`);
  }

  if (!data.includes('## Чего добыть не удалось')) {
    fail('DATA.md: нет раздела «## Чего добыть не удалось» — он обязателен, даже если пуст');
  }
  if (/PLACEHOLDER/i.test(data)) fail('DATA.md: остался заполнитель');
}

// ── Вывод ────────────────────────────────────────────────────────────────────
if (problems.length === 0) {
  console.log(`ok · насыщение · случаев ${cases.length} · данные с источниками`);
  process.exit(0);
}
console.error(`Продукт не насыщен — ${problems.length} шт.:`);
for (const p of problems) console.error(`  · ${p}`);
process.exit(1);
