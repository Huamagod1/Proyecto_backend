/**
 * silencio.js · detector de silencio: avisa cuando un motor deja de enviar datos (Fase 14).
 * Cada minuto busca en estado_actual los motores activos sin datos en los últimos 5 minutos
 * (incluidos los que nunca enviaron). Cuando un motor se calla o vuelve, avisa: log, WebSocket
 * (dashboard) y un resumen retenido por sitio en MQTT (motores/{sitio}/alertas). server.js lo inicia.
 * CONCEPTO: "nadie llama" también es una señal. Un sitio que se corta no manda errores: simplemente
 * deja de hablar, y sin este detector el problema se descubre cuando un cliente pregunta.
 */
import { pool } from './db.js';
import { log } from '../comun/log.js';

// Motores activos y su último dato; el LEFT JOIN incluye a los que nunca enviaron (último dato NULL).
const SQL_SILENCIOSOS = `
  SELECT m.codigo AS motor, s.codigo AS sitio, m.sitio_id, MAX(e.ts) AS ultimo_dato
  FROM motores m
  JOIN sitios s ON s.id = m.sitio_id
  LEFT JOIN estado_actual e ON e.motor_id = m.id
  WHERE m.activo = TRUE
  GROUP BY m.id, m.codigo, s.codigo, m.sitio_id
  HAVING ultimo_dato IS NULL OR ultimo_dato < UTC_TIMESTAMP(3) - INTERVAL ? MINUTE`;

/**
 * Compara los motores en silencio de ahora con los de la revisión anterior.
 * POR QUÉ solo transiciones: avisar cada minuto por el mismo motor callado es ruido que entrena a
 * la gente a ignorar las alertas.
 * @param {Map<string, object>} anteriores motor → fila, de la revisión anterior
 * @param {Array<{motor: string, sitio: string, sitio_id: number, ultimo_dato: Date|null}>} actuales filas de ahora
 * @returns {{nuevos: object[], recuperados: object[], siguientes: Map<string, object>}}
 */
export function compararSilencios(anteriores, actuales) {
  const siguientes = new Map(actuales.map((f) => [f.motor, f]));
  const nuevos = actuales.filter((f) => !anteriores.has(f.motor));
  const recuperados = [...anteriores.values()].filter((f) => !siguientes.has(f.motor));
  return { nuevos, recuperados, siguientes };
}

/**
 * Inicia la revisión periódica.
 * @param {object} opciones
 * @param {(alerta: object) => void} opciones.alAlertar recibe cada alerta (al dashboard por WebSocket)
 * @param {(sitio: string, resumen: object) => void} opciones.alCambiarSitio resumen de un sitio que cambió (a MQTT, retenido)
 * @param {number} [opciones.umbralMin] minutos sin datos para considerar a un motor en silencio
 * @param {number} [opciones.intervaloMs] cada cuánto se revisa
 * @returns {{detener: () => void, silenciosos: () => string[], alertasActuales: () => object[]}}
 * Efecto: una consulta a MySQL por intervalo.
 */
export function iniciarDetectorSilencio({ alAlertar, alCambiarSitio, umbralMin = 5, intervaloMs = 60_000 }) {
  // 5 min sin datos con un gateway que manda cada 5 s = unas 60 lecturas perdidas: ya no es un hipo.
  // Revisando cada 1 min, la alerta sale entre 5 y 6 min después del último dato.
  let actuales = new Map();
  let primeraVez = true;

  /** Arma la alerta de un motor que se calló (aviso) o que volvió (info). */
  const alerta = (f, nivel) => ({
    tipo: 'alerta',
    nivel,
    motor: f.motor,
    sitio: f.sitio,
    sitio_id: f.sitio_id, // tiempo-real.js filtra por este campo
    ultimo_dato: f.ultimo_dato,
    ts: new Date(),
    texto: nivel === 'aviso'
      ? `${f.motor} (${f.sitio}) sin datos ${f.ultimo_dato ? `desde ${new Date(f.ultimo_dato).toISOString()}` : 'nunca'}`
      : `${f.motor} (${f.sitio}) volvió a enviar datos`,
  });

  async function revisar() {
    // pool.query y no execute: el umbral va en INTERVAL ? MINUTE como entero (ver OJO de LIMIT en auditoria.js).
    const [filas] = await pool.query(SQL_SILENCIOSOS, [umbralMin]);
    const { nuevos, recuperados, siguientes } = compararSilencios(actuales, filas);
    actuales = siguientes;

    for (const f of nuevos) {
      log.aviso('motor_en_silencio', { motor: f.motor, sitio: f.sitio, ultimo_dato: f.ultimo_dato });
      alAlertar(alerta(f, 'aviso'));
    }
    for (const f of recuperados) {
      log.info('motor_recuperado', { motor: f.motor, sitio: f.sitio });
      alAlertar(alerta(f, 'info'));
    }

    // Resumen retenido por sitio: quien se suscriba después (un EMS) ve el estado actual de inmediato.
    // Se publica la primera vez para todos los sitios y después solo para los que cambiaron.
    const sitiosCambiados = new Set([...nuevos, ...recuperados].map((f) => f.sitio));
    const todos = new Set([...filas.map((f) => f.sitio), ...sitiosCambiados]);
    for (const sitio of primeraVez ? todos : sitiosCambiados) {
      const sinDatos = filas.filter((f) => f.sitio === sitio).map((f) => f.motor);
      alCambiarSitio(sitio, { ts: new Date(), sitio, motores_sin_datos: sinDatos });
    }
    primeraVez = false;
  }

  const ejecutar = () => revisar().catch((err) => log.error('detector_silencio_fallido', { error: err }));
  ejecutar(); // una revisión al arrancar
  const temporizador = setInterval(ejecutar, intervaloMs);
  temporizador.unref();

  return {
    detener: () => clearInterval(temporizador),
    silenciosos: () => [...actuales.keys()],
    // Para el dashboard que se conecta después: las alertas vigentes.
    alertasActuales: () => [...actuales.values()].map((f) => alerta(f, 'aviso')),
  };
}
