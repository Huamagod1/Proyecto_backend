/**
 * ingesta-mqtt.js · recibe la telemetría por MQTT y la pasa al loteador (Fase 6).
 * Se suscribe a la telemetría y al estado de los gateways de todos los sitios. Cada mensaje se
 * valida (JSON, forma, tópico) y cada lectura pasa por evaluarLectura(), igual que en la ingesta
 * HTTP; las válidas van al loteador, que las escribe en MySQL por lotes. server.js la inicia y la detiene.
 * CONCEPTO: MQTT es una radio con canales. El gateway transmite en un tópico y el broker, la antena
 * central, se lo entrega a quien esté sintonizado. Nadie le pregunta nada a nadie: publicar y
 * suscribir están desacoplados.
 */
import mqtt from 'mqtt';
import { z } from '../comun/zod.js';
import { catalogoListo } from './catalogo.js';
import { evaluarLectura } from '../comun/validacion.js';
import { log } from '../comun/log.js';

// Forma del mensaje de telemetría (ver docs/topicos.md).
const esquemaMensaje = z.object({
  motor: z.string().min(1).max(20),
  gateway: z.string().min(1).max(40),
  ts: z.iso.datetime({ offset: true }),
  // record: un objeto con claves libres (las variables) y valores numéricos.
  lecturas: z.record(z.string().min(1).max(40), z.number()),
});

/**
 * Conecta al broker y empieza a recibir.
 * @param {object} opciones
 * @param {string} opciones.url 'mqtt://127.0.0.1:1883'
 * @param {string} [opciones.usuario] usuario del broker (desde el paso 9; sin él, conexión anónima)
 * @param {string} [opciones.clave]
 * @param {{agregar: Function}} opciones.loteador recibe las filas válidas
 * @param {(id: string, info: object) => void} [opciones.alCambiarGateway] aviso cuando un gateway cambia de estado (Fase 9)
 * @returns {{contadores: object, gateways: Map, detener: () => Promise<void>, conectado: () => boolean}}
 * Efecto: abre una conexión TCP al broker y se suscribe con QoS 1.
 */
