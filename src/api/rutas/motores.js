/**
 * rutas/motores.js · CRUD de motores: listar, ver, crear, actualizar y dar de baja (fases 3 y 4).
 * Recibe peticiones desde app.js (/api/motores) y lee y escribe la tabla `motores` de MySQL.
 * Seguridad (Fase 4): todo exige token; leer, cualquier rol; escribir, admin o ingeniero; y cada
 * usuario ve y toca solo los motores de su sitio (el admin, todos).
 */
import { Router } from 'express';
import { z } from '../../comun/zod.js';
import { pool } from '../db.js';
import { autenticar, autorizar, puedeVerSitio } from '../auth.js';
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
 * Condición SQL que limita una consulta de motores (alias `m`) al sitio del usuario.
 * CONCEPTO: BOLA (Broken Object Level Authorization), el riesgo número 1 del OWASP API Top 10:
 * tener el rol correcto no basta; cada consulta debe preguntar si ESTE objeto es tuyo. Por eso el
 * filtro va dentro del SQL de cada operación y no en un chequeo aparte que alguien olvide.
 * @param {{rol: string, sitio: number|null}} usuario req.usuario
 * @returns {{sql: string, valores: Array<number|null>}} fragmento para el WHERE y sus valores
 */
function filtroSitio(usuario) {
  if (usuario.rol === 'admin') return { sql: '', valores: [] };
  // Un no admin sin sitio queda con "= NULL", que nunca es verdadero: no ve nada. Falla cerrado.
  return { sql: ' AND m.sitio_id = ?', valores: [usuario.sitio] };
}

/**
 * Busca un motor activo que el usuario pueda ver.
 * @param {string} codigo 'MTR-01'
 * @param {{rol: string, sitio: number|null}} usuario req.usuario
 * @returns {Promise<{codigo: string, modelo: string, sitio_id: number, sitio: string} | null>}
 *   null si no existe o es de otro sitio: para el usuario, las dos cosas son lo mismo
 */
async function buscarMotor(codigo, usuario) {
  const f = filtroSitio(usuario);
  const [filas] = await pool.execute(`${SQL_MOTOR} AND m.codigo = ?${f.sql}`, [codigo, ...f.valores]);
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

/** 404 uniforme: un motor de otro sitio responde igual que uno inexistente. */
const noExiste = (codigo) => new ErrorHttp(404, `No existe el motor ${codigo}`);

/**
 * Crea el router de motores.
 * @returns {import('express').Router}
 */
export function rutasMotores() {
  const router = Router();

  // Todas las rutas de motores exigen un token válido; deja req.usuario.
  router.use(autenticar);

  // Lista los motores activos que el usuario puede ver, con el código de su sitio.
  router.get('/', async (req, res) => {
    const f = filtroSitio(req.usuario);
    const [filas] = await pool.execute(`${SQL_MOTOR}${f.sql} ORDER BY m.codigo`, f.valores);
    res.json(filas);
  });

  // Un motor por código. SEGURIDAD: uno de otro sitio responde 404 y no 403: un 403 confirmaría
  // que el motor existe.
  router.get('/:codigo', async (req, res) => {
    const motor = await buscarMotor(req.params.codigo, req.usuario);
    if (!motor) throw noExiste(req.params.codigo);
    res.json(motor);
  });

  // Crea un motor. 201 + Location: la URL del recurso nuevo, como manda HTTP.
  router.post('/', autorizar('admin', 'ingeniero'), async (req, res) => {
    const datos = validar(esquemaCrear, req.body);
    // Aquí sí 403: el sitio lo eligió el propio usuario en el body; no se revela nada ajeno.
    if (!puedeVerSitio(req.usuario, datos.sitio_id)) {
      throw new ErrorHttp(403, 'Solo puedes crear motores en tu sitio');
    }
    try {
      await pool.execute('INSERT INTO motores (codigo, modelo, sitio_id) VALUES (?, ?, ?)', [
        datos.codigo,
        datos.modelo,
        datos.sitio_id,
      ]);
    } catch (err) {
      traducirErrorMysql(err, datos.codigo);
    }
    res
      .status(201)
      .location(`/api/motores/${datos.codigo}`)
      .json(await buscarMotor(datos.codigo, req.usuario));
  });

  // Actualiza el modelo y el sitio.
  router.put('/:codigo', autorizar('admin', 'ingeniero'), async (req, res) => {
    const datos = validar(esquemaActualizar, req.body);
    if (!(await buscarMotor(req.params.codigo, req.usuario))) throw noExiste(req.params.codigo);
    // Un ingeniero tampoco puede mover un motor suyo a otro sitio.
    if (!puedeVerSitio(req.usuario, datos.sitio_id)) {
      throw new ErrorHttp(403, 'Solo puedes asignar motores a tu sitio');
    }
    const f = filtroSitio(req.usuario);
    try {
      // El filtro de sitio también va en el UPDATE: la autorización vive en la misma sentencia.
      await pool.execute(
        `UPDATE motores m SET m.modelo = ?, m.sitio_id = ? WHERE m.codigo = ? AND m.activo = TRUE${f.sql}`,
        [datos.modelo, datos.sitio_id, req.params.codigo, ...f.valores],
      );
    } catch (err) {
      traducirErrorMysql(err, req.params.codigo);
    }
    // OJO: no se usa affectedRows para el 404. Si los datos no cambian, MySQL puede contar 0 filas
    // afectadas (con flags: '-FOUND_ROWS', Fase 5). Releer el motor responde las dos preguntas.
    const motor = await buscarMotor(req.params.codigo, req.usuario);
    if (!motor) throw noExiste(req.params.codigo);
    res.json(motor);
  });

  // Baja lógica: activo = FALSE. Las lecturas históricas del motor siguen valiendo.
  router.delete('/:codigo', autorizar('admin', 'ingeniero'), async (req, res) => {
    const f = filtroSitio(req.usuario);
    const [r] = await pool.execute(
      `UPDATE motores m SET m.activo = FALSE WHERE m.codigo = ? AND m.activo = TRUE${f.sql}`,
      [req.params.codigo, ...f.valores],
    );
    // Aquí affectedRows sí sirve: la fila siempre cambia de TRUE a FALSE, o no era visible.
    if (r.affectedRows === 0) throw noExiste(req.params.codigo);
    res.status(204).end(); // 204 No Content: hecho, sin cuerpo
  });

  return router;
}
