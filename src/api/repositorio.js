/**
 * repositorio.js · escritura de lecturas en MySQL: historial y estado actual (Fase 5).
 * Recibe filas ya validadas por evaluarLectura() desde la ingesta HTTP y, desde la Fase 6, desde
 * el loteador de MQTT. Escribe `lecturas` y `estado_actual` en una sola transacción.
 */
import { pool } from './db.js';

/**
 * Guarda un lote de lecturas sin duplicar las que ya existen.
 * @param {import('mysql2/promise').PoolConnection} conexion conexión con la transacción abierta
 * @param {Array<[number, number, Date, number, number]>} filas [motor_id, variable_id, ts, valor, calidad]
 * @returns {Promise<number>} cuántas filas eran nuevas
 * Efecto: escribe en la tabla `lecturas`.
 */
export async function insertarLecturas(conexion, filas) {
  if (filas.length === 0) return 0; // OJO: un INSERT sin filas es un error de sintaxis en MySQL

  // CONCEPTO: idempotencia. Repetir una operación deja el mismo resultado que hacerla una vez.
  // La PK (motor_id, variable_id, ts) impide guardar dos veces la misma lectura, y
  // ON DUPLICATE KEY UPDATE convierte ese choque en "no hacer nada" en vez de un error.
  // POR QUÉ: con QoS 1, MQTT puede entregar un mensaje dos veces, y un gateway reintenta un POST
  // si se corta la respuesta; la base absorbe el reenvío.
  // ALTERNATIVA: un SELECT previo. Descartada: dos peticiones simultáneas pasan ambas el chequeo.
  const sql = `
    INSERT INTO lecturas (motor_id, variable_id, ts, valor, calidad)
    VALUES ?
    ON DUPLICATE KEY UPDATE valor = valor`; // asignación neutra: la fila existente queda igual

  // OJO: query y no execute; execute usa sentencias preparadas y no expande `VALUES ?`.
  // query convierte [[1,1,ts,1500,0],[...]] en (1,1,'...',1500,0),(...): un solo INSERT por lote.
  const [resultado] = await conexion.query(sql, [filas]);

  // Con flags: ['-FOUND_ROWS'] en el pool (ver db.js), affectedRows cuenta 1 por fila nueva y 0 por repetida.
  return resultado.affectedRows;
}

/**
 * Actualiza el último valor de cada motor y variable, solo con lecturas más nuevas que la guardada.
 * @param {import('mysql2/promise').PoolConnection} conexion conexión con la transacción abierta
 * @param {Array<[number, number, Date, number, number]>} filas las mismas filas de insertarLecturas
 * @returns {Promise<void>}
 * Efecto: upsert en `estado_actual`.
 */
export async function actualizarEstado(conexion, filas) {
  if (filas.length === 0) return;
  // `AS nuevo` nombra la fila entrante (MySQL 8.0.19+); reemplaza a VALUES(), que está obsoleto.
  // IF(nuevo.ts > estado_actual.ts, ...): una lectura atrasada (un buffer que drena tarde) no pisa
  // un valor más reciente.
  // OJO: MySQL aplica las asignaciones de izquierda a derecha y cada una ve las anteriores. Si `ts`
  // fuera primero, las siguientes compararían contra el ts ya actualizado. Por eso va al final.
  const sql = `
    INSERT INTO estado_actual (motor_id, variable_id, ts, valor, calidad)
    VALUES ? AS nuevo
    ON DUPLICATE KEY UPDATE
      valor   = IF(nuevo.ts > estado_actual.ts, nuevo.valor,   estado_actual.valor),
      calidad = IF(nuevo.ts > estado_actual.ts, nuevo.calidad, estado_actual.calidad),
      ts      = IF(nuevo.ts > estado_actual.ts, nuevo.ts,      estado_actual.ts)`;
  await conexion.query(sql, [filas]);
}

/**
 * Guarda un lote completo: historial y estado actual, todo o nada.
 * @param {Array<[number, number, Date, number, number]>} filas lecturas válidas
 * @returns {Promise<number>} cuántas lecturas eran nuevas
 * @throws {Error} si MySQL falla; en ese caso no queda nada escrito (rollback)
 * Efecto: una transacción con dos sentencias en MySQL.
 */
export async function guardarLote(filas) {
  // POR QUÉ ordenar: dos lotes que tocan las mismas filas de estado_actual en distinto orden pueden
  // bloquearse mutuamente (deadlock). En el mismo orden, uno simplemente espera al otro.
  const ordenadas = [...filas].sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);

  // CONCEPTO: transacción. Las dos escrituras se confirman juntas (commit) o se deshacen juntas
  // (rollback): nunca queda una lectura en el historial sin su estado, ni al revés.
  // OJO: la transacción vive en UNA conexión; por eso se pide una al pool en vez de usar pool.query.
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const nuevas = await insertarLecturas(conexion, ordenadas);
    await actualizarEstado(conexion, ordenadas);
    await conexion.commit();
    return nuevas;
  } catch (err) {
    await conexion.rollback();
    throw err;
  } finally {
    conexion.release(); // devuelve la conexión al pool, pase lo que pase
  }
}
