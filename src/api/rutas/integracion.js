/**
 * rutas/integracion.js · API de integración para SCADA y EMS (Fase 14).
 * GET /api/integracion/estado?sitio=norte entrega el último valor de cada variable de cada motor
 * del sitio, en un formato plano y estable: una fila por motor y variable, con nombres que no cambian.
 * POR QUÉ un endpoint aparte: el dashboard puede cambiar su JSON cuando quiera; otro sistema
 * integrado se rompe si cambia un campo. Este contrato se versiona con cuidado.
 */
import { Router } from 'express';
import { z } from '../../comun/zod.js';
import { pool } from '../db.js';
import { autenticarClaveApi } from '../claves-api.js';
import { catalogoListo } from '../catalogo.js';
import { ErrorHttp } from '../../comun/errores.js';
import { validar } from '../../comun/validacion.js';

/**
 * Crea el router de integración. Se monta en /api/integracion.
 * @returns {import('express').Router}
 */
export function rutasIntegracion() {
  const router = Router();

  router.get('/estado', autenticarClaveApi, async (req, res) => {
    const { sitio } = validar(z.object({ sitio: z.string().min(1).max(20) }), req.query);
    const s = (await catalogoListo()).sitio(sitio);
    if (!s) throw new ErrorHttp(404, `No existe el sitio ${sitio}`);
    // Una clave con sitio solo ve su sitio; una con sitio NULL (una central) ve todos.
    if (req.usuario.sitio !== null && req.usuario.sitio !== s.id) {
      throw new ErrorHttp(403, 'La clave no tiene acceso a ese sitio');
    }

    const [filas] = await pool.execute(
      `SELECT m.codigo AS motor, v.codigo AS variable, e.valor, v.unidad, e.ts, e.calidad
       FROM estado_actual e
       JOIN motores   m ON m.id = e.motor_id
       JOIN variables v ON v.id = e.variable_id
       WHERE m.sitio_id = ? AND m.activo = TRUE
       ORDER BY m.codigo, v.codigo`,
      [s.id],
    );
    // calidad: 0 buena, 1 fuera de rango. ts en ISO 8601 UTC (JSON convierte el Date).
    res.json({ sitio, generado_en: new Date(), lecturas: filas.map((f) => ({ sitio, ...f })) });
  });

  return router;
}
