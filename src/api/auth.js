/**
 * auth.js · autenticación con JWT, autorización por rol y permiso por sitio (Fase 4).
 * Las rutas usan los middlewares autenticar() y autorizar(); rutas/auth.js firma el token en el
 * login, y tiempo-real.js (Fase 9) lo verifica al abrir el WebSocket.
 * CONCEPTO: autenticar = ¿quién eres? (el guardia revisa tu credencial). Autorizar = ¿qué puedes
 * hacer? (tu rol). Permiso por recurso = ¿sobre qué? (tu sitio). Son tres preguntas distintas.
 */
import jwt from 'jsonwebtoken';
import { config } from '../comun/config.js';
import { ErrorHttp } from '../comun/errores.js';

// CONCEPTO: JWT (JSON Web Token). Tres partes en base64url separadas por puntos:
// encabezado (algoritmo) . contenido (quién es, rol, vencimiento) . firma.
// La firma HS256 es un HMAC del encabezado y el contenido con JWT_SECRETO: si alguien cambia
// "lector" por "admin", la firma deja de calzar. OJO: el contenido NO está cifrado, solo firmado;
// cualquiera puede leerlo en jwt.io. Nunca pongas ahí una contraseña.

/**
 * Firma un token para un usuario que acaba de probar su contraseña.
 * @param {{id: number, usuario: string, rol: string, sitio_id: number|null}} usuario fila de `usuarios`
 * @returns {string} JWT HS256 que vence en 15 minutos
 */
export function firmarToken(usuario) {
  return jwt.sign(
    { usuario: usuario.usuario, rol: usuario.rol, sitio: usuario.sitio_id }, // datos que leerá la API
    config.jwt.secreto,
    {
      algorithm: 'HS256',                  // HMAC con SHA-256: un solo secreto firma y verifica
      expiresIn: config.jwt.duracionSeg,   // agrega `exp` (en segundos); vencido = 401
      subject: String(usuario.id),         // `sub`: el id del usuario; el estándar pide texto
    },
  );
}

/**
 * Verifica un token y devuelve su contenido.
 * @param {string} token el JWT tal como llegó
 * @returns {{sub: string, usuario: string, rol: string, sitio: number|null, exp: number}}
 * @throws {import('jsonwebtoken').JsonWebTokenError} firma inválida, alterado, vencido o mal formado
 */
export function verificarToken(token) {
  // SEGURIDAD: algorithms explícito. Sin esta lista, un token con "alg": "none" (sin firma) o con
  // un algoritmo inesperado podría pasar como válido en librerías mal configuradas.
  return jwt.verify(token, config.jwt.secreto, { algorithms: ['HS256'] });
}

/**
 * Middleware: exige un token válido en `Authorization: Bearer <token>` y deja `req.usuario`.
 * Efecto: responde 401 si el token falta, está alterado o venció.
 */
export function autenticar(req, res, next) {
  const [esquema, token] = (req.get('Authorization') ?? '').split(' ');
  if (esquema !== 'Bearer' || !token) {
    // WWW-Authenticate: el estándar HTTP le dice al cliente cómo autenticarse.
    res.set('WWW-Authenticate', 'Bearer');
    throw new ErrorHttp(401, 'Falta el token (Authorization: Bearer ...)');
  }
  let datos;
  try {
    datos = verificarToken(token);
  } catch {
    // SEGURIDAD: un solo mensaje para alterado, vencido o mal formado; no se da pistas a un atacante.
    res.set('WWW-Authenticate', 'Bearer error="invalid_token"');
    throw new ErrorHttp(401, 'Token inválido o vencido');
  }
  req.usuario = { id: Number(datos.sub), usuario: datos.usuario, rol: datos.rol, sitio: datos.sitio };
  next();
}

/**
 * Crea un middleware que solo deja pasar a ciertos roles. Va después de autenticar().
 * @param {...string} roles los roles permitidos, por ejemplo 'admin', 'ingeniero'
 * @returns {import('express').RequestHandler} responde 403 si el rol no está en la lista
 */
export function autorizar(...roles) {
  return (req, res, next) => {
    // 403 y no 401: sabemos quién es, pero no tiene permiso.
    if (!roles.includes(req.usuario?.rol)) throw new ErrorHttp(403, 'Tu rol no permite esta acción');
    next();
  };
}

/**
 * ¿Puede este usuario ver un recurso del sitio indicado?
 * @param {{rol: string, sitio: number|null}} usuario req.usuario
 * @param {number} sitioId sitio del recurso (motor, lectura)
 * @returns {boolean} el admin ve todo; el resto, solo su sitio
 */
export function puedeVerSitio(usuario, sitioId) {
  return usuario.rol === 'admin' || (usuario.sitio !== null && usuario.sitio === sitioId);
}
