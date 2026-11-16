/**
 * config.js · configuración de la API, leída de las variables de entorno (Fase 3).
 * Las variables llegan desde .env con `node --env-file=.env` (o desde .env.test en las pruebas).
 * La usan db.js y server.js; cada fase agrega las suyas (JWT en la 4, MQTT en la 6).
 * Si falta algo obligatorio, el proceso termina al arrancar con un mensaje claro, no en la
 * primera petición.
 */
import { z } from './zod.js'; // zod con mensajes en español (ver zod.js)

// CONCEPTO: fallar rápido (fail fast). Un error de configuración se detecta al arrancar, cuando
// todavía no hay usuarios conectados, y no a las 3 AM en la primera consulta que lo necesita.
// POR QUÉ zod: el entorno también es una entrada externa; se valida igual que un body.
const esquema = z.object({
  // z.coerce: process.env siempre trae texto; coerce lo convierte a número antes de validar.
  PUERTO: z.coerce.number().int().min(1).max(65535).default(3000),
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PUERTO: z.coerce.number().int().default(3306),
  DB_USUARIO: z.string().default('telemetria_app'),
  // SEGURIDAD: sin valor por defecto. Una clave nunca vive en el código.
  DB_CLAVE: z.string({ error: 'es obligatoria' }).min(1, 'es obligatoria'),
  DB_NOMBRE: z.string().default('telemetria'),
  // SEGURIDAD: con HS256, quien conoce el secreto puede fabricar tokens válidos. 32 caracteres o
  // más (256 bits en hexadecimal) hacen inviable adivinarlo por fuerza bruta.
  JWT_SECRETO: z.string({ error: 'es obligatorio' }).min(32, 'debe tener 32 caracteres o más'),
  // Fase 6: broker MQTT. Usuario y clave son opcionales: sin ellos, la conexión es anónima.
  MQTT_URL: z.string().regex(/^mqtts?:\/\//, 'debe empezar con mqtt:// o mqtts://').default('mqtt://127.0.0.1:1883'),
  MQTT_USUARIO: z.string().min(1).optional(),
  MQTT_CLAVE: z.string().min(1).optional(),
  // Fase 13: cuántos proxies hay delante (1 = nginx). 0 = la API recibe las conexiones directo.
  CONFIAR_PROXY: z.coerce.number().int().min(0).max(5).default(0),
});

const resultado = esquema.safeParse(process.env);
if (!resultado.success) {
  // Un mensaje por variable: "DB_CLAVE: es obligatoria". Sin valores, para no filtrar secretos al log.
  const detalle = resultado.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
  throw new Error(`Configuración inválida (revisa tu .env): ${detalle}`);
}
const env = resultado.data;

// Object.freeze: nadie puede cambiar la configuración en tiempo de ejecución por error.
export const config = Object.freeze({
  puerto: env.PUERTO,
  db: Object.freeze({
    host: env.DB_HOST,
    puerto: env.DB_PUERTO,
    usuario: env.DB_USUARIO,
    clave: env.DB_CLAVE,
    nombre: env.DB_NOMBRE,
  }),
  jwt: Object.freeze({
    secreto: env.JWT_SECRETO,
    duracionSeg: 15 * 60, // 15 min en s: si roban un token, sirve poco tiempo
  }),
  mqtt: Object.freeze({ url: env.MQTT_URL, usuario: env.MQTT_USUARIO, clave: env.MQTT_CLAVE }),
  confiarProxy: env.CONFIAR_PROXY,
});
