/**
 * gateway.js · el traductor de la faena: lee Modbus TCP y publica por MQTT sin perder datos (Fase 7).
 * Cada ciclo pregunta los 8 registros de cada equipo (función 03), los decodifica, arma el mensaje
 * JSON de docs/topicos.md y lo guarda en el buffer SQLite ANTES de publicarlo. drenar() publica lo
 * pendiente con QoS 1 y borra cada mensaje solo cuando el broker confirma (PUBACK).
 * CONCEPTO: Modbus es pasar lista: el gateway (maestro) pregunta y cada equipo responde por su número.
 * Uso: npm run gateway (lee las variables GATEWAY_*, MODBUS_* y MQTT_URL de .env).
 */
import ModbusRTU from 'modbus-serial';
import mqtt from 'mqtt';
import { z } from '../comun/zod.js';
import { decodificarRegistros, alarmasActivas } from '../comun/decodificacion.js';
import { abrirBuffer } from './buffer-local.js';

// Configuración propia del gateway: no depende de la de la API (no necesita MySQL ni JWT).
const cfg = z
  .object({
    MODBUS_HOST: z.string().default('127.0.0.1'),
    MODBUS_PUERTO: z.coerce.number().int().default(5020),
    GATEWAY_ID: z.string().min(1).default('gw-norte'),
    GATEWAY_SITIO: z.string().min(1).default('norte'),
    // "unitId:motor" separados por coma: 1:MTR-01,2:MTR-02
    GATEWAY_EQUIPOS: z.string().regex(/^\d+:MTR-\d{2,4}(,\d+:MTR-\d{2,4})*$/, 'formato: 1:MTR-01,2:MTR-02').default('1:MTR-01,2:MTR-02'),
    GATEWAY_BUFFER: z.string().default('./datos/buffer.sqlite'),
    GATEWAY_PERIODO_MS: z.coerce.number().int().min(500).default(5000), // 5 s entre lecturas de cada equipo
    MQTT_URL: z.string().default('mqtt://127.0.0.1:1883'),
    GATEWAY_MQTT_USUARIO: z.string().optional(),
    GATEWAY_MQTT_CLAVE: z.string().optional(),
  })
  .parse(process.env);

const equipos = cfg.GATEWAY_EQUIPOS.split(',').map((par) => {
  const [unitId, motor] = par.split(':');
  return { unitId: Number(unitId), motor };
});
const topicoEstado = `motores/${cfg.GATEWAY_SITIO}/gateways/${cfg.GATEWAY_ID}/estado`;
const buffer = abrirBuffer(cfg.GATEWAY_BUFFER);
const modbus = new ModbusRTU();
modbus.setTimeout(1000); // 1 s: un equipo que no responde no frena el ciclo de los demás

// CONCEPTO: Last Will (último deseo). Se entrega al conectar; si el gateway se desconecta sin
// avisar (corte de luz, kill -9), el broker publica 'offline' por él. retain: el estado queda
// guardado y cualquiera que se suscriba después lo ve.
const cliente = mqtt.connect(cfg.MQTT_URL, {
  clientId: `gateway-${cfg.GATEWAY_ID}`,
  clean: true,             // el gateway solo publica; su respaldo es el buffer, no una sesión del broker
  username: cfg.GATEWAY_MQTT_USUARIO,
  password: cfg.GATEWAY_MQTT_CLAVE,
  reconnectPeriod: 2_000,  // 2 s entre reintentos
  will: { topic: topicoEstado, payload: 'offline', qos: 1, retain: true },
});

cliente.on('connect', async () => {
  console.log(`MQTT: conectado a ${cfg.MQTT_URL}; ${buffer.pendientes()} mensajes en el buffer`);
  await cliente.publishAsync(topicoEstado, 'online', { qos: 1, retain: true }).catch(() => {});
  void drenar(); // al volver el enlace, lo acumulado sale en orden
});
cliente.on('error', (err) => console.error('MQTT:', err.message));
cliente.on('offline', () => console.error(`MQTT: sin enlace; guardando en el buffer (${buffer.pendientes()} pendientes)`));

let drenando = false;

/**
 * Publica los mensajes pendientes, del más antiguo al más nuevo, y borra cada uno cuando el broker
 * confirma. Si el enlace se corta a mitad, lo no confirmado sigue en el buffer.
 * Efecto: publica en MQTT y borra filas de SQLite.
 */
async function drenar() {
  if (drenando || !cliente.connected) return; // un solo drenaje a la vez
  drenando = true;
  try {
    while (cliente.connected) {
      const lote = buffer.siguientes(50); // de a 50: no carga en memoria todo lo acumulado
      if (lote.length === 0) break;
      for (const p of lote) {
        // publishAsync con QoS 1 se resuelve cuando llega el PUBACK del broker.
        await cliente.publishAsync(p.topico, p.payload, { qos: 1 });
        buffer.confirmar(p.id); // recién ahora se borra: si el gateway muere antes, se reenvía (y la PK absorbe el duplicado)
      }
    }
  } catch (err) {
    console.error('drenaje interrumpido:', err.message);
  } finally {
    drenando = false;
  }
}

