/**
 * j1939.test.js · identificador de 29 bits, EEC1, ET1 y el formato de candump (Fase 8).
 * Escritas antes que el código, con los casos verificados de la tabla del plan, más el ejercicio a
 * mano de las 1800 rpm y la decodificación de una línea completa de candump.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  desarmarId,
  decodificarEEC1,
  decodificarET1,
  parsearLineaCandump,
  decodificarTrama,
} from '../src/comun/j1939.js';

const bytes = (hex) => Buffer.from(hex, 'hex'); // 'F07D...' → Buffer de 8 bytes

test('desarmarId: EEC1 del motor (0x0CF00400)', () => {
  assert.deepEqual(desarmarId(0x0cf00400), { prioridad: 3, pgn: 61444, destino: null, origen: 0 });
});

test('desarmarId: ET1 (0x18FEEE00)', () => {
  assert.deepEqual(desarmarId(0x18feee00), { prioridad: 6, pgn: 65262, destino: null, origen: 0 });
});

test('desarmarId: con PF < 240, PS es el destino y no entra al PGN (0x18EAFF00)', () => {
  assert.deepEqual(desarmarId(0x18eaff00), { prioridad: 6, pgn: 59904, destino: 255, origen: 0 });
});

test('EEC1 F07D7DE02EFFFFFF son 1500 rpm', () => {
  assert.deepEqual(decodificarEEC1(bytes('F07D7DE02EFFFFFF')), { rpm: 1500 });
});

test('ejercicio del plan: bytes 4 y 5 = 40 38 son 1800 rpm', () => {
  assert.deepEqual(decodificarEEC1(bytes('F07D7D4038FFFFFF')), { rpm: 1800 });
});

test('EEC1 con FFFF en los bytes 4 y 5 da null (no disponible)', () => {
  assert.deepEqual(decodificarEEC1(bytes('F07D7DFFFFFFFFFF')), { rpm: null });
});

test('ET1 7DFFFFFFFFFFFFFF son 85 °C; con 0xFF, null', () => {
  assert.deepEqual(decodificarET1(bytes('7DFFFFFFFFFFFFFF')), { temp_refrigerante: 85 });
  assert.deepEqual(decodificarET1(bytes('FFFFFFFFFFFFFFFF')), { temp_refrigerante: null });
});

test('parsearLineaCandump separa hora, interfaz, id y datos', () => {
  const t = parsearLineaCandump('(1794744000.123456) can0 0CF00400#F07D7DE02EFFFFFF');
  assert.equal(t.ts.toISOString(), new Date(1794744000123).toISOString());
  assert.equal(t.interfaz, 'can0');
  assert.equal(t.id, 0x0cf00400);
  assert.deepEqual([...t.datos], [...bytes('F07D7DE02EFFFFFF')]);
  assert.equal(parsearLineaCandump('# un comentario'), null);
});

test('decodificarTrama elige el decodificador por PGN e ignora los desconocidos', () => {
  assert.deepEqual(decodificarTrama(0x0cf00400, bytes('F07D7DE02EFFFFFF')), { pgn: 61444, lecturas: { rpm: 1500 } });
  assert.deepEqual(decodificarTrama(0x18fef100, bytes('FFFFFFFFFFFFFFFF')), { pgn: 65265, lecturas: {} });
});
