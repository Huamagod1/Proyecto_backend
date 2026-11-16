/**
 * operacion.test.js · salud, disponibilidad, métricas, API de integración y detector de silencio (Fase 14).
 * Las dependencias de /api/listo y /api/metricas se simulan con las opciones de crearApp(); las
 * claves de API se crean en telemetria_test con el mismo hash que usa el middleware.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { crearApp } from '../src/api/app.js';
import { pool, cerrarPool } from '../src/api/db.js';
import { hashClave, nuevaClave } from '../src/api/claves-api.js';
import { compararSilencios } from '../src/api/silencio.js';
import { tokenDe, conToken, NORTE, SUR } from './ayudas.js';

const claveNorte = nuevaClave();
const claveSur = nuevaClave();

before(async () => {
  // Nombres únicos por corrida: la tabla tiene UNIQUE en nombre y las pruebas no borran.
  const sufijo = Date.now();
  await pool.execute('INSERT INTO claves_api (nombre, hash_clave, sitio_id) VALUES (?, ?, ?), (?, ?, ?)', [
    `prueba-norte-${sufijo}`, hashClave(claveNorte), NORTE,
    `prueba-sur-${sufijo}`, hashClave(claveSur), SUR,
  ]);
});
after(() => cerrarPool());

test('/api/listo: 200 con base y broker; 503 si el broker cae', async () => {
  const ok = await request(crearApp({ mqttConectado: () => true })).get('/api/listo');
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.body, { estado: 'listo', db: 'ok', mqtt: 'ok' });
  const sinBroker = await request(crearApp({ mqttConectado: () => false })).get('/api/listo');
  assert.equal(sinBroker.status, 503);
  assert.equal(sinBroker.body.mqtt, 'error');
});

test('/api/metricas: solo admin, con los números del proceso', async () => {
  const app = crearApp({ metricas: () => ({ websocketClientes: 3 }) });
  assert.equal((await request(app).get('/api/metricas').set(conToken(tokenDe('lector', SUR)))).status, 403);
  const res = await request(app).get('/api/metricas').set(conToken(tokenDe('admin')));
  assert.equal(res.status, 200);
  assert.equal(res.body.websocketClientes, 3);
  assert.ok(res.body.encendidoSeg >= 0 && res.body.memoriaMB > 0);
});

test('integración: sin clave 401; clave inválida 401; clave del sitio 200 con filas planas', async () => {
  const app = crearApp();
  assert.equal((await request(app).get('/api/integracion/estado?sitio=norte')).status, 401);
  assert.equal((await request(app).get('/api/integracion/estado?sitio=norte').set('X-API-Key', 'inventada')).status, 401);
  const res = await request(app).get('/api/integracion/estado?sitio=norte').set('X-API-Key', claveNorte);
  assert.equal(res.status, 200);
  assert.equal(res.body.sitio, 'norte');
  assert.ok(Array.isArray(res.body.lecturas));
  for (const fila of res.body.lecturas) assert.deepEqual(Object.keys(fila), ['sitio', 'motor', 'variable', 'valor', 'unidad', 'ts', 'calidad']);
});

test('integración: una clave de otro sitio responde 403', async () => {
  const res = await request(crearApp()).get('/api/integracion/estado?sitio=norte').set('X-API-Key', claveSur);
  assert.equal(res.status, 403);
});

test('compararSilencios avisa solo las transiciones', () => {
  const f = (motor) => ({ motor, sitio: 'norte', sitio_id: NORTE, ultimo_dato: null });
  const primera = compararSilencios(new Map(), [f('MTR-01'), f('MTR-02')]);
  assert.deepEqual(primera.nuevos.map((x) => x.motor), ['MTR-01', 'MTR-02']);
  // Siguiente revisión: MTR-01 sigue callado (no se repite), MTR-02 volvió y MTR-03 se calló.
  const segunda = compararSilencios(primera.siguientes, [f('MTR-01'), f('MTR-03')]);
  assert.deepEqual(segunda.nuevos.map((x) => x.motor), ['MTR-03']);
  assert.deepEqual(segunda.recuperados.map((x) => x.motor), ['MTR-02']);
});
