/**
 * buffer-local.js · el cuaderno del gateway: mensajes pendientes en SQLite (Fase 7).
 * gateway.js guarda aquí cada mensaje ANTES de publicarlo y lo borra cuando el broker confirma.
 * Si se corta el enlace, los mensajes esperan aquí, en disco, y salen en orden al volver.
 * CONCEPTO: store-and-forward (guardar y reenviar), como el registrador de una estación remota.
 */
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * Abre (o crea) el buffer.
 * @param {string} ruta archivo SQLite, p. ej. './datos/buffer.sqlite'; ':memory:' para pruebas
 * @param {{maxPendientes?: number}} [opciones] tope de mensajes guardados
 * @returns {{guardar: Function, siguientes: Function, confirmar: Function, pendientes: Function, cerrar: Function}}
 * Efecto: crea la carpeta y el archivo si no existen.
 */
export function abrirBuffer(ruta, { maxPendientes = 200_000 } = {}) {
  // 200 000 mensajes: con 2 motores cada 5 s, son unos 5 días sin enlace (~60 MB en disco).
  if (ruta !== ':memory:') mkdirSync(dirname(ruta), { recursive: true });

  // DatabaseSync: la API síncrona de node:sqlite (sin librerías externas). Síncrona está bien
  // aquí: cada operación toma microsegundos y el gateway hace una cosa a la vez.
  const db = new DatabaseSync(ruta);
  db.exec(`
    -- WAL (write-ahead log): las escrituras van a un registro aparte; leer y escribir no se bloquean.
    PRAGMA journal_mode = WAL;
    -- FULL: cada commit se fuerza a disco. POR QUÉ: el buffer existe para sobrevivir a cortes;
    -- con 1 mensaje cada pocos segundos, el costo del fsync no se nota.
    PRAGMA synchronous = FULL;
    CREATE TABLE IF NOT EXISTS pendientes (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,  -- AUTOINCREMENT: los id nunca se reutilizan, el orden es el de llegada
      topico    TEXT NOT NULL,                      -- tópico MQTT donde se publicará
      payload   TEXT NOT NULL,                      -- el mensaje JSON, tal cual
      creado_en TEXT NOT NULL                       -- ISO 8601 en UTC: para medir cuánto lleva esperando
    );
  `);

  // Sentencias preparadas una vez y reutilizadas: más rápido y sin concatenar valores.
  const insertar = db.prepare('INSERT INTO pendientes (topico, payload, creado_en) VALUES (?, ?, ?)');
  const contar = db.prepare('SELECT COUNT(*) AS n FROM pendientes');
  const descartarAntiguos = db.prepare('DELETE FROM pendientes WHERE id IN (SELECT id FROM pendientes ORDER BY id LIMIT ?)');
  const leer = db.prepare('SELECT id, topico, payload FROM pendientes ORDER BY id LIMIT ?');
  const borrar = db.prepare('DELETE FROM pendientes WHERE id = ?');

  return {
    /**
     * Guarda un mensaje. Si se supera el tope, descarta los más antiguos.
     * @param {string} topico
     * @param {string} payload
     * @returns {{id: number, descartados: number}} descartados > 0 significa pérdida de datos: hay que avisar
     */
    guardar(topico, payload) {
      const { lastInsertRowid } = insertar.run(topico, payload, new Date().toISOString());
      const exceso = contar.get().n - maxPendientes;
      if (exceso > 0) descartarAntiguos.run(exceso);
      return { id: Number(lastInsertRowid), descartados: Math.max(0, exceso) };
    },
    /** Los n mensajes más antiguos, sin borrarlos. @returns {Array<{id: number, topico: string, payload: string}>} */
    siguientes: (n) => leer.all(n),
    /** Borra un mensaje que el broker ya confirmó (PUBACK). */
    confirmar: (id) => void borrar.run(id),
    /** Cuántos mensajes esperan. */
    pendientes: () => contar.get().n,
    /** Cierra el archivo. */
    cerrar: () => db.close(),
  };
}
