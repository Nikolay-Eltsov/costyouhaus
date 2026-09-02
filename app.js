/**
 * Связывает манифест, расчёт и страницу. Продуктовой логики здесь нет —
 * она вся в lib/calc.js, иначе её не проверить кейсами.
 *
 * Всё, что делает страницу живой — ползунки, «что если», карточка результата, —
 * выводится из product.json и работает на любом продукте без единой строчки
 * под него. Продуктовые решения приходят полями манифеста:
 *
 *   inputs[].control  "slider" | "field"   чем вводить (по умолчанию: ползунок,
 *                                          если известны min и max)
 *   inputs[].group    строка               заголовок группы полей
 *   inputs[].short    строка               короткое имя для строки «что если»
 *   inputs[].whatIf   число | false        шаг подкрутки; false — не трогать
 *   outputs[].role    "hero" | "detail"    что крупно, что раскладкой
 *   share.card        false                выключить карточку результата
 */
import { calc, format } from './lib/calc.js';

const manifest = await fetch(new URL('product.json', import.meta.url)).then((r) => r.json());

const form = document.getElementById('form');
const out = document.getElementById('out');
const examplesBox = document.getElementById('examples');
const whatIfBox = document.getElementById('whatif');
const shareBtn = document.getElementById('share');
const cardBtn = document.getElementById('card');

const params = new URLSearchParams(location.search);

/**
 * Чем встречаем человека. Нули — плохой ответ: калькулятор с нулями либо
 * показывает ошибку («дней в неделю меньше 1»), либо бессмысленный результат,
 * и человек уходит, не поняв, что продукт вообще делает. Поэтому по умолчанию
 * подставляем первый кейс — тот же случай из жизни, которым продукт
 * проверяется: страница сразу считает, и видно, что менять на своё.
 * `landing: "empty"` в манифесте возвращает пустую форму.
 */
const landing =
  manifest.landing === 'empty' || params.size > 0 ? {} : (manifest.cases?.[0]?.input ?? {});
const isNumeric = (f) => f.type == null || f.type === 'number' || f.type === 'integer';
/** Ползунок оправдан только когда известны обе границы: иначе тянуть некуда. */
const useSlider = (f) =>
  (f.control ?? (isNumeric(f) && f.min != null && f.max != null ? 'slider' : 'field')) === 'slider';

const nf = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

/**
 * Валюта — единица отображения, а НЕ конвертация. Пересчёт по курсу требует
 * живого источника и протухает молча; человек вводит свои числа в своей валюте
 * и получает ответ в ней же. Подпись меняется, арифметика — нет.
 */
const currency = manifest.currency ?? null;
let currentCurrency = currency
  ? (params.get('cur') ?? currency.default ?? currency.options?.[0]?.code)
  : null;
const currencySign = () =>
  currency?.options?.find((o) => o.code === currentCurrency)?.sign ?? currentCurrency ?? '';
/** Подставляет знак валюты вместо маркера ¤ в единицах манифеста. */
const unitOf = (f) => String(f?.unit ?? '').replace(/¤/g, currencySign());

// ── Поля ─────────────────────────────────────────────────────────────────────
let currentGroup = null;
let groupEl = null;

