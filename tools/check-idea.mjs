#!/usr/bin/env node
/**
 * Проверка замысла: разобрана ли идея по-настоящему и коротко ли записана.
 *
 * Конфронтация здесь не суд, а разбор: три круга по разным измерениям —
 * идея и спрос, функционал и удобство, деньги и вид. Каждый круг называет
 * слабые места, закрывает их и НАЗЫВАЕТ, что усилить. На выходе — замысел
 * сильнее исходного плюс план денег.
 *
 * Объём ограничен намеренно. Первый живой прогон дал документ на 65 000 знаков:
 * тридцать страниц на вечерний продукт, где два довода, реально решившие дело,
 * лежали на шестидесятитысячном знаке. Плотность заставляет думать, безлимит
 * позволяет писать эссе вместо довода.
 *
 * Запуск: node tools/check-idea.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const FILE = path.join(ROOT, 'IDEA.md');

const ROUNDS = [
  { n: 1, dimension: 'Идея и спрос' },
  { n: 2, dimension: 'Функционал и удобство' },
  { n: 3, dimension: 'Деньги и вид' },
];
const MIN_OBJECTIONS = 3;
const MAX_OBJECTION = 700;
const MAX_ANSWER = 800;
// Потолок с запасом на рост: Защитник правит «## Замысел» на каждой
// уступке, и раздел законно распухает за три круга. Живой прогон: 2 728
// знаков от Развивающего → 4 486 после кругов. Потолок 3 500 запрещал бы
// ровно то поведение, ради которого конфронтация и заведена.
const MAX_IDEA = 6000;
const MAX_ROUND = 6000;
const MAX_FILE = 28000;

const problems = [];
const fail = (m) => problems.push(m);

if (!existsSync(FILE)) {
  console.error('Нет IDEA.md — замысел не развёрнут. Его заводит Развивающий.');
  process.exit(1);
}
const text = readFileSync(FILE, 'utf8');

if (text.length > MAX_FILE) {
  fail(`весь документ ${text.length} знаков при потолке ${MAX_FILE} — это разбор, а не эссе`);
}

/** Кусок между заголовком и следующим заголовком того же уровня. */
function section(heading, level = '## ') {
  const start = text.indexOf(level + heading);
  if (start < 0) return null;
  const rest = text.slice(start + heading.length + level.length);
  const next = rest.search(new RegExp(`^${level.trim()} `, 'm'));
  return next < 0 ? rest : rest.slice(0, next);
}

// ── Замысел ──────────────────────────────────────────────────────────────────
const idea = section('Замысел');
if (idea == null) fail('нет раздела «## Замысел»');
else {
  for (const h of ['Кому и когда больно', 'Что человек получает',
                   'Чем меряем, что зашло', 'Чем это НЕ является']) {
    if (!idea.includes(`### ${h}`)) fail(`в «## Замысел» нет «### ${h}»`);
  }
  if (idea.length > MAX_IDEA) {
    fail(`«## Замысел» ${idea.length} знаков при потолке ${MAX_IDEA} — короче и плотнее`);
  }
}

// ── Круги ────────────────────────────────────────────────────────────────────
let conceded = 0;
let rebutted = 0;

