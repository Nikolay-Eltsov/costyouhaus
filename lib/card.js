/**
 * Карточка результата: картинка, которую человек кидает в переписку.
 *
 * Зачем это продукту: человек приходит сюда не ради цифры как таковой, а
 * чтобы её кому-то назвать. Скриншот он сделает и сам — но кривой, с адресной
 * строкой и половиной страницы. Карточка даёт ему готовый аргумент, а нам —
 * приток без рекламы: адрес продукта уезжает вместе с картинкой.
 *
 * Рисуется на Canvas в браузере: ни сервера, ни зависимостей. Палитра
 * намеренно светлая и фиксированная — тёмная карточка в чужой переписке
 * выглядит сломанной, а не стильной.
 */

const W = 1200;
const H = 630;
const PAD = 80;

const INK = '#16191c';
const MUTED = '#6b7680';
const ACCENT = '#0b7a66';
const BG = '#faf9f6';
const LINE = '#e4e1d9';

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

/** Переносит текст по словам и возвращает высоту занятого блока. */
function wrap(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text).split(/\s+/);
  let line = '';
  let dy = 0;
  for (const word of words) {
    const probe = line ? `${line} ${word}` : word;
    if (ctx.measureText(probe).width > maxWidth && line) {
      ctx.fillText(line, x, y + dy);
      line = word;
      dy += lineHeight;
    } else {
      line = probe;
    }
  }
  if (line) ctx.fillText(line, x, y + dy);
  return dy + lineHeight;
}

export async function drawResultCard({ manifest, heroOut, detailOuts, shown }) {
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
  const canvas = document.createElement('canvas');
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Акцентная полоса слева — тот же приём, что у блока результата на странице.
  ctx.fillStyle = ACCENT;
  ctx.fillRect(0, 0, 10, H);

  let y = PAD + 10;

  ctx.fillStyle = MUTED;
  ctx.font = `500 26px ${FONT}`;
  ctx.fillText(manifest.name, PAD, y);
  y += 58;

  ctx.fillStyle = MUTED;
  ctx.font = `400 30px ${FONT}`;
  y += wrap(ctx, heroOut.label ?? '', PAD, y, W - PAD * 2, 40);
  y += 8;

  // Главная цифра — ради неё карточку и делают.
  ctx.fillStyle = INK;
  ctx.font = `700 132px ${FONT}`;
  const hero = String(shown[heroOut.id] ?? '');
  ctx.fillText(hero, PAD, y + 96);
  const heroWidth = ctx.measureText(hero).width;
  if (heroOut.unit) {
    ctx.fillStyle = MUTED;
    ctx.font = `500 44px ${FONT}`;
    ctx.fillText(heroOut.unit, PAD + heroWidth + 18, y + 96);
  }
  y += 150;

  const details = detailOuts.filter((o) => shown[o.id] != null).slice(0, 2);
  if (details.length) {
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PAD, y + 26);
    ctx.lineTo(W - PAD, y + 26);
    ctx.stroke();
    y += 70;

    ctx.font = `400 28px ${FONT}`;
    for (const o of details) {
      ctx.fillStyle = MUTED;
      ctx.fillText(o.label ?? o.id, PAD, y);
      const value = `${shown[o.id]}${o.unit ? ' ' + o.unit : ''}`;
      ctx.fillStyle = INK;
      ctx.textAlign = 'right';
      ctx.fillText(value, W - PAD, y);
      ctx.textAlign = 'left';
      y += 46;
    }
  }

  // Адрес продукта: единственная причина, по которой карточка окупается.
  ctx.fillStyle = ACCENT;
  ctx.font = `500 26px ${FONT}`;
  ctx.fillText(location.host, PAD, H - PAD + 10);

  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) return;

  const file = new File([blob], `${manifest.slug}.png`, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: manifest.name }).catch(() => {});
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${manifest.slug}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
