import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runModel, runAll } from '../model.mjs';
import { TABLES, BOTTLES, RULES } from '../data.mjs';

test('hay 42 mesas repartidas en 4 zonas', () => {
  assert.equal(TABLES.length, 42);
  const by = Object.groupBy(TABLES, (t) => t.zone);
  assert.deepEqual(Object.fromEntries(Object.entries(by).map(([k, v]) => [k, v.length])), { tarima: 14, principal: 7, petit: 16, ghost: 5 });
});

test('los escenarios están ordenados y caben en la capacidad libre', () => {
  const r = runAll();
  assert.ok(r.conservador.extraRevenue < r.base.extraRevenue && r.base.extraRevenue < r.optimista.extraRevenue);
  for (const s of Object.values(r)) assert.ok(s.fitsInFreeCapacity);
});

test('el escenario conservador ya cubre el coste del servicio', () => {
  assert.ok(runModel('conservador').net > 0);
});

test('cambiar un supuesto cambia el resultado', () => {
  const a = runModel('base');
  const b = runModel('base', { assumptions: { occupancy: { thu: 0.2 } } });
  assert.ok(b.baseline.baseRevenue < a.baseline.baseRevenue);
});

test('la carta tiene precios válidos y el suplemento es del 20 %', () => {
  assert.ok(BOTTLES.length > 100 && BOTTLES.every((b) => b.price >= 200));
  assert.equal(RULES.extraSurcharge, 0.2);
});
