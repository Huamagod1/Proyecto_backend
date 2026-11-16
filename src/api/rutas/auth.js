/**
 * rutas/auth.js · POST /api/auth/login: canjea usuario y contraseña por un JWT (Fase 4).
 * Lee la tabla `usuarios`, compara con bcrypt y firma con auth.js. Limita los intentos fallidos.
 */
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { rateLimit } from 'express-rate-limit';
import { z } from '../../comun/zod.js';
import { pool } from '../db.js';
import { firmarToken } from '../auth.js';
import { config } from '../../comun/config.js';
import { ErrorHttp } from '../../comun/errores.js';
import { validar } from '../../comun/validacion.js';

const esquemaLogin = z.object({
  usuario: z.string().min(1).max(40),
  clave: z.string().min(1).max(200), // tope: bcrypt solo usa los primeros 72 bytes y no conviene hashear megas
});

// SEGURIDAD: hash de una clave cualquiera, calculado una vez al cargar el módulo. Si el usuario no
// existe, igual se compara contra este hash: la respuesta tarda lo mismo y el tiempo no revela qué
// usuarios existen (ataque de tiempo).
const HASH_SEÑUELO = bcrypt.hashSync('clave-que-no-es-de-nadie', 12);

/**
 * Crea el router de autenticación. Cada llamada crea su propio limitador de intentos.
 * @returns {import('express').Router}
 */
export function rutasAuth() {
  const router = Router();

  // CONCEPTO: rate limiting. Como el bloqueo de una tarjeta tras varios PIN errados: frena la
  // fuerza bruta. Cuenta por IP y guarda los contadores en memoria (una sola instancia de la API).
  const limitarLogin = rateLimit({
    windowMs: 15 * 60 * 1000,      // 15 min en ms: la ventana en que se cuentan los intentos
    limit: 5,                      // 5 intentos fallidos por IP en la ventana; el sexto responde 429
    skipSuccessfulRequests: true,  // un login correcto (estado < 400) no gasta intentos
    standardHeaders: 'draft-8',    // encabezado RateLimit estándar: cuánto queda y cuándo se reinicia
    legacyHeaders: false,          // sin los X-RateLimit-* antiguos
    // La respuesta 429 en JSON, igual que el resto de la API.
    handler: (req, res) => res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos.' }),
  });
  // OJO: con varias instancias de la API, cada una contaría por su lado; ahí el store va en Redis.

  router.post('/login', limitarLogin, async (req, res) => {
    const { usuario, clave } = validar(esquemaLogin, req.body);

    const [filas] = await pool.execute(
      'SELECT id, usuario, password_hash, rol, sitio_id, activo FROM usuarios WHERE usuario = ?',
      [usuario],
    );
    const u = filas[0];

    // bcrypt.compare recalcula el hash con la sal guardada y compara en tiempo constante.
    const claveOk = await bcrypt.compare(clave, u?.password_hash ?? HASH_SEÑUELO);
    if (!u || !u.activo || !claveOk) {
      // SEGURIDAD: el mismo 401 y el mismo mensaje si el usuario no existe, está inactivo o la
      // clave está mal: así no se puede averiguar qué usuarios existen.
      throw new ErrorHttp(401, 'Usuario o contraseña incorrectos');
    }

    res.json({
      token: firmarToken(u),
      expiraEnSeg: config.jwt.duracionSeg,
      usuario: { usuario: u.usuario, rol: u.rol, sitio: u.sitio_id },
    });
  });

  return router;
}
