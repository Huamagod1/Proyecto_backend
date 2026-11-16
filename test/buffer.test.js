/**
 * buffer.test.js · el cuaderno del gateway: guardar, leer en orden, confirmar y tope (Fase 7).
 * Usa una base SQLite ':memory:' (vive en RAM y desaparece al cerrar): sin archivos de prueba.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { abrirBuffer } from '../src/gateway/buffer-local.js';

test('guarda, entrega en orden de llegada y borra solo lo confirmado', () => {
  const b = abrirBuffer(':memory:');
  b.guardar('t/1', '{"n":1}');
  b.guardar('t/2', '{"n":2}');
  b.guardar('t/3', '{"n":3}');
  assert.equal(b.pendientes(), 3);

  const lote = b.siguientes(2);
  assert.deepEqual(lote.map((p) => p.payload), ['{"n":1}', '{"n":2}']);

  b.confirmar(lote[0].id); // el broker confirmó solo el primero
  assert.equal(b.pendientes(), 2);
  assert.deepEqual(b.siguientes(10).map((p) => p.topico), ['t/2', 't/3']);
  b.cerrar();
});

test('con el tope lleno descarta los más antiguos y lo informa', () => {
  const b = abrirBuffer(':memory:', { maxPendientes: 3 });
  for (let i = 1; i <= 3; i++) assert.equal(b.guardar('t', String(i)).descartados, 0);
  const r = b.guardar('t', '4');
  assert.equal(r.descartados, 1);
  assert.equal(b.pendientes(), 3);
  assert.deepEqual(b.siguientes(10).map((p) => p.payload), ['2', '3', '4']);
  b.cerrar();
});