for (const { n, dimension } of ROUNDS) {
  const body = section(`Круг ${n}`);
  if (body == null) {
    fail(`нет «## Круг ${n} · ${dimension}» — кругов должно быть ${ROUNDS.length}, каждый про своё`);
    continue;
  }
  const head = body.split('\n')[0];
  // Регистр заголовка роли не важен: «деньги и вид» и «Деньги и вид» — одно и
  // то же измерение, а придирка к заглавной букве не ловит ни одной ошибки.
  if (!head.toLowerCase().includes(dimension.toLowerCase())) {
    fail(`круг ${n}: заголовок не называет измерение «${dimension}» — круги не должны повторять друг друга`);
  }
  if (body.length > MAX_ROUND) {
    fail(`круг ${n}: ${body.length} знаков при потолке ${MAX_ROUND}`);
  }
  if (!body.includes('### Слабые места')) fail(`круг ${n}: нет «### Слабые места»`);
  if (!body.includes('### Ответы и усиление')) fail(`круг ${n}: нет «### Ответы и усиление»`);

  const [weak = '', strong = ''] = body.split('### Ответы и усиление');

  // Маркер строго `**В12.**` в начале строки. Ослабленное сравнение (любая
  // строка, начинающаяся с буквы и цифры) ловило ссылки внутри прозы: перенос
  // абзаца, начавшийся с «В1)», разбирался как шестой довод, которого нет.
  const items = (block, letter) => {
    const re = new RegExp(`^\\*\\*${letter}(\\d+)\\.\\*\\*([\\s\\S]*?)(?=^\\*\\*${letter}\\d+\\.\\*\\*|$)`, 'gm');
    return [...block.matchAll(re)].map((m) => ({ n: Number(m[1]), text: m[2].trim() }));
  };

  const objections = items(weak, 'В');
  const answers = items(strong, 'О');

  if (objections.length < MIN_OBJECTIONS) {
    fail(`круг ${n}: слабых мест ${objections.length}, нужно не меньше ${MIN_OBJECTIONS} (В1, В2, В3…)`);
  }
  for (const o of objections) {
    if (o.text.length > MAX_OBJECTION) {
      fail(`круг ${n}, В${o.n}: ${o.text.length} знаков при потолке ${MAX_OBJECTION} — довод, а не эссе`);
    }
    if (!answers.some((a) => a.n === o.n)) fail(`круг ${n}: на В${o.n} нет ответа О${o.n}`);
  }
  for (const a of answers) {
    if (a.text.length > MAX_ANSWER) {
      fail(`круг ${n}, О${a.n}: ${a.text.length} знаков при потолке ${MAX_ANSWER}`);
    }
  }

  // Без `\b`: в JavaScript граница слова определена по ASCII и перед кириллицей
  // не находится никогда — проверка с ней молча считала бы, что уступок нет.
  if (/(принято|признаю|согласен|меняем|убираем|сужаю)/i.test(strong)) conceded++;
  if (/(отбито|возражение неверно|не принимается)/i.test(strong)) rebutted++;

  if (!/усилен|усиливаем|развива/i.test(strong)) {
    fail(`круг ${n}: в ответах не названо, что УСИЛИТЬ — разбор обязан не только закрывать слабое`);
  }
}

if (conceded === 0) {
  fail('за три круга ни одной уступки — либо критик не искал, либо защитник не слушал');
}
if (rebutted === 0) {
  fail('за три круга ни одного «Отбито» — защитник, соглашающийся со всем, не защищает: '
     + 'замысел ужимается и под верными доводами, и под неверными');
}

// ── Сильные стороны и деньги ─────────────────────────────────────────────────
if (section('Сильные стороны') == null) {
  fail('нет раздела «## Сильные стороны» — что в замысле развиваем, а не только чиним');
}

const money = section('План денег');
if (money == null) {
  fail('нет раздела «## План денег» — платной стены у нас нет, значит деньги разбираются в замысле');
} else {
  if (!/донат/i.test(money)) fail('«## План денег»: не назван донат — модель студии по умолчанию');
  if (!/скольк|сумм|₽/i.test(money)) fail('«## План денег»: не сказано, сколько отсюда реально взять');
  if (!/когда|момент|после|в какой/i.test(money)) {
    fail('«## План денег»: не сказано, в какой момент предлагаем поддержать');
  }
}

if (section('Итог кругов') == null) {
  fail('нет раздела «## Итог кругов» — чем замысел вышел из разбора и что осталось открытым');
}

// ── Вердикт ──────────────────────────────────────────────────────────────────
const verdict = text.match(/^##\s*Вердикт:\s*(брать|не брать|переделать)\s*$/im);
if (!verdict) {
  fail('нет строки «## Вердикт: брать» / «не брать» / «переделать»');
} else {
  const after = text.slice(text.indexOf(verdict[0]) + verdict[0].length).trim();
  if (after.length < 200) fail(`вердикт «${verdict[1]}» без обоснования (${after.length} знаков, нужно от 200)`);
}

if (/PLACEHOLDER|lorem ipsum/i.test(text)) fail('IDEA.md: остался заполнитель');

// ── Вывод ────────────────────────────────────────────────────────────────────
if (problems.length === 0) {
  console.log(`ok · замысел разобран · ${text.length} знаков · кругов ${ROUNDS.length}/${ROUNDS.length} · `
            + `уступок в ${conceded}, отбито в ${rebutted} · вердикт: ${verdict[1].toLowerCase()}`);
  process.exit(0);
}
console.error(`Замысел не разобран — ${problems.length} шт.:`);
for (const p of problems) console.error(`  · ${p}`);
process.exit(1);