const ultimasAlarmas = new Map(); // motor → bits, para avisar solo cuando cambian

/**
 * Un ciclo: lee cada equipo, guarda sus mensajes en el buffer y drena.
 * Efecto: lectura Modbus TCP, escritura en SQLite y publicación MQTT.
 */
async function ciclo() {
  const inicio = Date.now(); // para descontar lo que tarda el ciclo y no correr la cadencia
  try {
    if (!modbus.isOpen) await modbus.connectTCP(cfg.MODBUS_HOST, { port: cfg.MODBUS_PUERTO });
    for (const { unitId, motor } of equipos) {
      try {
        modbus.setID(unitId); // a qué equipo del bus se le pregunta
        // Función 03 (Read Holding Registers): 8 registros desde la dirección 0.
        const { data } = await modbus.readHoldingRegisters(0, 8);
        const { lecturas, sinDato } = decodificarRegistros(data);
        if (sinDato.length > 0) console.warn(`${motor}: sin dato en ${sinDato.join(', ')}`);
        if (ultimasAlarmas.get(motor) !== lecturas.alarmas) {
          ultimasAlarmas.set(motor, lecturas.alarmas);
          console.log(`${motor}: alarmas → ${alarmasActivas(lecturas.alarmas ?? 0).join(', ') || 'ninguna'}`);
        }
        // La hora la pone el gateway al leer: si el mensaje espera horas en el buffer, conserva su hora real.
        const mensaje = { motor, gateway: cfg.GATEWAY_ID, ts: new Date().toISOString(), lecturas };
        // POR QUÉ guardar antes de publicar: si el enlace o el proceso caen después de este punto,
        // el dato ya está en disco. Publicar primero arriesgaría perder justo lo del corte.
        const { descartados } = buffer.guardar(`motores/${cfg.GATEWAY_SITIO}/${motor}/telemetria`, JSON.stringify(mensaje));
        if (descartados > 0) console.error(`buffer lleno: se descartaron ${descartados} mensajes antiguos`);
      } catch (err) {
        console.error(`${motor} (Unit ${unitId}): no respondió: ${err.message}`);
      }
    }
  } catch (err) {
    console.error(`Modbus: sin conexión con ${cfg.MODBUS_HOST}:${cfg.MODBUS_PUERTO}: ${err.message}`);
    modbus.close(() => {}); // se reintenta conectar en el próximo ciclo
  }
  // POR QUÉ sin await: tras un corte largo, drenar miles de mensajes toma su tiempo. Si el ciclo lo
  // esperara, dejaría de leer los equipos mientras tanto y abriría un hueco real en los datos.
  // drenar() tiene su propio candado (drenando), así que llamarlo de nuevo no duplica el trabajo.
  void drenar();
  // POR QUÉ setTimeout encadenado y no setInterval: el próximo ciclo se agenda cuando este termina.
  // Con setInterval, un ciclo lento (timeouts de Modbus) se montaría sobre el siguiente.
  // Se descuenta lo que tardó este ciclo: si no, el período real sería 5 s + ~40 ms y la grilla de
  // horas se correría (11 lecturas en algunos minutos en vez de 12).
  const espera = Math.max(0, cfg.GATEWAY_PERIODO_MS - (Date.now() - inicio));
  if (!deteniendo) temporizador = setTimeout(ciclo, espera);
}

let deteniendo = false;
let temporizador = setTimeout(ciclo, 0);
console.log(`Gateway ${cfg.GATEWAY_ID} (sitio ${cfg.GATEWAY_SITIO}, PID ${process.pid}): ${equipos.map((e) => `${e.unitId}=${e.motor}`).join(', ')} cada ${cfg.GATEWAY_PERIODO_MS} ms`);

/**
 * Apagado ordenado: deja de leer, avisa 'offline' y cierra todo.
 * OJO: una desconexión limpia NO dispara el Last Will; por eso el 'offline' se publica a mano.
 */
async function apagar(senal) {
  if (deteniendo) return;
  deteniendo = true;
  console.log(`${senal}: apagando el gateway (${buffer.pendientes()} mensajes quedan en el buffer)`);
  clearTimeout(temporizador);
  if (cliente.connected) await cliente.publishAsync(topicoEstado, 'offline', { qos: 1, retain: true }).catch(() => {});
  await cliente.endAsync().catch(() => {});
  modbus.close(() => {});
  buffer.cerrar(); // lo pendiente queda en disco y sale en el próximo arranque
  process.exit(0);
}
process.on('SIGINT', () => apagar('SIGINT'));
process.on('SIGTERM', () => apagar('SIGTERM'));
