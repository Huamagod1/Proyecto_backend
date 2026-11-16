/**
 * crear-clave-api.js · crea una clave de API para un sistema integrado (Fase 14).
 * Uso: node --env-file=.env src/scripts/crear-clave-api.js <nombre> [sitio]
 *   npm run clave-api -- scada-norte norte      (sin sitio = acceso a todos)
 * Muestra la clave UNA sola vez; en la base queda solo su SHA-256 (no se puede recuperar).
 * Efecto: INSERT en `claves_api`.
 */
import { pool, cerrarPool } from '../api/db.js';
import { hashClave, nuevaClave } from '../api/claves-api.js';

const [nombre, sitio] = process.argv.slice(2);
if (!nombre) {
  console.error('uso: crear-clave-api.js <nombre> [sitio]');
  process.exit(1);
}

try {
  const clave = nuevaClave();
  // El sitio se busca por código; sin sitio, la subconsulta no se usa y queda NULL (todos).
  await pool.execute(
    'INSERT INTO claves_api (nombre, hash_clave, sitio_id) VALUES (?, ?, (SELECT id FROM sitios WHERE codigo = ?))',
    [nombre, hashClave(clave), sitio ?? null],
  );
  // SEGURIDAD: se muestra una sola vez. Guárdala en el gestor de secretos del sistema que la usará.
  console.log(clave);
} catch (err) {
  console.error(err.code === 'ER_DUP_ENTRY' ? `Ya existe una clave llamada ${nombre}` : err.message);
  process.exitCode = 1;
} finally {
  await cerrarPool();
}
