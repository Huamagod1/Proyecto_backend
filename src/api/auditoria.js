/**
 * auditoria.js · middleware que anota cada acceso en `auditoria_accesos` (Fase 4).
 * Se registra en app.js antes de las rutas. Cuando la respuesta termina, inserta quién, qué método,
 * qué recurso, con qué resultado, desde qué IP y cuánto tardó. La tabla solo admite INSERT.
 */
import { pool } from './db.js';

// Rutas que no se auditan. POR QUÉ: los monitores consultan la salud cada pocos segundos; anotar
// esas llamadas llenaría la tabla de ruido sin valor de trazabilidad.
const SIN_AUDITORIA = new Set(['/api/salud', '/api/listo']);

/**
 * Middleware de auditoría.
 * Efecto: un INSERT en `auditoria_accesos` por petición, después de enviar la respuesta.
 */
export function registrarAcceso(req, res, next) {
  if (SIN_AUDITORIA.has(req.path)) return next();

  // hrtime.bigint(): reloj monotónico en nanosegundos; no salta si cambia la hora del sistema.
  const inicio = process.hrtime.bigint();

  // 'finish': la respuesta ya se entregó. Para entonces autenticar() dejó req.usuario, si había token.
  res.on('finish', () => {
    const duracionMs = Number((process.hrtime.bigint() - inicio) / 1_000_000n); // ns → ms
    // En un login todavía no hay req.usuario: se anota el usuario que se intentó (sin la clave).
    const nombre = req.usuario?.usuario ?? (typeof req.body?.usuario === 'string' ? req.body.usuario : null);

    pool
      .execute(
        `INSERT INTO auditoria_accesos (usuario_id, usuario, rol, metodo, recurso, estado_http, ip, duracion_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.usuario?.id ?? null,
          nombre?.slice(0, 40) ?? null,          // slice: respeta el largo de la columna
          req.usuario?.rol ?? null,
          req.method,
          req.originalUrl.slice(0, 255),         // originalUrl incluye la query (?pagina=2)
          res.statusCode,
          req.ip ?? null,                        // detrás de nginx, requiere 'trust proxy' (Fase 13)
          duracionMs,
        ],
      )
      // POR QUÉ: si la auditoría falla, se anota en el log, pero nunca rompe la respuesta
      // (que además ya se envió). Sin este catch, la promesa rechazada tumbaría el proceso.
      .catch((err) => console.error('auditoría: no pude registrar el acceso:', err.message));
  });

  next();
}
