#!/usr/bin/env node
/**
 * Проверка готовности продукта. Отвечает ровно на один вопрос: это уже продукт
 * или ещё шаблон с подставленным названием.
 *
 * Запуск: node tools/check.mjs
 * Код возврата 1 — продукт не готов; каждая строка вывода называет, что чинить.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const problems = [];
const fail = (msg) => problems.push(msg);

// ── 1. Манифест ──────────────────────────────────────────────────────────────
let m;
try {
  m = JSON.parse(readFileSync(path.join(ROOT, 'product.json'), 'utf8'));
} catch (e) {
  console.error(`product.json не читается: ${e.message}`);
  process.exit(1);
}

const required = ['slug', 'name', 'tagline', 'category', 'money', 'seo', 'inputs', 'outputs', 'cases'];
for (const k of required) if (m[k] == null) fail(`product.json: нет поля "${k}"`);

if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(m.slug ?? '')) {
  fail(`product.json: slug "${m.slug}" не годится для адреса (нужны строчные латинские буквы, цифры и дефис)`);
}
if ((m.seo?.title ?? '').length > 60) fail(`seo.title длиннее 60 символов (${m.seo.title.length}) — поиск обрежет`);
if ((m.seo?.title ?? '').length < 15) fail('seo.title короче 15 символов — по такому не находят');
if ((m.seo?.description ?? '').length > 155) fail(`seo.description длиннее 155 символов (${m.seo.description.length})`);
if ((m.seo?.description ?? '').length < 50) fail('seo.description короче 50 символов');
if (!Array.isArray(m.inputs) || m.inputs.length === 0) fail('inputs пуст — вводить нечего');
if (!Array.isArray(m.outputs) || m.outputs.length === 0) fail('outputs пуст — показывать нечего');
if (!Array.isArray(m.cases) || m.cases.length < 2) fail('cases: меньше двух кейсов');

// Дефолт вне собственных границ — это страница, которая встречает человека
// ошибкой вместо ответа. Найдено живым прогоном: поле «дней в неделю» имело
// min: 1 и default: 0, и продукт при открытии ничего не считал.
for (const f of m.inputs ?? []) {
  if (f.default == null) continue;
  const d = Number(f.default);
  if (f.min != null && d < f.min) fail(`inputs.${f.id}: default ${d} меньше min ${f.min} — страница откроется с ошибкой`);
  if (f.max != null && d > f.max) fail(`inputs.${f.id}: default ${d} больше max ${f.max} — страница откроется с ошибкой`);
  if (f.type === 'integer' && !Number.isInteger(d)) fail(`inputs.${f.id}: default ${d} не целое, а type integer`);
}
// Ползунку нужны обе границы, иначе он молча станет обычным полем.
for (const f of m.inputs ?? []) {
  if (f.control !== 'slider') continue;
  if (f.min == null || f.max == null) fail(`inputs.${f.id}: control "slider" без min/max — тянуть некуда`);
}
// Ровно один герой: две главные цифры означают, что это два продукта.
const heroes = (m.outputs ?? []).filter((o) => o.role === 'hero');
if (heroes.length > 1) fail(`outputs: героев ${heroes.length}, должен быть один`);

const inputIds = new Set((m.inputs ?? []).map((f) => f.id));
const outputIds = new Set((m.outputs ?? []).map((f) => f.id));
for (const [i, c] of (m.cases ?? []).entries()) {
  for (const k of Object.keys(c.input ?? {})) {
    if (!inputIds.has(k)) fail(`cases[${i}]: поле "${k}" не объявлено в inputs`);
  }
  for (const k of Object.keys(c.expect ?? {})) {
    if (!outputIds.has(k)) fail(`cases[${i}]: результат "${k}" не объявлен в outputs`);
  }
}

// ── 2. Следы шаблона ─────────────────────────────────────────────────────────
// `mobile/` намеренно вне веб-гейта: экран для коробки заполняется ОТДЕЛЬНЫМ
// заказом во флоу КОРОБКА и только ПОСЛЕ приёмки веба (так велит Стандарт —
// до неё расчёт ещё меняется, и работа была бы переделана). Пока он здесь
// проверялся, веб-продукт не мог позеленеть никогда: заглушка в `tool.dart`
// валила гейт готовой странице. Полноту дартового экрана проверяет флоу
// КОРОБКА своими средствами, а не эта проверка.
const SKIP_DIRS = new Set(['.git', 'node_modules', '.github', 'mobile']);
function* files(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else yield p;
  }
}
for (const f of files(ROOT)) {
  // `tools/` — инструменты фирмы, а не содержимое продукта: слово PLACEHOLDER
  // внутри них это код проверки, а не незаполненный бланк. Исключение по имени
  // одного файла уже дало осечку, как только рядом появился второй инструмент.
  if (f.includes(`${path.sep}tools${path.sep}`)) continue;
  const text = readFileSync(f, 'utf8');
  if (text.includes('PLACEHOLDER')) {
    fail(`${path.relative(ROOT, f)}: остался PLACEHOLDER — шаблон не заполнен`);
  }
  if (/lorem ipsum|здесь будет текст/i.test(text)) {
    fail(`${path.relative(ROOT, f)}: текст-рыба`);
  }
}

// ── 2а. Зависимости ──────────────────────────────────────────────────────────
// Стандарт запрещает зависимости: страница обязана открываться без сборки и
// без установки. Запрет держался только на слове — и в первом же прогоне в
// репозитории продукта завёлся `pnpm-lock.yaml` (роль пошла ставить пакеты,
// начитавшись чужих инструкций). Теперь это ловит проверка, а не надежда.
for (const name of ['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock', 'bun.lockb']) {
  if (existsSync(path.join(ROOT, name))) {
    fail(`${name}: продукт не должен иметь зависимостей — файл блокировки означает, что их ставили`);
  }
}
if (existsSync(path.join(ROOT, 'node_modules'))) {
  fail('node_modules: продукт не должен иметь зависимостей');
}
const pkgPath = path.join(ROOT, 'package.json');
if (existsSync(pkgPath)) {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  for (const field of ['dependencies', 'devDependencies']) {
    const n = Object.keys(pkg[field] ?? {}).length;
    if (n > 0) fail(`package.json: ${field} — ${n} шт.; продукт за вечер дешевле любой зависимости`);
  }
}

// ── 2б. Валюта и период ──────────────────────────────────────────────────────
// «Грузия, малый бизнес — 1% (до 500 000 GEL/год)» при выбранном EUR: человек
// видит порог в деньгах, которых не выбирал. Формально всё согласовано, значок
// подставлен верно — и число бессмысленно. Найдено владельцем на живом продукте.
if (m.currency?.options?.length) {
  const allowed = new Set(m.currency.options.map((o) => o.code));
  const KNOWN = /^(EUR|USD|RUB|PLN|TRY|UAH|GEL|AMD|KZT|GBP|CHF|CZK|RSD|BGN|MDL|AZN|UZS|KGS|BYN)$/;
  const foreign = new Set(
    [...JSON.stringify(m).matchAll(/\b([A-Z]{3})\b/g)].map((x) => x[1])
      .filter((c) => KNOWN.test(c) && !allowed.has(c)),
  );
  for (const c of foreign) {
    fail(`в манифесте встречается валюта ${c}, которой нет в currency.options — человек увидит число в деньгах, которых не выбирал`);
  }
}

// Период вводимых сумм объявляется один раз и одинаково: человек, думающий
// окладом за месяц, не должен умножать в уме до ввода.
if (m.period && !['месяц', 'год'].includes(m.period)) {
  fail(`product.json: period "${m.period}" — допустимо «месяц» или «год»`);
}

// ── 3. Страница ──────────────────────────────────────────────────────────────
const htmlPath = path.join(ROOT, 'index.html');
if (!existsSync(htmlPath)) {
  fail('нет index.html');
} else {
  const html = readFileSync(htmlPath, 'utf8');
  if (!/<h1[^>]*>\s*\S/.test(html)) fail('index.html: нет заполненного <h1>');
  if (!/<meta\s+name="description"\s+content="[^"]{50,}"/i.test(html)) {
    fail('index.html: нет meta description длиной от 50 символов');
  }
  if (!/<link\s+rel="canonical"/i.test(html)) fail('index.html: нет canonical');
  if (!/property="og:title"/.test(html)) fail('index.html: нет og:title — ссылка в мессенджере будет голой');
  if (!/<html\s+lang="/i.test(html)) fail('index.html: нет lang у <html>');
  const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  if (titleMatch && m.seo?.title && titleMatch[1].trim() !== m.seo.title.trim()) {
    fail('index.html: <title> разошёлся с product.json → seo.title');
  }
  if (!/<h2/i.test(html)) fail('index.html: нет текстового блока под калькулятором — странице нечем попасть в поиск');

  // Результат обязан стоять НАД формой: человек, тянущий ползунок, должен
  // видеть цифру, которую меняет. Проверено вживую на 375×667 — при форме
  // сверху результат уходит под сгиб, и весь интерактив теряет смысл.
  const iOut = html.indexOf('id="out"');
  const iForm = html.indexOf('id="form"');
  if (iOut >= 0 && iForm >= 0 && iOut > iForm) {
    fail('index.html: блок результата стоит ниже формы — на телефоне цифра уйдёт под сгиб');
  }
  if (iOut < 0) fail('index.html: нет блока результата (id="out")');
  if (!html.includes('id="whatif"')) fail('index.html: нет блока «что если» (id="whatif")');
  if (!html.includes('id="examples"')) fail('index.html: нет блока примеров (id="examples")');

  // Продукт живёт в подпапке (owner.github.io/<slug>/). Путь от корня уводит
  // запрос к другому продукту, и ломается это только на живом адресе — при
  // зелёных локальных проверках. Поэтому ловим здесь.
  for (const m of html.matchAll(/(?:href|src)="\/(?!\/)([^"]*)"/g)) {
    fail(`index.html: путь от корня "/${m[1]}" — на живом адресе уведёт к чужому продукту, нужен относительный (./)`);
  }

  // Ссылка на файл, которого нет, ломается молча: страница выглядит целой, а
  // картинка превью в мессенджере не грузится, иконка пустая, стили не
  // приезжают. Так шаблон полгода носил `og:image` на несуществующий og.png.
  const refs = [
    ...html.matchAll(/(?:href|src)="\.\/([^"?#]+)/g),
    ...html.matchAll(/property="og:image"\s+content="\.\/([^"?#]+)/g),
  ].map((m) => m[1]);
  for (const ref of new Set(refs)) {
    if (!existsSync(path.join(ROOT, ref))) {
      fail(`index.html: ссылается на "./${ref}", а такого файла нет`);
    }
  }
}

// ── 4. Расчёт ────────────────────────────────────────────────────────────────
const calcPath = path.join(ROOT, 'lib', 'calc.js');
if (!existsSync(calcPath)) {
  fail('нет lib/calc.js');
} else {
  const src = readFileSync(calcPath, 'utf8');
  if (/document\.|window\.|fetch\(/.test(src)) {
    fail('lib/calc.js трогает DOM или сеть — тогда расчёт нельзя проверить кейсами');
  }
}

const appPath = path.join(ROOT, 'app.js');
if (existsSync(appPath)) {
  const src = readFileSync(appPath, 'utf8');
  for (const m of src.matchAll(/from\s+'\/([^']*)'/g)) {
    fail(`app.js: импорт от корня "/${m[1]}" — на живом адресе не разрешится, нужен относительный (./)`);
  }
}

// ── Вывод ────────────────────────────────────────────────────────────────────
if (problems.length === 0) {
  console.log(`ok · ${m.name} (${m.slug}) · кейсов: ${m.cases.length}`);
  process.exit(0);
}
console.error(`Продукт не готов — ${problems.length} шт.:`);
for (const p of problems) console.error(`  · ${p}`);
process.exit(1);
