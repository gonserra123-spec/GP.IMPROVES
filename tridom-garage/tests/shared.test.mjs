import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { classifyPlate, formatPlate, normalizePlate } from '../shared/plates.js';
import { capacities, locationsFor, pickSlot, preferredLocations } from '../shared/domain.js';
import { freeTextError, validateContact, validateNewVehicle, validatePart, validatePatch } from '../shared/validate.js';

const catalog = JSON.parse(readFileSync(new URL('../shared/models.json', import.meta.url), 'utf8'));
const tpl = { lifts: 2, pit: true };

test('matrículas: normaliza y clasifica los tres formatos', () => {
  assert.equal(normalizePlate(' 1234-bcd '), '1234BCD');
  assert.equal(classifyPlate('1234BCD'), 'es_current');
  assert.equal(classifyPlate('1234ABC'), 'generic'); // con vocal no es formato español actual
  assert.equal(classifyPlate('1234BCQ'), 'generic'); // la Q tampoco
  assert.equal(classifyPlate('V1234AB'), 'es_old');
  assert.equal(classifyPlate('XX1234AB'), 'generic'); // XX no es una provincia
  assert.equal(classifyPlate('AB12CDE'), 'generic');
  assert.equal(classifyPlate('12'), null);
  assert.equal(classifyPlate('1234 BCD'), null); // sin normalizar no pasa
  assert.equal(formatPlate('1234BCD'), '1234 BCD');
});

test('catálogo: al menos 40 modelos, ids únicos y los 10 arquetipos', () => {
  assert.ok(catalog.length >= 40);
  assert.equal(new Set(catalog.map((m) => m.id)).size, catalog.length);
  assert.equal(new Set(catalog.map((m) => m.body)).size, 10);
  for (const m of catalog) assert.ok(m.l > 3 && m.l < 6 && m.w > 1.5 && m.w < 2.2 && m.h > 1.2 && m.h < 2.7, m.id);
});

test('plazas: capacidad, preferencias por estado y primera plaza libre', () => {
  assert.deepEqual(locationsFor(tpl), ['reception', 'lift1', 'lift2', 'pit', 'diagnosis_bay', 'waiting', 'parking', 'pickup']);
  assert.equal(capacities({ lifts: 1, pit: false }).pit, undefined);
  assert.deepEqual(preferredLocations('in_repair', tpl, 'pit'), ['pit']);
  assert.deepEqual(preferredLocations('in_repair', tpl, 'waiting'), ['lift1', 'lift2', 'pit']);
  assert.deepEqual(pickSlot(new Set(['lift1:0']), tpl, ['lift1', 'lift2']), { location: 'lift2', slot: 0 });
  assert.equal(pickSlot(new Set(['lift1:0', 'lift2:0']), tpl, ['lift1', 'lift2']), null);
  assert.deepEqual(pickSlot(new Set(['waiting:0']), tpl, ['waiting']), { location: 'waiting', slot: 1 });
});

test('validación: texto libre con mínimo de 10 solo si se rellena', () => {
  assert.equal(freeTextError(''), null);
  assert.equal(freeTextError('', { required: true }), 'required');
  assert.equal(freeTextError('corto'), 'too_short');
  assert.equal(freeTextError('texto suficiente'), null);
  assert.equal(freeTextError('x'.repeat(600)), 'too_long');
});

test('validación: alta de coche', () => {
  assert.equal(validateNewVehicle({ plate: '1234 bcd', modelId: 'seat-leon' }, catalog).ok, true);
  assert.equal(validateNewVehicle({ plate: 'AB12CDE', modelId: 'seat-leon' }, catalog).errors.plate, 'plate_format');
  assert.equal(validateNewVehicle({ plate: 'AB12CDE', foreign: true, modelId: 'seat-leon' }, catalog).ok, true);
  assert.equal(validateNewVehicle({ plate: '1234BCD', modelId: 'no-existe' }, catalog).errors.modelId, 'required');
  assert.deepEqual(Object.keys(validateNewVehicle({ plate: '1234BCD', modelId: 'other' }, catalog).errors).sort(), ['bodyType', 'make', 'model']);
  assert.equal(validateNewVehicle({ plate: '1234BCD', modelId: 'seat-leon', phone: '12' }, catalog).errors.phone, 'phone_format');
  assert.equal(validateNewVehicle({ plate: '1234BCD', modelId: 'seat-leon', id: 'x' }, catalog).errors.id, 'invalid');
});

test('validación: cambios, piezas y contacto', () => {
  assert.equal(validatePatch({ state: 'volando' }).errors.state, 'invalid');
  assert.equal(validatePatch({ notes: 'corto' }).errors.notes, 'too_short');
  assert.equal(validatePatch({ costEstimate: '12a' }).errors.costEstimate, 'cost_format');
  assert.equal(validatePatch({ costEstimate: '120,50', etaAt: '2026-11-20', notes: '' }).ok, true);
  assert.equal(validatePart({ description: 'abc' }).errors.description, 'too_short');
  assert.equal(validatePart({ state: 'arrived' }, { partial: true }).ok, true);
  const bad = validateContact({ name: 'x', email: 'no', message: 'corto' });
  assert.deepEqual(Object.keys(bad.errors).sort(), ['consent', 'email', 'message', 'name', 'workshop']);
  assert.equal(validateContact({ name: 'Ana', workshop: 'Taller', email: 'a@b.es', message: 'Mensaje de prueba largo', consent: true }).ok, true);
});

import { cleanTags, isVehicleCode, tagError, validateWorkshopSettings } from '../shared/validate.js';

test('etiquetas: 3 a 40 caracteres, sin duplicados ni espacios de más', () => {
  assert.equal(tagError('ab'), 'too_short_tag');
  assert.equal(tagError('Aceite'), null);
  assert.equal(tagError('x'.repeat(41)), 'too_long');
  assert.equal(tagError(5), 'invalid');
  assert.deepEqual(cleanTags([' Aceite  y filtros ', 'Aceite y filtros', ''], 8), ['Aceite y filtros']);
});

test('código de coche: 6 caracteres sin I, O, 0 ni 1', () => {
  assert.ok(isVehicleCode('K7M2QX') && isVehicleCode('k7m2qx'));
  for (const bad of ['K7M2Q', 'K7M2QXA', 'KIM2QX', 'KOM2QX', 'K0M2QX', 'K1M2QX', '', null]) assert.equal(isVehicleCode(bad), false, String(bad));
});

test('ajustes del taller: cada campo se valida por separado', () => {
  assert.equal(validateWorkshopSettings({ staleDays: 5 }).ok, true);
  assert.equal(validateWorkshopSettings({ noteTags: null }).ok, true);
  assert.equal(validateWorkshopSettings({ noteTags: ['Aceite'] }).ok, true);
  assert.equal(validateWorkshopSettings({}).ok, false);
  assert.equal(validateWorkshopSettings({ retentionDays: 400 }).ok, false);
  assert.equal(validateWorkshopSettings({ staleDays: 1.5 }).ok, false);
});
