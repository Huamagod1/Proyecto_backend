/**
 * loteador.test.js · pruebas del loteador con un `escribir` falso, sin base de datos (Fase 6).
 * Cubren lo que pide el plan: escribe al juntar maxFilas o al pasar intervaloMs, una escritura a
 * la vez, reintento en orden si la base falla, descarte de las más antiguas sobre el tope y
 * detener() que vacía lo pendiente.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearLoteador } from '../src/api/loteador.js';

/** Espera `ms` milisegundos. */
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/** Un `escribir` falso que anota cada lote recibido. */
function escritorFalso() {
  const lotes = [];
  return { lotes, escribir: async (lote) => { lotes.push([...lote]); } };
}

test('escribe en cuanto junta maxFilas, sin esperar el intervalo', async () => {
  const e = escritorFalso();
  const l = crearLoteador({ escribir: e.escribir, maxFilas: 3, intervaloMs: 60_000 });
  l.agregar([1, 2]);
  await esperar(10);
  assert.equal(e.lotes.length, 0, 'con 2 de 3 todavía no escribe');
  l.agregar([3]);
  await esperar(10);
  assert.deepEqual(e.lotes, [[1, 2, 3]]);
  await l.detener();
});

test('escribe lo que haya al pasar intervaloMs', async () => {
  const e = escritorFalso();
  const l = crearLoteador({ escribir: e.escribir, maxFilas: 100, intervaloMs: 20 });
  l.agregar(['a']);
  await esperar(60);
  assert.deepEqual(e.lotes, [['a']]);
  await l.detener();
});

test('nunca hay dos escrituras al mismo tiempo', async () => {
  let enCurso = 0;
  let maximo = 0;
  const escribir = async () => {
    enCurso++;
    maximo = Math.max(maximo, enCurso);
    await esperar(30); // una base lenta
    enCurso--;
  };
  const l = crearLoteador({ escribir, maxFilas: 2, intervaloMs: 5 });
  for (let i = 0; i < 10; i++) l.agregar([i, i]); // dispara muchas veces vaciar()
  await esperar(250);
  await l.detener();
  assert.equal(maximo, 1);
  assert.equal(l.estadisticas().escritas, 20);
});

test('si la base falla, conserva las filas y las reintenta en orden', async () => {
  const lotes = [];
  let falla = true;
  const escribir = async (lote) => {
    if (falla) throw new Error('base caída');
    lotes.push([...lote]);
  };
  const l = crearLoteador({ escribir, maxFilas: 10, intervaloMs: 20 });
  l.agregar([1, 2, 3]);
  await esperar(50); // al menos un intento fallido
  l.agregar([4]);    // llega algo nuevo mientras la base sigue caída
  assert.ok(l.estadisticas().fallos >= 1);
  assert.equal(l.estadisticas().pendientes, 4);
  falla = false;     // la base vuelve
  await esperar(50);
  assert.deepEqual(lotes.flat(), [1, 2, 3, 4], 'mismo orden de llegada, sin pérdidas');
  await l.detener();
});

test('sobre maxEnMemoria descarta las más antiguas y las cuenta', async () => {
  const l = crearLoteador({ escribir: async () => { throw new Error('caída'); }, maxFilas: 100, maxEnMemoria: 5, intervaloMs: 60_000 });
  l.agregar([1, 2, 3, 4, 5, 6, 7]);
  const s = l.estadisticas();
  assert.equal(s.pendientes, 5);
  assert.equal(s.descartadas, 2); // se fueron la 1 y la 2
  await l.detener();
});

test('detener() escribe lo pendiente y devuelve 0', async () => {
  const e = escritorFalso();
  const l = crearLoteador({ escribir: e.escribir, maxFilas: 100, intervaloMs: 60_000 });
  l.agregar(['x', 'y']);
  const quedaron = await l.detener();
  assert.equal(quedaron, 0);
  assert.deepEqual(e.lotes, [['x', 'y']]);
});
