/**
 * rutas/motores.js · CRUD de motores: listar, ver, crear, actualizar y dar de baja (Fase 3).
 * Recibe peticiones desde app.js (/api/motores) y lee y escribe la tabla `motores` de MySQL.
 * La Fase 4 agrega autenticación, roles y permiso por sitio.
 */
import { Router } from 'express';
import { z } from '../../comun/zod.js';
import { pool } from '../db.js';
import { ErrorHttp } from '../../comun/errores.js';
import { validar } from '../../comun/validacion.js';

// Reglas de entrada. El código sigue el formato de terreno: MTR- y de 2 a 4 dígitos.
const esquemaCodigo = z.string().regex(/^MTR-\d{2,4}$/, 'debe ser MTR- seguido de 2 a 4 dígitos');
const esquemaDatos = {
  modelo: z.string().trim().min(1).max(50),  // trim: "  16V4000 " se guarda sin espacios
  sitio_id: z.number().int().positive(),      // número en el JSON; "1" (texto) es un 422
};
const esquemaCrear = z.object({ codigo: esquemaCodigo, ...esquemaDatos });
const esquemaActualizar = z.object(esquemaDatos);

// CONCEPTO: sentencia preparada. pool.execute manda el SQL con ? y los valores por separado: MySQL
// nunca interpreta un valor como SQL. SEGURIDAD: es la defensa contra la inyección SQL.
// ALTERNATIVA: pool.query, que escapa los valores en el cliente; también es seguro, y es el que
// sirve para expandir arreglos (Fase 5).
const SQL_MOTOR = `
  SELECT m.codigo, m.modelo, m.sitio_id, s.codigo AS sitio
  FROM motores m
  JOIN sitios s ON s.id = m.sitio_id
  WHERE m.activo = TRUE`; // los dados de baja no existen para la API

/**
 * Busca un motor activo por su código.
 * @param {string} codigo 'MTR-01'
 * @returns {Promise<{codigo: string, modelo: string, sitio_id: number, sitio: string} | null>}
 */
async function buscarMotor(codigo) {
  const [filas] = await pool.execute(`${SQL_MOTOR} AND m.codigo = ?`, [codigo]);
  return filas[0] ?? null;
}

/**
 * Traduce los errores de MySQL que son culpa del cliente a un ErrorHttp; el resto lo relanza.
 * @param {Error & {code?: string}} err error de mysql2
 * @param {string} codigo el código del motor, para el mensaje
 * @throws {ErrorHttp|Error} siempre lanza
 */
function traducirErrorMysql(err, codigo) {
  // POR QUÉ: el 409 sale de la restricción UNIQUE y no de un SELECT previo. Con un SELECT antes,
  // dos peticiones simultáneas pasarían las dos el chequeo y una fallaría igual al insertar.
  if (err.code === 'ER_DUP_ENTRY') throw new ErrorHttp(409, `El motor ${codigo} ya existe`);
  // La FK fk_motores_sitio rechaza un sitio que no existe.
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    throw new ErrorHttp(422, 'Datos inválidos', { sitio_id: ['el sitio no existe'] });
  }
  throw err;
}

/**
 * Crea el router de motores.
 * @returns {import('express').Router}
 */
export function rutasMotores() {
  const router = Router();

  // Lista los motores activos, con el código de su sitio.
  router.get('/', async (req, res) => {
    const [filas] = await pool.execute(`${SQL_MOTOR} ORDER BY m.codigo`);
    res.json(filas);
  });

  // Un motor por código.
  router.get('/:codigo', async (req, res) => {
    const motor = await buscarMotor(req.params.codigo);
    if (!motor) throw new ErrorHttp(404, `No existe el motor ${req.params.codigo}`);
    res.json(motor);
  });

  // Crea un motor. 201 + Location: la URL del recurso nuevo, como manda HTTP.
  router.post('/', async (req, res) => {
    const datos = validar(esquemaCrear, req.body);
    try {
      await pool.execute('INSERT INTO motores (codigo, modelo, sitio_id) VALUES (?, ?, ?)', [
        datos.codigo,
        datos.modelo,
        datos.sitio_id,
      ]);
    } catch (err) {
      traducirErrorMysql(err, datos.codigo);
    }
    res.status(201).location(`/api/motores/${datos.codigo}`).json(await buscarMotor(datos.codigo));
  });

  // Actualiza el modelo y el sitio.
  router.put('/:codigo', async (req, res) => {
    const datos = validar(esquemaActualizar, req.body);
    try {
      await pool.execute(
        'UPDATE motores SET modelo = ?, sitio_id = ? WHERE codigo = ? AND activo = TRUE',
        [datos.modelo, datos.sitio_id, req.params.codigo],
      );
    } catch (err) {
      traducirErrorMysql(err, req.params.codigo);
    }
    // OJO: no se usa affectedRows para el 404. Si los datos no cambian, MySQL puede contar 0 filas
    // afectadas (con flags: '-FOUND_ROWS', Fase 5). Releer el motor responde las dos preguntas.
    const motor = await buscarMotor(req.params.codigo);
    if (!motor) throw new ErrorHttp(404, `No existe el motor ${req.params.codigo}`);
    res.json(motor);
  });

  // Baja lógica: activo = FALSE. Las lecturas históricas del motor siguen valiendo.
  router.delete('/:codigo', async (req, res) => {
    const [r] = await pool.execute(
      'UPDATE motores SET activo = FALSE WHERE codigo = ? AND activo = TRUE',
      [req.params.codigo],
    );
    // Aquí affectedRows sí sirve: la fila siempre cambia de TRUE a FALSE, o no existía.
    if (r.affectedRows === 0) throw new ErrorHttp(404, `No existe el motor ${req.params.codigo}`);
    res.status(204).end(); // 204 No Content: hecho, sin cuerpo
  });

  return router;
}
