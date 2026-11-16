/**
 * desplegar-nodered.js · despliega flows/gateway-modbus.json en Node-RED con sus credenciales (Fase 10).
 * Lee el flujo del repositorio (sin claves), le pone el código de flows/funcion-decodificar.js y las
 * credenciales MQTT de .env, y lo sube por la Admin API de Node-RED (POST /flows).
 * Uso: npm run nodered:desplegar (con docker compose --profile nodered up -d ya andando).
 * Efecto: reemplaza todos los flujos de Node-RED; las credenciales quedan cifradas en su /data.
 */
import { readFile } from 'node:fs/promises';
import { z } from '../comun/zod.js';

const cfg = z
  .object({
    NODERED_URL: z.string().default('http://127.0.0.1:1880'),
    MQTT_NODERED_USUARIO: z.string().min(1),
    MQTT_NODERED_CLAVE: z.string().min(1),
  })
  .parse(process.env);

const flujo = JSON.parse(await readFile('flows/gateway-modbus.json', 'utf8'));
const codigo = await readFile('flows/funcion-decodificar.js', 'utf8');

for (const nodo of flujo) {
  // POR QUÉ: el código vive en un .js comentado (más fácil de leer y versionar que dentro del JSON).
  if (nodo.id === 'decodificar') nodo.func = codigo;
  // SEGURIDAD: las credenciales se agregan solo en memoria, al desplegar; el archivo del
  // repositorio nunca las tiene. Node-RED las guarda cifradas en flows_cred.json.
  if (nodo.type === 'mqtt-broker') nodo.credentials = { user: cfg.MQTT_NODERED_USUARIO, password: cfg.MQTT_NODERED_CLAVE };
}

// Admin API. Node-RED-Deployment-Type: full = reemplaza todo y reinicia todos los nodos.
// OJO: sin adminAuth en settings.js, esta API no pide clave; por eso el puerto 1880 escucha solo en 127.0.0.1.
const res = await fetch(`${cfg.NODERED_URL}/flows`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Node-RED-Deployment-Type': 'full' },
  body: JSON.stringify(flujo),
});
if (!res.ok) {
  console.error(`Node-RED respondió ${res.status}: ${await res.text()}`);
  process.exit(1);
}
// OJO: con la Admin API v1 (la de por defecto) un despliegue exitoso responde 204, sin cuerpo.
console.log(`Flujo desplegado en Node-RED: ${flujo.length} nodos (HTTP ${res.status})`);
