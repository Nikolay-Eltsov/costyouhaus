#!/usr/bin/env node
/**
 * Проверка плана выкатки: прошёл ли кто-нибудь путь человека ДО того, как
 * продукт написан.
 *
 * Шаг заведён после прогона de89a81c, где продукт вышел технически исправным и
 * бессмысленным: выбрано евро — порог налога показан в лари; спрошен доход за
 * год — человек думает окладом за месяц; поле «прочие расходы» прибавлялось к
 * доходу, хотя в голове у человека расходы это то, что доход должен покрыть.
 *
 * Ни одна проверка согласованности этого не видит. Видно только на проходе
 * шаг за шагом: «открыл → выбрал евро → вижу лари → не понимаю».
 *
 * Запуск: node tools/check-plan.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const MIN_WALKTHROUGHS = 5;

const problems = [];
const fail = (m) => problems.push(m);

const planPath = path.join(ROOT, 'PLAN.md');
if (!existsSync(planPath)) {
  console.error('Нет PLAN.md — путь человека не пройден ни разу. Это Постановщик.');
  process.exit(1);
}
const plan = readFileSync(planPath, 'utf8');

const manifest = existsSync(path.join(ROOT, 'product.json'))
  ? JSON.parse(readFileSync(path.join(ROOT, 'product.json'), 'utf8'))
  : null;

// ── Разделы ──────────────────────────────────────────────────────────────────
for (const h of ['## Что выкатываем', '## Что человек видит', '## Прогон случаев',
                 '## Чего в этой версии нет']) {
  if (!plan.includes(h)) fail(`нет раздела «${h}»`);
}

// ── Каждое поле объяснено ────────────────────────────────────────────────────
// Поле, которого нет в плане, — поле, смысл которого никто не формулировал.
// Именно так «прочие расходы» уехали в продукт, не сказав ни чьи, ни какие.
if (manifest?.inputs) {
  for (const f of manifest.inputs) {
    if (!plan.includes(f.id)) {
      fail(`поле «${f.id}» не описано в «## Что выкатываем» — его смысл нигде не сформулирован`);
    }
  }
  for (const o of manifest.outputs ?? []) {
    if (!plan.includes(o.id)) fail(`выход «${o.id}» не описан в «## Что человек видит»`);
  }
}

// ── Прогоны случаев ──────────────────────────────────────────────────────────
const walks = [...plan.matchAll(/^###\s*UC(\d+)\b([\s\S]*?)(?=^###|^##|\Z)/gm)]
  .map((m) => ({ uc: Number(m[1]), text: m[2] }));

if (walks.length < MIN_WALKTHROUGHS) {
  fail(`прогонов случаев ${walks.length}, нужно от ${MIN_WALKTHROUGHS}: один-два прохода `
     + 'показывают только то, что и так знали');
}

const ucPath = path.join(ROOT, 'USE-CASES.md');
const known = existsSync(ucPath)
  ? new Set([...readFileSync(ucPath, 'utf8').matchAll(/^\*\*UC(\d+)\.\*\*/gm)].map((m) => Number(m[1])))
  : null;

for (const w of walks) {
  if (known && known.size > 0 && !known.has(w.uc)) {
    fail(`прогон UC${w.uc}: такого случая нет в USE-CASES.md — прогон придуман, а не взят`);
  }
  // Проход обязан содержать и ввод, и то, что человек увидел. Без второго это
  // пересказ замысла, а не проверка смысла.
  if (!/ввод|вводит|вводим|выбирает|выбрал|ставит/i.test(w.text)) {
    fail(`прогон UC${w.uc}: не сказано, что человек ВВОДИТ`);
  }
  if (!/видит|увидел|показыв|на экране|получает/i.test(w.text)) {
    fail(`прогон UC${w.uc}: не сказано, что человек ВИДИТ — без этого прогон ничего не проверяет`);
  }
  if (!/сходится|не сходится|срабатывает|не срабатывает|закрывается|не закрывается/i.test(w.text)) {
    fail(`прогон UC${w.uc}: нет вывода «сходится / не сходится» — проход без вердикта не проверка`);
  }
}

const ucs = walks.map((w) => w.uc);
if (new Set(ucs).size !== ucs.length) fail('есть повторяющиеся прогоны одного случая');

// ── Валюта: ни одного числа в чужих деньгах ──────────────────────────────────
// Прямая причина дефекта прогона de89a81c: «Грузия, малый бизнес — 1% (до
// 500 000 GEL/год)» при выбранном EUR. Порог в валюте, которую человек не
// выбирал, для него бессмыслен.
if (manifest?.currency?.options?.length) {
  const allowed = new Set(manifest.currency.options.map((o) => o.code));
  const text = JSON.stringify(manifest) + plan;
  const found = new Set(
    [...text.matchAll(/\b([A-Z]{3})\b/g)].map((m) => m[1])
      .filter((c) => /^(EUR|USD|RUB|PLN|TRY|UAH|GEL|AMD|KZT|GBP|CHF|CZK|RSD|BGN|MDL|AZN|UZS|KGS|BYN)$/.test(c))
      .filter((c) => !allowed.has(c)),
  );
  if (found.size > 0) {
    fail(`валюты, которых нет в списке продукта: ${[...found].join(', ')} — человек увидит `
       + 'число в деньгах, которых не выбирал; либо пересчитайте, либо не показывайте');
  }
}

// ── Период ───────────────────────────────────────────────────────────────────
if (!/за месяц|в месяц|помесячн|за год|в год|годов/i.test(plan)) {
  fail('в плане не сказано, за какой период человек вводит суммы — месяц или год');
}

if (/PLACEHOLDER/i.test(plan)) fail('PLAN.md: остался заполнитель');

// ── Вывод ────────────────────────────────────────────────────────────────────
if (problems.length === 0) {
  console.log(`ok · план выкатки · прогонов случаев ${walks.length} · поля объяснены`);
  process.exit(0);
}
console.error(`План выкатки не готов — ${problems.length} шт.:`);
for (const p of problems) console.error(`  · ${p}`);
process.exit(1);
