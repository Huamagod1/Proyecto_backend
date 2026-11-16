/**
 * tiempo-real.test.js · WebSocket: rechazo sin token, filtro por sitio y armado de mensajes (Fase 9).
 * Levanta un servidor HTTP real en un puerto libre (listen(0)) con crearApp() y le conecta clientes
 * `ws` como haría el navegador. No usa MySQL: difundir() se llama directo.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import WebSocket from 'ws';
import { crearApp } from '../src/api/app.js';
import { cerrarPool } from '../src/api/db.js';
import { iniciarTiempoReal, lecturasAMensajes } from '../src/api/tiempo-real.js';
import { tokenDe, NORTE, SUR } from './ayudas.js';

let servidor;
let tiempoReal;
let url;

before(async () => {
  servidor = crearApp().listen(0); // 0: el sistema elige un puerto libre
  await once(servidor, 'listening');
  tiempoReal = iniciarTiempoReal(servidor);
  url = `ws://127.0.0.1:${servidor.address().port}/ws`;
});

after(async () => {
  tiempoReal.cerrar();
  servidor.close();
  await cerrarPool();
});

/** Conecta un cliente y espera su mensaje de bienvenida. */
async function conectar(token) {
  const ws = new WebSocket(`${url}?token=${token}`);
  const mensajes = [];
  ws.on('message', (datos) => mensajes.push(JSON.parse(datos)));
  await once(ws, 'open');
  while (mensajes.length === 0) await new Promise((r) => setTimeout(r, 10)); // espera la bienvenida
  return { ws, mensajes };
}

test('sin token o con un token inválido, el upgrade se rechaza con 401', async () => {
  const ws = new WebSocket(`${url}?token=no-es-un-jwt`);
  // OJO: cerrar un socket que nunca conectó emite 'error'; sin este oyente, Node lo trata como
  // una excepción no atrapada y la prueba falla después de terminar.
  ws.on('error', () => {});
  // 'unexpected-response': el servidor contestó HTTP en vez de aceptar el WebSocket.
  const [, respuesta] = await once(ws, 'unexpected-response');
  assert.equal(respuesta.statusCode, 401);
  ws.terminate();
});

test('cada cliente recibe solo los mensajes de los sitios que puede ver', async () => {
  const norte = await conectar(tokenDe('ingeniero', NORTE));
  const sur = await conectar(tokenDe('lector', SUR));
  const admin = await conectar(tokenDe('admin'));
  assert.equal(norte.mensajes[0].tipo, 'bienvenida');

  tiempoReal.difundir({ tipo: 'lecturas', motor: 'MTR-01', sitio_id: NORTE, lecturas: [] });
  tiempoReal.difundir({ tipo: 'lecturas', motor: 'MTR-03', sitio_id: SUR, lecturas: [] });
  await new Promise((r) => setTimeout(r, 100)); // 100 ms para que lleguen por la red local

  const motores = (c) => c.mensajes.filter((m) => m.tipo === 'lecturas').map((m) => m.motor);
  assert.deepEqual(motores(norte), ['MTR-01']);
  assert.deepEqual(motores(sur), ['MTR-03']);
  assert.deepEqual(motores(admin), ['MTR-01', 'MTR-03']);
  for (const c of [norte, sur, admin]) c.ws.close();
});

test('lecturasAMensajes agrupa por motor y deja la lectura más nueva de cada variable', () => {
  const catalogoFalso = {
    motorPorId: (id) => ({ 1: { codigo: 'MTR-01', sitio_id: NORTE } })[id],
    variablePorId: (id) => ({ 1: { codigo: 'rpm', unidad: 'rpm' } })[id],
  };
  const antes = new Date('2026-11-16T10:00:00Z');
  const despues = new Date('2026-11-16T10:00:05Z');
  const mensajes = lecturasAMensajes([[1, 1, antes, 1490, 0], [1, 1, despues, 1500, 0]], catalogoFalso);
  assert.deepEqual(mensajes, [
    { tipo: 'lecturas', motor: 'MTR-01', sitio_id: NORTE, lecturas: [{ variable: 'rpm', unidad: 'rpm', ts: despues, valor: 1500, calidad: 0 }] },
  ]);
});
