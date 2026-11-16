/**
 * motores.test.js · pruebas del CRUD de motores contra la base telemetria_test (Fase 3).
 * Usa crearApp() con supertest: las peticiones van directo a Express, sin abrir un puerto.
 * Un caso por fila de la tabla del plan, más salud, 404 y JSON roto.
 * Antes de correrlas: bash src/scripts/preparar-db-test.sh
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { crearApp } from '../src/api/app.js';
import { cerrarPool } from '../src/api/db.js';

const app = crearApp();

// Código distinto en cada corrida: las pruebas pasan aunque se repitan sin recrear la base.
const codigo = `MTR-${Math.floor(1000 + Math.random() * 9000)}`;

// OJO: sin cerrar el pool, sus conexiones abiertas mantienen vivo el proceso y la prueba no termina.
after(() => cerrarPool());

test('GET /api/salud responde ok con la base arriba', async () => {
  const res = await request(app).get('/api/salud');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { estado: 'ok', db: 'ok' });
});

test('GET /api/motores lista los activos con el código del sitio', async () => {
  const res = await request(app).get('/api/motores');
  assert.equal(res.status, 200);
  const mtr01 = res.body.find((m) => m.codigo === 'MTR-01');
  assert.equal(mtr01.sitio, 'norte');
});

test('POST /api/motores crea el motor: 201 con Location', async () => {
  const res = await request(app)
    .post('/api/motores')
    .send({ codigo, modelo: '12V4000', sitio_id: 1 }); // send() con un objeto manda JSON
  assert.equal(res.status, 201);
  assert.equal(res.headers.location, `/api/motores/${codigo}`);
  assert.equal(res.body.sitio, 'norte');
});

test('POST con un código que ya existe: 409', async () => {
  const res = await request(app).post('/api/motores').send({ codigo, modelo: 'X', sitio_id: 1 });
  assert.equal(res.status, 409);
});

test('POST con datos inválidos: 422 con el detalle por campo', async () => {
  const res = await request(app).post('/api/motores').send({ codigo: 'X' });
  assert.equal(res.status, 422);
  assert.ok(res.body.detalle.codigo, 'debe explicar qué falla en codigo');
  assert.ok(res.body.detalle.modelo, 'y que falta modelo');
});

test('POST con un sitio que no existe: 422', async () => {
  const res = await request(app).post('/api/motores').send({ codigo: 'MTR-9999', modelo: 'X', sitio_id: 999 });
  assert.equal(res.status, 422);
  assert.deepEqual(res.body.detalle, { sitio_id: ['el sitio no existe'] });
});

test('POST con JSON mal formado: 400', async () => {
  const res = await request(app)
    .post('/api/motores')
    .set('Content-Type', 'application/json')
    .send('{"codigo":'); // texto crudo, cortado a propósito
  assert.equal(res.status, 400);
});

test('GET /api/motores/:codigo: 200 si existe, 404 si no', async () => {
  assert.equal((await request(app).get(`/api/motores/${codigo}`)).status, 200);
  assert.equal((await request(app).get('/api/motores/MTR-0000')).status, 404);
});

test('PUT actualiza modelo y sitio: 200; 404 si no existe; 422 si no valida', async () => {
  const ok = await request(app).put(`/api/motores/${codigo}`).send({ modelo: '16V4000', sitio_id: 2 });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.sitio, 'sur');
  // Los mismos datos otra vez: sigue siendo 200 aunque MySQL no cambie ninguna fila.
  const igual = await request(app).put(`/api/motores/${codigo}`).send({ modelo: '16V4000', sitio_id: 2 });
  assert.equal(igual.status, 200);
  const noExiste = await request(app).put('/api/motores/MTR-0000').send({ modelo: 'X', sitio_id: 1 });
  assert.equal(noExiste.status, 404);
  const invalido = await request(app).put(`/api/motores/${codigo}`).send({ modelo: '' });
  assert.equal(invalido.status, 422);
});

test('DELETE da de baja: 204, deja de listarse y la segunda vez es 404', async () => {
  assert.equal((await request(app).delete(`/api/motores/${codigo}`)).status, 204);
  assert.equal((await request(app).get(`/api/motores/${codigo}`)).status, 404);
  assert.equal((await request(app).delete(`/api/motores/${codigo}`)).status, 404);
});

test('una ruta que no existe responde 404 en JSON', async () => {
  const res = await request(app).get('/api/no-existe');
  assert.equal(res.status, 404);
  assert.match(res.body.error, /No existe GET/);
});