for (const f of manifest.inputs) {
  if (f.group !== currentGroup) {
    currentGroup = f.group;
    groupEl = document.createElement('div');
    groupEl.className = 'group';
    if (f.group) {
      const t = document.createElement('p');
      t.className = 'group-title';
      t.textContent = f.group;
      groupEl.append(t);
    }
    form.append(groupEl);
  }

  const label = document.createElement('label');
  const row = document.createElement('span');
  row.className = 'label-row';
  const text = document.createElement('span');
  text.className = 'label-text';
  text.textContent = f.unit ? `${f.label}, ${unitOf(f)}` : f.label;
  row.append(text);
  label.append(row);

  const initial = params.get(f.id) ?? String(landing[f.id] ?? f.default ?? f.min ?? '');

  if (useSlider(f)) {
    // Ползунок ведёт скрытое числовое поле: расчёт и кейсы читают одно и то же
    // значение, а человек тянет пальцем. Значение показано рядом и крупно —
    // ползунок без числа не позволяет ни свериться, ни назвать результат.
    const value = document.createElement('span');
    value.className = 'slider-value';
    row.append(value);

    const wrap = document.createElement('span');
    wrap.className = 'slider-row';

    const range = document.createElement('input');
    range.type = 'range';
    range.min = String(f.min);
    range.max = String(f.max);
    range.step = String(f.step ?? (f.type === 'integer' ? 1 : 'any'));
    range.value = initial;
    range.setAttribute('aria-label', f.label);

    const num = document.createElement('input');
    num.type = 'hidden';
    num.name = f.id;
    num.value = initial;

    const sync = (v) => {
      num.value = v;
      value.innerHTML = '';
      value.append(document.createTextNode(nf.format(Number(v))));
      if (f.unit) {
        const u = document.createElement('span');
        u.className = 'unit';
        u.textContent = ` ${unitOf(f)}`;
        value.append(u);
      }
    };
    range.addEventListener('input', () => { sync(range.value); render(); });
    sync(initial);

    wrap.append(range);
    label.append(wrap, num);
  } else {
    const input = document.createElement(f.options ? 'select' : 'input');
    input.id = f.id;
    input.name = f.id;
    if (f.options) {
      for (const opt of f.options) {
        const o = document.createElement('option');
        o.value = String(opt.value ?? opt);
        o.textContent = String(opt.label ?? opt);
        input.append(o);
      }
    } else {
      // HTML не знает type="integer" — браузер откатывает его к текстовому полю
      // без цифровой клавиатуры на телефоне.
      const integer = f.type === 'integer';
      input.type = isNumeric(f) ? 'number' : f.type;
      if (isNumeric(f)) {
        input.inputMode = integer ? 'numeric' : 'decimal';
        input.step = String(f.step ?? (integer ? 1 : 'any'));
        if (f.min != null) input.min = String(f.min);
        if (f.max != null) input.max = String(f.max);
      }
      if (f.placeholder) input.placeholder = f.placeholder;
    }
    input.value = initial;
    if (f.required !== false) input.required = true;
    label.append(input);
  }

  // Пресеты: типичные значения одним нажатием. Поле, на котором человек не
  // знает числа наизусть, — то самое место, где он закрывает вкладку.
  if (Array.isArray(f.presets) && f.presets.length > 0) {
    const box = document.createElement('div');
    box.className = 'presets';
    for (const preset of f.presets) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'preset';
      b.textContent = preset.label;
      if (preset.note) b.title = preset.note;
      b.addEventListener('click', () => {
        const el = form.elements[f.id];
        el.value = String(preset.value);
        const range = el.parentElement?.querySelector('input[type="range"]');
        if (range) { range.value = String(preset.value); range.dispatchEvent(new Event('input')); }
        for (const other of box.querySelectorAll('.preset')) other.classList.remove('on');
        b.classList.add('on');
        render();
      });
      box.append(b);
    }
    label.append(box);
  }

  groupEl.append(label);
}

// Переключатель валюты — над формой: он меняет подписи всех полей сразу.
if (currency?.options?.length > 1) {
  const box = document.getElementById('currency');
  if (box) {
    const label = document.createElement('span');
    label.className = 'examples-label';
    label.textContent = 'Валюта:';
    box.append(label);
    for (const opt of currency.options) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (opt.code === currentCurrency ? ' on' : '');
      b.textContent = `${opt.sign} ${opt.code}`;
      b.addEventListener('click', () => {
        currentCurrency = opt.code;
        for (const other of box.querySelectorAll('.chip')) other.classList.remove('on');
        b.classList.add('on');
        relabel();
        render();
      });
      box.append(b);
    }
    box.hidden = false;
  }
}

