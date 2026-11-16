/**
 * claves-api.js · autenticación de otros sistemas (SCADA, EMS) con X-API-Key (Fase 14).
 * Las claves se crean con src/scripts/crear-clave-api.js; en la tabla `claves_api` solo queda su
 * SHA-256. El middleware deja req.usuario con rol 'integracion' y el sitio de la clave, y la
 * auditoría (auditoria.js) anota cada uso con el nombre de la clave.
 * CONCEPTO: una clave de API identifica a un sistema, no a una persona: no expira en 15 minutos
 * como el JWT, se revoca a mano (activa = FALSE) y se rota cada cierto tiempo.
 */
import { createHash, randomBytes } from 'node:crypto';
import { pool } from './db.js';
import { ErrorHttp } from '../comun/errores.js';
import { log } from '../comun/log.js';

/**
 * Hash de una clave de API.
 * POR QUÉ SHA-256 y no bcrypt: bcrypt es lento a propósito porque las contraseñas humanas son
 * cortas y adivinables. Una clave de 256 bits al azar no se adivina ni con SHA-256 rápido, y así
 * cada petición se valida en microsegundos y se puede buscar por el hash (bcrypt lleva sal y no permite buscar).
 * @param {string} clave la clave tal como la manda el cliente
 * @returns {string} 64 caracteres hexadecimales
 */
export const hashClave = (clave) => createHash('sha256').update(clave).digest('hex');

/** Una clave nueva: 32 bytes aleatorios (256 bits) en base64url, unos 43 caracteres. */
export const nuevaClave = () => randomBytes(32).toString('base64url');

/**
 * Middleware: exige una clave de API válida y activa en el encabezado X-API-Key.
 * Efecto: actualiza claves_api.ultimo_uso sin esperar (no frena la respuesta).
 * @throws {ErrorHttp} 401 si falta o no existe
 */
export async function autenticarClaveApi(req, res, next) {
  const clave = req.get('X-API-Key');
  if (!clave) throw new ErrorHttp(401, 'Falta la clave de API (X-API-Key)');

  const [filas] = await pool.execute(
    'SELECT id, nombre, rol, sitio_id FROM claves_api WHERE hash_clave = ? AND activa = TRUE',
    [hashClave(clave)],
  );
  const fila = filas[0];
  if (!fila) throw new ErrorHttp(401, 'Clave de API inválida o revocada');

  // Mismo formato que deja autenticar() con un JWT: las reglas de sitio funcionan igual.
  req.usuario = { id: null, usuario: fila.nombre, rol: fila.rol, sitio: fila.sitio_id };

  // ultimo_uso sirve para encontrar claves olvidadas y revocarlas. Sin await: si falla, solo se anota.
  pool
    .execute('UPDATE claves_api SET ultimo_uso = UTC_TIMESTAMP(3) WHERE id = ?', [fila.id])
    .catch((err) => log.aviso('clave_api_ultimo_uso_fallido', { clave: fila.nombre, error: err }));
  next();
}
