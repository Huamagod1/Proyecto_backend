/**
 * rutas/auditoria.js · GET /api/auditoria: consulta el registro de accesos (Fase 4, solo admin).
 * Filtros opcionales: usuario, desde y hasta (ISO 8601). Páginas de 50 filas, la más nueva primero.
 * La Fase 11 agrega la paginación por clave (?antesDe=id), que no se degrada con millones de filas.
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
  pagina: z.coerce.number().int().min(1).max(10_000).default(1), // la query string siempre es texto
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
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    // OJO: pool.query y no execute. Con sentencias preparadas, mysql2 manda los números de LIMIT
    // como DOUBLE y MySQL 8 los rechaza ("Incorrect arguments to mysqld_stmt_execute").
    // ALTERNATIVA: OFFSET recorre y descarta las filas anteriores; en la página 1.000 lee 50.000
    // filas para devolver 50. La Fase 11 lo mide y lo cambia por paginación por clave.
    const [filas] = await pool.query(
      `SELECT id, ts, usuario_id, usuario, rol, metodo, recurso, estado_http, ip, duracion_ms
       FROM auditoria_accesos ${where}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [...valores, POR_PAGINA, (f.pagina - 1) * POR_PAGINA],
    );
    res.json({ pagina: f.pagina, porPagina: POR_PAGINA, filas });
  });

  return router;
}
