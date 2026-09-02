/**
 * Проверка расчёта по кейсам из product.json. Кейсы пишет Постановщик,
 * до того как появился код: они и есть техзадание в исполняемом виде.
 *
 * Запуск: node --test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { calc } from '../lib/calc.js';

const manifest = JSON.parse(
  readFileSync(new URL('../product.json', import.meta.url), 'utf8'),
);

test('в манифесте есть хотя бы два кейса', () => {
  assert.ok(
    Array.isArray(manifest.cases) && manifest.cases.length >= 2,
    'кейсов меньше двух: один кейс не отличает работающий расчёт от заглушки',
  );
});

for (const c of manifest.cases ?? []) {
  test(`кейс: ${c.name}`, () => {
    const got = calc(c.input);
    for (const [key, want] of Object.entries(c.expect)) {
      const actual = got[key];
      if (typeof want === 'number' && typeof actual === 'number') {
        const tol = c.tolerance ?? 0.01;
        assert.ok(
          Math.abs(actual - want) <= tol,
          `${key}: ожидали ${want} ±${tol}, получили ${actual}`,
        );
      } else {
        assert.deepEqual(actual, want, `${key}`);
      }
    }
  });
}

void fileURLToPath;
