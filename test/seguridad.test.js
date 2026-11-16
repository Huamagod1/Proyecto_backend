/**
 * seguridad.test.js · autenticación, roles, permiso por sitio, límite de intentos y auditoría (Fase 4).
 * Siembra los cuatro usuarios del plan en telemetria_test (contraseñas de .env.test) y prueba los
 * casos del plan, más el token vencido, el login con usuario inexistente y GET /api/auditoria.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { crearApp } from '../src/api/app.js';
import { pool, cerrarPool } from '../src/api/db.js';
import { config } from '../src/comun/config.js';
import { sembrarUsuarios, usuariosDelPlan } from '../src/scripts/sembrar-usuarios.js';
import { tokenDe, conToken, NORTE, SUR } from './ayudas.js';

const app = crearApp();
const claves = usuariosDelPlan(process.env); // las contraseñas de .env.test

/** Login real contra la API; devuelve el token. */
async function login(usuario) {
  const clave = claves.find((u) => u.usuario === usuario).clave;
  const res = await request(app).post('/api/auth/login').send({ usuario, clave });
  assert.equal(res.status, 200, `login de ${usuario}`);
  return res.body.token;
}

/** base64url de un objeto: el formato de las partes de un JWT. */
const b64 = (objeto) => Buffer.from(JSON.stringify(objeto)).toString('base64url');

before(async () => {
  await sembrarUsuarios(pool, claves); // upsert: se puede repetir sin error
});
after(() => cerrarPool());

test('sin token: 401 con WWW-Authenticate', async () => {
  const res = await request(app).get('/api/motores');
  assert.equal(res.status, 401);
  assert.match(res.headers['www-authenticate'], /^Bearer/);
});

test('token alterado (lector que se cambia a admin): 401', async () => {
  const [encabezado, , firma] = tokenDe('lector', SUR).split('.');
  const contenidoFalso = b64({ sub: '900', usuario: 'x', rol: 'admin', sitio: null, exp: Math.floor(Date.now() / 1000) + 600 });
  const res = await request(app).get('/api/motores').set(conToken(`${encabezado}.${contenidoFalso}.${firma}`));
  assert.equal(res.status, 401);
});

test('token con "alg": "none" (sin firma): 401', async () => {
  const sinFirma = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: '1', usuario: 'admin', rol: 'admin', sitio: null })}.`;
  const res = await request(app).get('/api/motores').set(conToken(sinFirma));
  assert.equal(res.status, 401);
});

test('token vencido: 401', async () => {
  const vencido = jwt.sign(
    { usuario: 'admin', rol: 'admin', sitio: null, exp: Math.floor(Date.now() / 1000) - 60 }, // venció hace 1 min
    config.jwt.secreto,
    { algorithm: 'HS256', subject: '1' },
  );
  const res = await request(app).get('/api/motores').set(conToken(vencido));
  assert.equal(res.status, 401);
});

test('login correcto: token que solo ve los motores de su sitio', async () => {
  const token = await login('ing-norte');
  const res = await request(app).get('/api/motores').set(conToken(token));
  assert.equal(res.status, 200);
  assert.ok(res.body.length > 0);
  assert.ok(res.body.every((m) => m.sitio === 'norte'), 'ing-norte solo ve norte');
});

test('login con clave mala y con usuario inexistente: el mismo 401', async () => {
  const mala = await request(app).post('/api/auth/login').send({ usuario: 'admin', clave: 'no-es-la-clave' });
  const nadie = await request(app).post('/api/auth/login').send({ usuario: 'no-existe', clave: 'x' });
  assert.equal(mala.status, 401);
  assert.equal(nadie.status, 401);
  assert.equal(mala.body.error, nadie.body.error); // no revela qué usuarios existen
});

test('6 logins fallidos seguidos: el sexto responde 429', async () => {
  const appNueva = crearApp(); // limitador propio: no lo ensucian las otras pruebas
  const estados = [];
  for (let i = 0; i < 6; i++) {
    const res = await request(appNueva).post('/api/auth/login').send({ usuario: 'admin', clave: `mala-${i}` });
    estados.push(res.status);
  }
  assert.deepEqual(estados, [401, 401, 401, 401, 401, 429]);
});

test('un lector intenta crear un motor: 403, y queda en la auditoría', async () => {
  const token = await login('lector-sur');
  const res = await request(app)
    .post('/api/motores')
    .set(conToken(token))
    .send({ codigo: 'MTR-7777', modelo: 'X', sitio_id: SUR });
  assert.equal(res.status, 403);

  // La auditoría se escribe después de responder ('finish'): se reintenta unos instantes.
  let filas = [];
  for (let i = 0; i < 20 && filas.length === 0; i++) {
    [filas] = await pool.execute(
      `SELECT metodo, recurso, estado_http FROM auditoria_accesos
       WHERE usuario = 'lector-sur' AND estado_http = 403 AND recurso = '/api/motores'`,
    );
    if (filas.length === 0) await new Promise((r) => setTimeout(r, 50)); // 50 ms entre intentos
  }
  assert.ok(filas.length > 0, 'el 403 debe quedar registrado');
  assert.equal(filas[0].metodo, 'POST');
});

test('ing-norte pide un motor de sur: 404, como si no existiera', async () => {
  const res = await request(app).get('/api/motores/MTR-03').set(conToken(tokenDe('ingeniero', NORTE)));
  assert.equal(res.status, 404);
});

test('ing-norte intenta crear un motor en sur: 403', async () => {
  const res = await request(app)
    .post('/api/motores')
    .set(conToken(tokenDe('ingeniero', NORTE)))
    .send({ codigo: 'MTR-8888', modelo: 'X', sitio_id: SUR });
  assert.equal(res.status, 403);
});

test('ing-norte no puede dar de baja un motor de sur: 404', async () => {
  const res = await request(app).delete('/api/motores/MTR-03').set(conToken(tokenDe('ingeniero', NORTE)));
  assert.equal(res.status, 404);
});

test('GET /api/auditoria: 403 para un lector; 200 con filas para el admin', async () => {
  const lector = await request(app).get('/api/auditoria').set(conToken(tokenDe('lector', SUR)));
  assert.equal(lector.status, 403);
  const admin = await request(app).get('/api/auditoria?pagina=1').set(conToken(tokenDe('admin')));
  assert.equal(admin.status, 200);
  assert.equal(admin.body.porPagina, 50);
  assert.ok(Array.isArray(admin.body.filas));
});

test('helmet agrega encabezados de seguridad', async () => {
  const res = await request(app).get('/api/salud');
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  assert.equal(res.headers['x-powered-by'], undefined);
});