/** Перерисовывает подписи, зависящие от валюты, не трогая введённые значения. */
function relabel() {
  for (const f of manifest.inputs) {
    const el = form.elements[f.id];
    const text = el?.closest('label')?.querySelector('.label-text');
    if (text) text.textContent = f.unit ? `${f.label}, ${unitOf(f)}` : f.label;
  }
}

// ── Чтение и проверка ────────────────────────────────────────────────────────
function read() {
  const data = {};
  for (const f of manifest.inputs) {
    const el = form.elements[f.id];
    data[f.id] = isNumeric(f) ? Number(el.value) : el.value;
  }
  return data;
}

function firstBadField() {
  for (const f of manifest.inputs) {
    if (f.required === false) continue;
    const raw = String(form.elements[f.id]?.value ?? '').trim();
    if (raw === '') return { f, why: 'не заполнено' };
    if (!isNumeric(f)) continue;
    const n = Number(raw);
    if (!Number.isFinite(n)) return { f, why: 'не число' };
    if (f.type === 'integer' && !Number.isInteger(n)) return { f, why: 'должно быть целым' };
    if (f.min != null && n < f.min) return { f, why: `меньше ${f.min}` };
    if (f.max != null && n > f.max) return { f, why: `больше ${f.max}` };
  }
  return null;
}

const heroOut = manifest.outputs.find((o) => o.role === 'hero') ?? manifest.outputs[0];
const detailOuts = manifest.outputs.filter((o) => o !== heroOut && o.role !== 'hidden');

// ── «Что если» ───────────────────────────────────────────────────────────────
/** Шаг подкрутки: целое — на единицу, дробное — на десятую диапазона либо 10%. */
function nudgeFor(f, value) {
  if (f.whatIf === false) return null;
  if (typeof f.whatIf === 'number') return f.whatIf;
  if (!isNumeric(f)) return null;
  if (f.type === 'integer') return 1;
  if (f.min != null && f.max != null) return Math.max(1, Math.round((f.max - f.min) / 10));
  return Math.max(1, Math.round(Math.abs(value) * 0.1));
}

function renderWhatIf(input, base) {
  whatIfBox.innerHTML = '';
  if (manifest.whatIf === false || !Number.isFinite(base)) { whatIfBox.hidden = true; return; }

  const rows = [];
  for (const f of manifest.inputs) {
    const step = nudgeFor(f, input[f.id]);
    if (step == null) continue;
    const next = Number(input[f.id]) + step;
    if (f.max != null && next > f.max) continue;
    if (f.min != null && next < f.min) continue;

    let value;
    try { value = calc({ ...input, [f.id]: next })[heroOut.id]; } catch { continue; }
    if (!Number.isFinite(value) || value === base) continue;

    rows.push({
      f, step, value,
      change: (value - base) / base,
      weight: Math.abs(value - base),
    });
  }

  rows.sort((a, b) => b.weight - a.weight);
  const top = rows.slice(0, 3);
  if (top.length === 0) { whatIfBox.hidden = true; return; }

  const title = document.createElement('p');
  title.className = 'whatif-title';
  title.textContent = 'Что если:';
  whatIfBox.append(title);

  for (const r of top) {
    const row = document.createElement('div');
    row.className = 'whatif-row';
    const left = document.createElement('span');
    const sign = r.step > 0 ? '+' : '−';
    // Короткое имя уже несёт единицу («часов в день»), поэтому вместе с
    // `unit` они дублируются: «+2 часов/день · часов в день».
    const name = r.f.short ?? `${r.f.unit ?? ''} · ${r.f.label}`.trim();
    left.textContent = `${sign}${nf.format(Math.abs(r.step))} ${name}`.trim();
    const right = document.createElement('span');
    right.className = `delta ${r.change > 0 ? 'up' : 'down'}`;
    const pct = Math.round(r.change * 100);
    right.textContent = `${nf.format(r.value)} ${unitOf(heroOut)} (${pct > 0 ? '+' : ''}${pct}%)`.trim();
    row.append(left, right);
    whatIfBox.append(row);
  }
  whatIfBox.hidden = false;
}

