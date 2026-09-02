#!/usr/bin/env node
/**
 * Единственный гейт заказа. Решает, закрыт ли заказ, и делает это по-разному
 * в зависимости от того, чем кончилась конфронтация.
 *
 * Порядок:
 *   1. `check-idea.mjs` — замысел развёрнут и прошёл три круга критики,
 *      `check-research.mjs` — известно, зачем приходят, и на что опираемся,
 *      `check-plan.mjs` — путь человека пройден шаг за шагом ДО написания кода.
 *   2. Читаем вердикт:
 *      · «не брать»   → заказ ЗАКРЫТ УСПЕШНО. Продукта нет и не будет, это и
 *                       есть результат: идею убили за вечер, а не за месяц.
 *                       Проверять недоделанную страницу бессмысленно и вредно.
 *      · «переделать» → то же: замысел возвращается владельцу, кода нет.
 *      · «брать»      → 3. `check.mjs` + `node --test` — обычная приёмка продукта.
 *
 * Зачем так: если бы «не брать» валило гейт, фирма быстро научилась бы всегда
 * говорить «брать» — единственный способ закрыть заказ. Конфронтация, которая
 * не может никого убить, превращается в обряд, а мы платим за неё на каждом
 * продукте.
 *
 * Запуск: node tools/gate.mjs
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);

const run = (label, cmd, args) => {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8' });
  process.stdout.write(r.stdout ?? '');
  process.stderr.write(r.stderr ?? '');
  if (r.status !== 0) {
    console.error(`\n✗ ${label} — не пройдено`);
    process.exit(1);
  }
  return r;
};

// ── 1. Замысел и насыщение ───────────────────────────────────────────────────
run('замысел', 'node', ['tools/check-idea.mjs']);
run('насыщение', 'node', ['tools/check-research.mjs']);
run('план выкатки', 'node', ['tools/check-plan.mjs']);

// ── 2. Вердикт ───────────────────────────────────────────────────────────────
const idea = readFileSync(path.join(ROOT, 'IDEA.md'), 'utf8');
const verdict = (idea.match(/^##\s*Вердикт:\s*(брать|не брать|переделать)\s*$/im) ?? [])[1]
  ?.toLowerCase();

if (verdict === 'не брать' || verdict === 'переделать') {
  console.log(`\nok · вердикт «${verdict}» — продукт сознательно не реализован.`);
  console.log('Заказ закрыт: идея разобрана и отклонена, это результат, а не провал.');
  process.exit(0);
}

// ── 3. Продукт ───────────────────────────────────────────────────────────────
if (!existsSync(path.join(ROOT, 'tools', 'check.mjs'))) {
  console.error('нет tools/check.mjs');
  process.exit(1);
}
run('продукт заполнен', 'node', ['tools/check.mjs']);
run('расчёт сходится с кейсами', 'node', ['--test']);

// ── 4. Работа доехала ────────────────────────────────────────────────────────
// «Готово» без пуша — не готово: продукта нет по адресу, а витрина собирается
// из того, что лежит в репозитории. На прошлом заходе Инженер честно всё
// сделал и не отправил; поймал это Проверяющий, и заход стоил лишних шагов.
// Теперь это условие закрытия заказа, а не чья-то внимательность.
const git = (...args) => spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });

const dirty = git('status', '--porcelain').stdout?.trim();
if (dirty) {
  console.error('\n✗ работа доехала — не пройдено');
  console.error('Незакоммиченные изменения:');
  console.error(dirty.split('\n').map((l) => `  ${l}`).join('\n'));
  process.exit(1);
}

const hasRemote = git('remote').stdout?.trim();
if (hasRemote) {
  git('fetch', '--quiet', 'origin');
  const ahead = git('rev-list', '--count', 'origin/main..main').stdout?.trim();
  if (ahead && ahead !== '0') {
    console.error(`\n✗ работа доехала — не пройдено`);
    console.error(`Не запушено коммитов: ${ahead}. Продукта по адресу нет, пока они лежат локально.`);
    process.exit(1);
  }
} else {
  console.log('· удалённого репозитория ещё нет — проверка пуша пропущена');
}

console.log('\nok · замысел разобран, вердикт «брать», продукт принят.');
