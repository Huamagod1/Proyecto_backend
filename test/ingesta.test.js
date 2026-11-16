/**
 * ingesta.test.js · POST /api/lecturas, series y estado contra telemetria_test (Fase 5).
 * Cubre los casos del plan: lote mixto con conteos, el mismo lote dos veces (idempotencia), 401,
 * 403, 422 por forma, lote vacío, JSON roto y lote sin ninguna lectura válida. Suma las consultas
 * y la regla de estado_actual (una lectura atrasada no pisa a una más nueva).
 * Las horas se calculan desde "ahora", con un desfase al azar: cada corrida usa instantes nuevos.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { crearApp } from '../src/api/app.js';
import { cerrarPool } from '../src/api/db.js';
import { tokenDe, conToken, NORTE, SUR } from './ayudas.js';

const app = crearApp();
const gateway = conToken(tokenDe('gateway', NORTE));
const base = Date.now() - 60_000 - Math.floor(Math.random() * 3_600_000); // en la última hora y algo
const hace = (seg) => new Date(base - seg * 1000).toISOString();           // ISO con Z
after(() => cerrarPool());

/** El lote del plan: buenas, una fuera de rango, una de cada motivo de rechazo. */
function loteMixto() {
  return {
    lecturas: [
      { motor: 'MTR-01', variable: 'rpm', ts: hace(30), valor: 1500 },                // 0 buena
      { motor: 'MTR-01', variable: 'temp_refrigerante', ts: hace(30), valor: 85.2 },  // 1 buena
      { motor: 'MTR-02', variable: 'rpm', ts: hace(30), valor: 1480 },                // 2 buena
      { motor: 'MTR-01', variable: 'temp_refrigerante', ts: hace(20), valor: 160 },   // 3 fuera de rango (máx. 150)
      { motor: 'MTR-999', variable: 'rpm', ts: hace(30), valor: 1 },                  // 4 motor_desconocido
      { motor: 'MTR-03', variable: 'rpm', ts: hace(30), valor: 1 },                   // 5 motor_de_otro_sitio (sur)
      { motor: 'MTR-01', variable: 'humedad', ts: hace(30), valor: 1 },               // 6 variable_desconocida
      { motor: 'MTR-01', variable: 'rpm', ts: new Date(Date.now() + 10 * 60_000).toISOString(), valor: 1 }, // 7 futuro
      { motor: 'MTR-01', variable: 'rpm', ts: new Date(Date.now() - 31 * 86_400_000).toISOString(), valor: 1 }, // 8 antigua
    ],
  };
}

test('un lote mixto da los conteos correctos', async () => {
  const res = await request(app).post('/api/lecturas').set(gateway).send(loteMixto());
  assert.equal(res.status, 201);
  assert.deepEqual(res.body, {
    recibidas: 9,
    nuevas: 4,
    repetidas: 0,
    fueraDeRango: 1,
    rechazadas: [
      { indice: 4, motivo: 'motor_desconocido' },
      { indice: 5, motivo: 'motor_de_otro_sitio' },
      { indice: 6, motivo: 'variable_desconocida' },
      { indice: 7, motivo: 'hora_en_el_futuro' },
      { indice: 8, motivo: 'hora_demasiado_antigua' },
    ],
  });
});

test('el mismo lote dos veces: nuevas 0 (idempotencia)', async () => {
  const res = await request(app).post('/api/lecturas').set(gateway).send(loteMixto());
  assert.equal(res.status, 201);
  assert.equal(res.body.nuevas, 0);
  assert.equal(res.body.repetidas, 4);
});

test('la lectura fuera de rango se guarda con calidad 1', async () => {
  const desde = hace(25);
  const res = await request(app)
    .get(`/api/motores/MTR-01/lecturas?variable=temp_refrigerante&desde=${desde}&hasta=${hace(19)}`)
    .set(gateway);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.puntos.map((p) => [p.valor, p.calidad]), [[160, 1]]);
});

test('estado_actual: una lectura atrasada no pisa a una más nueva', async () => {
  const nueva = { motor: 'MTR-02', variable: 'carga', ts: hace(5), valor: 80 };
  const atrasada = { motor: 'MTR-02', variable: 'carga', ts: hace(50), valor: 10 };
  await request(app).post('/api/lecturas').set(gateway).send({ lecturas: [nueva] });
  await request(app).post('/api/lecturas').set(gateway).send({ lecturas: [atrasada] });
  const res = await request(app).get('/api/motores/MTR-02/estado').set(gateway);
  assert.equal(res.status, 200);
  const carga = res.body.variables.find((v) => v.variable === 'carga');
  // Puede haber un valor de una corrida anterior más nuevo; lo que no puede quedar es el 10 atrasado.
  assert.notEqual(carga.valor, 10);
});

test('sin token: 401; con rol lector: 403', async () => {
  assert.equal((await request(app).post('/api/lecturas').send(loteMixto())).status, 401);
  const lector = await request(app).post('/api/lecturas').set(conToken(tokenDe('lector', SUR))).send(loteMixto());
  assert.equal(lector.status, 403);
});

test('valor como texto: 422 para todo el lote', async () => {
  const res = await request(app)
    .post('/api/lecturas')
    .set(gateway)
    .send({ lecturas: [{ motor: 'MTR-01', variable: 'rpm', ts: hace(1), valor: '1500' }] });
  assert.equal(res.status, 422);
});

test('lote vacío: 422', async () => {
  assert.equal((await request(app).post('/api/lecturas').set(gateway).send({ lecturas: [] })).status, 422);
});

test('JSON roto: 400', async () => {
  const res = await request(app).post('/api/lecturas').set(gateway).set('Content-Type', 'application/json').send('{"lecturas": [');
  assert.equal(res.status, 400);
});

test('lote sin ninguna lectura válida: 422 con los motivos', async () => {
  const res = await request(app)
    .post('/api/lecturas')
    .set(gateway)
    .send({ lecturas: [{ motor: 'MTR-999', variable: 'rpm', ts: hace(1), valor: 1 }] });
  assert.equal(res.status, 422);
  assert.deepEqual(res.body.detalle.rechazadas, [{ indice: 0, motivo: 'motor_desconocido' }]);
});

test('serie: más de 7 días es 422; un motor de otro sitio es 404', async () => {
  const largo = await request(app)
    .get('/api/motores/MTR-01/lecturas?variable=rpm&desde=2026-01-01T00:00:00Z&hasta=2026-01-09T00:00:00Z')
    .set(gateway);
  assert.equal(largo.status, 422);
  const ajeno = await request(app).get('/api/motores/MTR-03/lecturas?variable=rpm').set(gateway);
  assert.equal(ajeno.status, 404);
});