// ── Отрисовка ────────────────────────────────────────────────────────────────
let lastResult = null;

function render() {
  const bad = firstBadField();
  if (bad) {
    out.className = 'result muted';
    out.textContent = `${bad.f.label} — ${bad.why}.`;
    whatIfBox.hidden = true;
    shareBtn.hidden = true;
    if (cardBtn) cardBtn.hidden = true;
    lastResult = null;
    return;
  }

  const input = read();
  let result;
  try { result = calc(input); } catch {
    out.className = 'result muted';
    out.textContent = 'Проверьте введённые значения.';
    return;
  }

  const heroValue = result[heroOut.id];
  if (heroValue == null || (typeof heroValue === 'number' && !Number.isFinite(heroValue))) {
    out.className = 'result muted';
    out.textContent = 'При таких значениях расчёт не имеет смысла — проверьте поля.';
    whatIfBox.hidden = true;
    shareBtn.hidden = true;
    if (cardBtn) cardBtn.hidden = true;
    lastResult = null;
    return;
  }

  out.className = 'result';
  const shown = format(result);
  out.innerHTML = '';

  const label = document.createElement('span');
  label.className = 'hero-label';
  label.textContent = heroOut.label ?? '';
  const big = document.createElement('span');
  big.className = 'big';
  big.append(document.createTextNode(shown[heroOut.id]));
  if (heroOut.unit) {
    const u = document.createElement('span');
    u.className = 'unit';
    u.textContent = unitOf(heroOut);
    big.append(u);
  }
  out.append(label, big);

  for (const o of detailOuts) {
    if (shown[o.id] == null) continue;
    const row = document.createElement('div');
    row.className = 'row';
    row.append(
      Object.assign(document.createElement('span'), { textContent: o.label ?? o.id }),
      Object.assign(document.createElement('b'), {
        textContent: `${shown[o.id]}${o.unit ? ' ' + unitOf(o) : ''}`,
      }),
    );
    out.append(row);
  }

  lastResult = { input, result, shown };
  renderWhatIf(input, Number(heroValue));

  if (manifest.share?.enabled !== false) {
    const url = new URL(location.href);
    url.search = new URLSearchParams(Object.entries(input).map(([k, v]) => [k, String(v)]));
    shareBtn.hidden = false;
    shareBtn.dataset.url = url.toString();
  }
  if (cardBtn) cardBtn.hidden = manifest.share?.card === false;
}

// ── Примеры из кейсов ────────────────────────────────────────────────────────
for (const c of manifest.cases ?? []) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'chip';
  b.textContent = c.name;
  b.addEventListener('click', () => {
    for (const [id, v] of Object.entries(c.input)) {
      const el = form.elements[id];
      if (!el) continue;
      el.value = String(v);
      const range = el.parentElement?.querySelector('input[type="range"]');
      if (range) { range.value = String(v); range.dispatchEvent(new Event('input')); }
    }
    render();
    out.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  examplesBox.append(b);
}
if ((manifest.cases ?? []).length > 0) {
  const l = document.createElement('span');
  l.className = 'examples-label';
  l.textContent = 'Примеры:';
  examplesBox.prepend(l);
  examplesBox.hidden = false;
}

form.addEventListener('input', render);

shareBtn?.addEventListener('click', async () => {
  const url = shareBtn.dataset.url;
  if (navigator.share) { await navigator.share({ title: manifest.name, url }).catch(() => {}); return; }
  await navigator.clipboard.writeText(url);
  shareBtn.textContent = 'Ссылка скопирована';
  setTimeout(() => { shareBtn.textContent = 'Скопировать ссылку'; }, 2000);
});

cardBtn?.addEventListener('click', async () => {
  if (!lastResult) return;
  const { drawResultCard } = await import('./lib/card.js');
  await drawResultCard({ manifest, heroOut, detailOuts, ...lastResult });
});

render();