export function iniciarIngestaMqtt({ url, usuario, clave, loteador, alCambiarGateway = () => {} }) {
  const contadores = { mensajes: 0, aceptadas: 0, rechazos: {} }; // para /api/metricas (Fase 14)
  const gateways = new Map(); // 'gw-norte' → { sitio: 'norte', estado: 'online', desde: Date }

  /** Suma un rechazo al contador de su motivo. */
  const rechazar = (motivo) => {
    contadores.rechazos[motivo] = (contadores.rechazos[motivo] ?? 0) + 1;
  };

  // CONCEPTO: sesión persistente. Con un clientId fijo y clean: false, el broker recuerda las
  // suscripciones de 'api-ingesta' y le GUARDA los mensajes QoS 1 mientras está desconectada.
  // Al volver, se los entrega. OJO: si dos procesos usan el mismo clientId, el broker desconecta
  // al anterior: hay una sola API leyendo esta sesión.
  const cliente = mqtt.connect(url, {
    clientId: 'api-ingesta',
    clean: false,
    username: usuario,       // undefined = conexión anónima (paso 1 del plan)
    password: clave,
    reconnectPeriod: 2_000,  // 2 s entre reintentos si se corta la conexión
    connectTimeout: 10_000,  // 10 s para que el broker responda al CONNECT
  });

  cliente.on('connect', (connack) => {
    // sessionPresent: el broker ya tenía guardada la sesión (y quizás mensajes pendientes).
    log.info('mqtt_conectado', { url, sesion: connack.sessionPresent ? 'recuperada' : 'nueva' });
    // + reemplaza un nivel del tópico. QoS 1: "al menos una vez" (ver docs/topicos.md).
    cliente.subscribe(
      { 'motores/+/+/telemetria': { qos: 1 }, 'motores/+/gateways/+/estado': { qos: 1 } },
      (err) => err && log.error('mqtt_suscripcion_fallida', { error: err }),
    );
  });
  cliente.on('error', (err) => log.error('mqtt_error', { error: err })); // p. ej. "Not authorized"
  cliente.on('offline', () => log.aviso('mqtt_sin_conexion', { reintentoMs: 2000 }));

  // OJO: mqtt.js confirma (PUBACK) cada mensaje QoS 1 apenas lo entrega a este evento, antes de
  // que llegue a MySQL. Si la API muere de golpe, se pierde lo que el loteador tenía en memoria
  // (hasta 1 s). ALTERNATIVA: confirmar después de escribir (handleMessage); más seguro y más complejo.
  cliente.on('message', (topico, payload) => {
    procesar(topico, payload).catch((err) => log.error('mqtt_mensaje_fallido', { topico, error: err }));
  });

  /**
   * Valida un mensaje y entrega sus lecturas válidas al loteador.
   * @param {string} topico p. ej. 'motores/norte/MTR-01/telemetria'
   * @param {Buffer} payload el contenido crudo del mensaje
   */
  async function procesar(topico, payload) {
    contadores.mensajes += 1;
    const partes = topico.split('/');

    // motores/{sitio}/gateways/{id}/estado → 'online' u 'offline'
    if (partes.length === 5 && partes[2] === 'gateways' && partes[4] === 'estado') {
      const info = { sitio: partes[1], estado: payload.toString('utf8'), desde: new Date() };
      gateways.set(partes[3], info);
      alCambiarGateway(partes[3], info);
      return;
    }
    // motores/{sitio}/{motor}/telemetria
    if (partes.length !== 4 || partes[3] !== 'telemetria') return rechazar('topico_desconocido');
    const [, codigoSitio, codigoMotor] = partes;

    let datos;
    try {
      datos = JSON.parse(payload.toString('utf8'));
    } catch {
      return rechazar('json_invalido');
    }
    const forma = esquemaMensaje.safeParse(datos);
    if (!forma.success) return rechazar('forma_invalida');
    const mensaje = forma.data;
    // SEGURIDAD: el tópico es lo que controla la ACL; un mensaje que dice ser de otro motor no pasa.
    if (mensaje.motor !== codigoMotor) return rechazar('topico_no_coincide');

    const cat = await catalogoListo();
    const sitio = cat.sitio(codigoSitio);
    if (!sitio) return rechazar('sitio_desconocido');

    // POR QUÉ el sitio del tópico hace de "usuario": la ACL del broker (paso 9) solo deja a
    // gw-norte escribir en motores/norte/#, así que el tópico ya prueba de qué sitio viene.
    const remitente = { rol: 'gateway', sitio: sitio.id };
    const ahora = new Date();
    const filas = [];
    // Un mensaje trae varias variables del mismo instante: una lectura (y una fila) por variable.
    for (const [variable, valor] of Object.entries(mensaje.lecturas)) {
      const r = evaluarLectura({ motor: mensaje.motor, variable, ts: mensaje.ts, valor }, cat, remitente, ahora);
      if (r.ok) filas.push(r.fila);
      else rechazar(r.motivo);
    }
    contadores.aceptadas += filas.length;
    if (filas.length > 0) loteador.agregar(filas);
  }

  /**
   * Cierra la conexión con un DISCONNECT limpio. La sesión persistente queda guardada en el broker.
   * @returns {Promise<void>}
   */
  async function detener() {
    await cliente.endAsync();
  }

  /**
   * Publica un mensaje con este mismo cliente (Fase 14: alertas de silencio).
   * @param {string} topico
   * @param {string} payload
   * @param {{qos?: 0|1|2, retain?: boolean}} [opciones]
   * @returns {Promise<void>} se resuelve con el PUBACK; si no hay conexión, mqtt.js la encola
   */
  const publicar = (topico, payload, opciones = { qos: 1 }) => cliente.publishAsync(topico, payload, opciones);

  return { contadores, gateways, detener, publicar, conectado: () => cliente.connected };
}
