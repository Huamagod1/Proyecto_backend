/**
 * db.js · pool de conexiones a MySQL (Fase 3).
 * Lo usan las rutas y, desde la Fase 5, el repositorio de lecturas. server.js lo cierra al apagar.
 * Credenciales: de config.js, que las lee de .env.
 */
import mysql from 'mysql2/promise';
import { config } from '../comun/config.js';

// CONCEPTO: pool de conexiones. Abrir una conexión a MySQL cuesta un viaje de red y una
// autenticación; el pool mantiene varias abiertas y las presta a cada consulta. Es como tener
// operadores de turno en vez de contratar uno por cada llamada.
// mysql2/promise: la versión con promesas, para usar await.
export const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.puerto,
  user: config.db.usuario,
  password: config.db.clave,
  database: config.db.nombre,
  connectionLimit: 10,       // máximo de conexiones simultáneas; MySQL acepta 151 por defecto
  waitForConnections: true,  // si las 10 están ocupadas, la consulta espera en cola en vez de fallar
  // POR QUÉ: los Date de JS se escriben y se leen como UTC, igual que la base (ver docker-compose.yml).
  timezone: 'Z',
  // Fase 5. CONCEPTO: CLIENT_FOUND_ROWS es un flag que mysql2 activa por defecto: hace que
  // affectedRows cuente las filas ENCONTRADAS. Con '-FOUND_ROWS' (el - lo quita) cuenta las
  // CAMBIADAS: en INSERT ... ON DUPLICATE KEY UPDATE valor = valor, una fila nueva suma 1 y una
  // repetida suma 0. Así affectedRows dice cuántas lecturas eran nuevas (ver repositorio.js).
  flags: ['-FOUND_ROWS'],
});

/**
 * Cierra todas las conexiones del pool. Después de esto, el pool no se puede usar.
 * @returns {Promise<void>}
 * Efecto: cierra las conexiones TCP con MySQL. Lo llama el apagado ordenado y el after() de las pruebas.
 */
export async function cerrarPool() {
  await pool.end();
}
