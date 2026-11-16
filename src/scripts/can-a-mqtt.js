/**
 * can-a-mqtt.js · lee un log de candump, decodifica EEC1 y ET1 y publica MTR-03 por MQTT (Fase 8).
 * Agrupa las tramas por segundo (un instante = rpm + temperatura) y publica cada grupo en
 * motores/sur/MTR-03/telemetria con el mismo JSON que el gateway Modbus; la API lo ingiere igual.
 * Uso: npm run can (o node --env-file=.env src/scripts/can-a-mqtt.js <archivo.log>)
 * Efecto: publica en MQTT con QoS 1 como el usuario gw-sur (la ACL solo le deja escribir en sur).
 */
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import mqtt from 'mqtt';
import { z } from '../comun/zod.js';
import { parsearLineaCandump, decodificarTrama } from '../comun/j1939.js';

const cfg = z
  .object({
    MQTT_URL: z.string().default('mqtt://127.0.0.1:1883'),
    CAN_MQTT_USUARIO: z.string().optional(),
    CAN_MQTT_CLAVE: z.string().optional(),
    CAN_SITIO: z.string().default('sur'),
    CAN_MOTOR: z.string().default('MTR-03'),
    CAN_GATEWAY: z.string().default('can-sur'), // va en el campo "gateway" del mensaje
  })
  .parse(process.env);
const archivo = process.argv[2] ?? 'practica/candump-ejemplo.log';

// 1. Lectura línea por línea: readline no carga el archivo entero (un candump real pesa gigas).
// crlfDelay: Infinity trata \r\n como un solo salto de línea (archivos guardados en Windows).
const grupos = new Map(); // segundo del log → { rpm, temp_refrigerante }
const porPgn = {};        // conteo de tramas por PGN, para el resumen
const lector = createInterface({ input: createReadStream(archivo), crlfDelay: Infinity });
for await (const linea of lector) {
  const trama = parsearLineaCandump(linea);
  if (!trama) continue; // líneas vacías o que no son tramas
  const { pgn, lecturas } = decodificarTrama(trama.id, trama.datos);
  porPgn[pgn] = (porPgn[pgn] ?? 0) + 1;
  // POR QUÉ por segundo: EEC1 y ET1 llegan con milisegundos de diferencia; juntas son un instante.
  const segundo = Math.floor(trama.ts.getTime() / 1000);
  const grupo = grupos.get(segundo) ?? {};
  for (const [variable, valor] of Object.entries(lecturas)) {
    if (valor !== null) grupo[variable] = valor; // "no disponible" se omite, no se inventa
  }
  grupos.set(segundo, grupo);
}

// 2. Publicación. connectAsync espera el CONNACK antes de seguir.
const cliente = await mqtt.connectAsync(cfg.MQTT_URL, {
  clientId: `${cfg.CAN_GATEWAY}-${process.pid}`, // único: dos corridas a la vez no se desconectan entre sí
  username: cfg.CAN_MQTT_USUARIO,
  password: cfg.CAN_MQTT_CLAVE,
});
const topico = `motores/${cfg.CAN_SITIO}/${cfg.CAN_MOTOR}/telemetria`;
const segundos = [...grupos.keys()].sort((a, b) => a - b);
const ultimo = segundos.at(-1);
const ahora = Date.now();
let publicados = 0;

for (const segundo of segundos) {
  const lecturas = grupos.get(segundo);
  if (Object.keys(lecturas).length === 0) continue;
  // POR QUÉ la hora actual: el log es de otra fecha y la ingesta rechaza horas de más de 30 días.
  // Se conserva el espaciado del log: el último instante queda en "ahora" y los anteriores, antes.
  const ts = new Date(ahora - (ultimo - segundo) * 1000).toISOString();
  const mensaje = { motor: cfg.CAN_MOTOR, gateway: cfg.CAN_GATEWAY, ts, lecturas };
  await cliente.publishAsync(topico, JSON.stringify(mensaje), { qos: 1 }); // espera el PUBACK
  console.log(`${topico} ${JSON.stringify(mensaje)}`);
  publicados++;
}
await cliente.endAsync();

const nombres = { 61444: 'EEC1', 65262: 'ET1' };
const resumen = Object.entries(porPgn).map(([pgn, n]) => `${nombres[pgn] ?? `PGN ${pgn} (ignorado)`}: ${n}`).join(', ');
console.log(`Tramas por PGN → ${resumen}. Mensajes publicados: ${publicados}.`);
