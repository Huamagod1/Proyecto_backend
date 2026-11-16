/**
 * rutas/auditoria.js · GET /api/auditoria: consulta el registro de accesos (Fase 4, solo admin).
 * Filtros opcionales: usuario, desde y hasta (ISO 8601). Páginas de 50 filas, la más nueva primero.
 * Fase 11: paginación por clave. La respuesta trae `siguiente`; la página que sigue se pide con
 * ?antesDe=<siguiente>. Medido en docs/rendimiento.md: la página 4000 bajó de 61,7 ms a 0,03 ms.
 */
import { Router } from 'express';
import { z } from '../../comun/zod.js';
import { pool } from '../db.js';
import { autenticar, autorizar } from '../auth.js';
import { validar } from '../../comun/validacion.js';

const POR_PAGINA = 50;

const esquemaFiltros = z.object({
  usuario: z.string().max(40).optional(),
  // z.iso.datetime con offset: acepta "2026-11-15T10:00:00Z" y "2026-11-15T07:00:00-03:00".
  desde: z.iso.datetime({ offset: true }).optional(),
  hasta: z.iso.datetime({ offset: true }).optional(),
  // El cursor: el id de la última fila de la página anterior. La query string siempre es texto.
  antesDe: z.coerce.number().int().positive().optional(),
});

/**
 * Crea el router de auditoría.
 * @returns {import('express').Router}
 */
export function rutasAuditoria() {
  const router = Router();

  router.get('/', autenticar, autorizar('admin'), async (req, res) => {
    const f = validar(esquemaFiltros, req.query);

    // El WHERE se arma con condiciones fijas y valores aparte: nunca se concatena un valor.
    const condiciones = [];
    const valores = [];
    if (f.usuario) { condiciones.push('usuario = ?'); valores.push(f.usuario); }
    if (f.desde) { condiciones.push('ts >= ?'); valores.push(new Date(f.desde)); } // Date → UTC (timezone 'Z')
    if (f.hasta) { condiciones.push('ts < ?'); valores.push(new Date(f.hasta)); }

    // CONCEPTO: paginación por clave (keyset). En vez de "salta 49 950 filas" (OFFSET), se pide
    // "las 50 siguientes a la última que viste" (id < cursor). MySQL entra directo por la PK al
    // punto de corte: la página 4000 cuesta lo mismo que la 1.
    // ALTERNATIVA: OFFSET, que recorre y descarta todas las filas anteriores; además, si entran
    // filas nuevas mientras paginas, OFFSET repite o salta filas, y el cursor no.
    if (f.antesDe) { condiciones.push('id < ?'); valores.push(f.antesDe); }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    // OJO: pool.query y no execute. Con sentencias preparadas, mysql2 manda el número de LIMIT
    // como DOUBLE y MySQL 8 lo rechaza ("Incorrect arguments to mysqld_stmt_execute").
    const [filas] = await pool.query(
      `SELECT id, ts, usuario_id, usuario, rol, metodo, recurso, estado_http, ip, duracion_ms
       FROM auditoria_accesos ${where}
       ORDER BY id DESC
       LIMIT ?`,
      [...valores, POR_PAGINA],
    );
    // Si la página vino llena, puede haber más: el cursor es el id de la última fila.
    const siguiente = filas.length === POR_PAGINA ? filas.at(-1).id : null;
    res.json({ porPagina: POR_PAGINA, filas, siguiente });
  });

  return router;
}
