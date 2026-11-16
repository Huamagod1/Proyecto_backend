/**
 * sembrar-usuarios.js · crea o actualiza los cuatro usuarios de la plataforma (Fase 4).
 * Uso: npm run sembrar (lee las contraseñas CLAVE_* de .env). Las pruebas importan
 * sembrarUsuarios() para crear los mismos usuarios en telemetria_test.
 * Efecto: escribe en la tabla `usuarios`. Se puede correr las veces que quieras (upsert).
 */
import { pathToFileURL } from 'node:url';
import bcrypt from 'bcryptjs';
import { z } from '../comun/zod.js';

// CONCEPTO: hash de contraseña. Se guarda una huella irreversible, nunca la contraseña.
// POR QUÉ bcrypt y no SHA-256: SHA-256 está hecho para ser rápido (miles de millones por segundo
// en una GPU); bcrypt es lento a propósito y trae sal (salt) propia, así que dos usuarios con la
// misma clave tienen hashes distintos y una lista robada cuesta años de fuerza bruta.
// Costo 12: 2^12 rondas, unos 250 ms por hash. Lento para un atacante, aceptable en un login.
const COSTO_BCRYPT = 12;

/**
 * Los cuatro usuarios del plan, con las contraseñas tomadas del entorno.
 * @param {NodeJS.ProcessEnv} env normalmente process.env
 * @returns {Array<{usuario: string, clave: string, rol: string, sitio: string|null}>}
 * @throws {Error} si falta alguna CLAVE_* o mide menos de 12 caracteres
 */
export function usuariosDelPlan(env) {
  const clave = z.string().min(12, 'debe tener 12 caracteres o más');
  const claves = z
    .object({ CLAVE_ADMIN: clave, CLAVE_ING_NORTE: clave, CLAVE_LECTOR_SUR: clave, CLAVE_GW_NORTE: clave })
    .safeParse(env);
  if (!claves.success) {
    const detalle = claves.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Contraseñas inválidas en .env: ${detalle}`);
  }
  const c = claves.data;
  // SEGURIDAD: las contraseñas vienen del entorno; nunca quedan escritas en el código.
  return [
    { usuario: 'admin',      clave: c.CLAVE_ADMIN,      rol: 'admin',     sitio: null },  // ve todos los sitios
    { usuario: 'ing-norte',  clave: c.CLAVE_ING_NORTE,  rol: 'ingeniero', sitio: 'norte' },
    { usuario: 'lector-sur', clave: c.CLAVE_LECTOR_SUR, rol: 'lector',    sitio: 'sur' },
    { usuario: 'gw-norte',   clave: c.CLAVE_GW_NORTE,   rol: 'gateway',   sitio: 'norte' },
  ];
}

/**
 * Crea o actualiza usuarios con su contraseña en bcrypt.
 * @param {import('mysql2/promise').Pool} pool conexión a la base donde se siembra
 * @param {Array<{usuario: string, clave: string, rol: string, sitio: string|null}>} usuarios
 * @returns {Promise<void>}
 * Efecto: INSERT o UPDATE en `usuarios`; deja a cada uno activo.
 */
export async function sembrarUsuarios(pool, usuarios) {
  for (const u of usuarios) {
    const hash = await bcrypt.hash(u.clave, COSTO_BCRYPT); // genera la sal y calcula el hash
    // Upsert: si el usuario ya existe (UNIQUE usuario), actualiza su hash, rol y sitio.
    // El sitio se busca por código; con sitio NULL (admin) la subconsulta no encuentra filas y da NULL.
    await pool.execute(
      `INSERT INTO usuarios (usuario, password_hash, rol, sitio_id)
       VALUES (?, ?, ?, (SELECT id FROM sitios WHERE codigo = ?)) AS nuevo
       ON DUPLICATE KEY UPDATE password_hash = nuevo.password_hash, rol = nuevo.rol,
                               sitio_id = nuevo.sitio_id, activo = TRUE`,
      [u.usuario, hash, u.rol, u.sitio],
    );
  }
}

// Solo si se ejecuta directo (npm run sembrar), no cuando una prueba importa este archivo.
// process.argv[1] es la ruta del script que lanzó Node; se compara como URL con este módulo.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  // import dinámico: config.js exige DB_CLAVE y JWT_SECRETO, y solo hace falta al ejecutar.
  const { pool, cerrarPool } = await import('../api/db.js');
  try {
    const usuarios = usuariosDelPlan(process.env);
    await sembrarUsuarios(pool, usuarios);
    console.log(`Usuarios listos: ${usuarios.map((u) => `${u.usuario} (${u.rol})`).join(', ')}`);
  } finally {
    await cerrarPool(); // sin esto, el pool deja el proceso vivo
  }
}
