/**
 * rutas/lecturas.js · ingesta de lotes y consultas de series y de estado (Fase 5).
 * POST /api/lecturas recibe lotes de un gateway, valida cada lectura con evaluarLectura() y
 * guarda las válidas con repositorio.js. Las consultas leen `lecturas` y `estado_actual`.
 * CONCEPTO: es la recepción de una bodega: quién trae la carga (token y rol), si viene bien
 * rotulada (forma), si el producto existe (motor y variable), si le corresponde (sitio), si la
 * fecha tiene sentido (hora) y si ya se recibió (PK). Al final entrega un comprobante.
 */
import { Router } from 'express';
import { z } from '../../comun/zod.js';
import { pool } from '../db.js';
import { autenticar, autorizar, puedeVerSitio } from '../auth.js';
import { catalogoListo } from '../catalogo.js';
import { guardarLote } from '../repositorio.js';
import { ErrorHttp } from '../../comun/errores.js';
import { validar, esquemaLote, evaluarLectura } from '../../comun/validacion.js';

const SIETE_DIAS_MS = 7 * 24 * 3600 * 1000; // 7 días en ms: unos 60 000 puntos a 1 lectura cada 10 s
const UNA_HORA_MS = 3600 * 1000;           // rango por defecto de una serie

const esquemaSerie = z.object({
  variable: z.string().min(1).max(40),
  desde: z.iso.datetime({ offset: true }).optional(),
  hasta: z.iso.datetime({ offset: true }).optional(),
});

/**
 * Busca un motor en el catálogo y verifica que el usuario pueda verlo.
 * @returns {Promise<object>} el motor del catálogo
 * @throws {ErrorHttp} 404 si no existe o es de otro sitio (no se confirma que exista)
 */
async function motorVisible(codigo, usuario) {
  const cat = await catalogoListo();
  const motor = cat.motor(codigo);
  if (!motor || !puedeVerSitio(usuario, motor.sitio_id)) {
    throw new ErrorHttp(404, `No existe el motor ${codigo}`);
  }
  return motor;
}

/**
 * Crea el router de lecturas. Se monta en /api.
 * @returns {import('express').Router}
 */
export function rutasLecturas() {
  const router = Router();

  // Ingesta de un lote. Solo un gateway (o el admin, para cargas manuales) puede escribir lecturas.
  router.post('/lecturas', autenticar, autorizar('gateway', 'admin'), async (req, res) => {
    // POR QUÉ dos niveles: un lote con forma inválida (valor como texto) es un error del cliente y se
    // rechaza entero (422). Un dato con forma correcta pero inválido (motor desconocido, hora rara)
    // es un problema de terreno: se rechaza solo esa lectura y el resto se guarda.
    const { lecturas } = validar(esquemaLote, req.body);
    const cat = await catalogoListo();
    const ahora = new Date();

    const filas = [];
    const rechazadas = [];
    let fueraDeRango = 0;
    lecturas.forEach((lectura, indice) => {
      const r = evaluarLectura(lectura, cat, req.usuario, ahora);
      if (!r.ok) return rechazadas.push({ indice, motivo: r.motivo }); // el índice ubica la lectura en el lote
      filas.push(r.fila);
      if (r.fila[4] === 1) fueraDeRango++; // posición 4 de la fila = calidad
    });

    if (filas.length === 0) throw new ErrorHttp(422, 'Ninguna lectura del lote es válida', { rechazadas });

    const nuevas = await guardarLote(filas);
    // El comprobante: qué llegó, qué se guardó, qué ya estaba y qué se rechazó y por qué.
    res.status(201).json({
      recibidas: lecturas.length,
      nuevas,
      repetidas: filas.length - nuevas,
      fueraDeRango,
      rechazadas,
    });
  });

  // Serie de una variable de un motor: ?variable=rpm&desde=...&hasta=... (por defecto, la última hora).
  router.get('/motores/:codigo/lecturas', autenticar, async (req, res) => {
    const motor = await motorVisible(req.params.codigo, req.usuario);
    const q = validar(esquemaSerie, req.query);
    const variable = (await catalogoListo()).variable(q.variable);
    if (!variable) throw new ErrorHttp(422, 'Datos inválidos', { variable: ['no existe esa variable'] });

    const hasta = q.hasta ? new Date(q.hasta) : new Date();
    const desde = q.desde ? new Date(q.desde) : new Date(hasta.getTime() - UNA_HORA_MS);
    if (desde >= hasta) throw new ErrorHttp(422, 'Datos inválidos', { desde: ['debe ser anterior a hasta'] });
    if (hasta - desde > SIETE_DIAS_MS) {
      throw new ErrorHttp(422, 'Datos inválidos', { desde: ['el rango máximo es de 7 días'] });
    }

    // Con los id resueltos, MySQL recorre un tramo de la PK en orden: sin filesort (ver practica/consultas.sql).
    const [puntos] = await pool.execute(
      `SELECT ts, valor, calidad FROM lecturas
       WHERE motor_id = ? AND variable_id = ? AND ts >= ? AND ts < ?
       ORDER BY ts`,
      [motor.id, variable.id, desde, hasta],
    );
    res.json({ motor: motor.codigo, variable: variable.codigo, unidad: variable.unidad, desde, hasta, puntos });
  });

  // Último valor de cada variable de un motor, desde la tabla chica estado_actual.
  router.get('/motores/:codigo/estado', autenticar, async (req, res) => {
    const motor = await motorVisible(req.params.codigo, req.usuario);
    const [filas] = await pool.execute(
      `SELECT v.codigo AS variable, v.unidad, e.valor, e.ts, e.calidad
       FROM estado_actual e JOIN variables v ON v.id = e.variable_id
       WHERE e.motor_id = ?
       ORDER BY v.codigo`,
      [motor.id],
    );
    res.json({ motor: motor.codigo, variables: filas });
  });

  return router;
}
