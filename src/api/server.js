/**
 * server.js · punto de entrada de la API: abre el puerto y hace el apagado ordenado (Fase 3).
 * Arranca con `npm run api` (o `npm run api:dev`, que reinicia al guardar cambios).
 * Fase 5: carga el catálogo. Fase 6: inicia la ingesta MQTT y el loteador que escribe en MySQL.
 * Fase 9: WebSocket en /ws; el loteador avisa cada escritura confirmada y la ingesta cada cambio
 * de estado de un gateway, y tiempo-real.js lo empuja a los dashboards.
 */
import { crearApp } from './app.js';
import { cerrarPool } from './db.js';
import { cargarCatalogo, iniciarRefresco, detenerRefresco, catalogo } from './catalogo.js';
import { crearLoteador } from './loteador.js';
import { iniciarIngestaMqtt } from './ingesta-mqtt.js';
import { guardarLote } from './repositorio.js';
import { iniciarTiempoReal, lecturasAMensajes } from './tiempo-real.js';
import { config } from '../comun/config.js';

// Fase 5: el catálogo de motores y variables se carga al arrancar y se refresca cada 60 s.
// Si MySQL todavía no responde, no se cae: la primera lectura que llegue lo vuelve a intentar.
cargarCatalogo().catch((err) => console.error('catálogo: no pude cargarlo al arrancar:', err.message));
iniciarRefresco();

const app = crearApp();

// En Express 5, si el puerto está ocupado, el callback recibe el error (EADDRINUSE).
const servidor = app.listen(config.puerto, (err) => {
  if (err) {
    console.error(`No pude abrir el puerto ${config.puerto}:`, err.message);
    process.exit(1);
  }
  // process.pid: sirve para detener este proceso desde otra terminal (taskkill /PID en Windows).
  console.log(`API escuchando en http://localhost:${config.puerto} (PID ${process.pid})`);
});

/** Mensaje de estado de un gateway para el dashboard, con el id de su sitio para filtrar. */
const mensajeGateway = (id, info) => ({ tipo: 'gateway', id, ...info, sitio_id: catalogo.sitio(info.sitio)?.id });

// Fase 9: el WebSocket comparte el puerto HTTP. Al conectarse, cada dashboard recibe el estado
// actual de los gateways que puede ver (ingesta se define más abajo; se lee al conectar).
const tiempoReal = iniciarTiempoReal(servidor, {
  estadoInicial: () => [...ingesta.gateways].map(([id, info]) => mensajeGateway(id, info)),
});

// Fase 6: lo que llega por MQTT se junta en el loteador y se escribe con guardarLote (repositorio.js).
// Fase 9: alEscribir se llama DESPUÉS del commit. POR QUÉ: el dashboard nunca muestra un dato que
// no quedó guardado; si la base falla, no se avisa nada y el lote se reintenta.
const loteador = crearLoteador({
  escribir: guardarLote,
  alEscribir: (lote) => {
    for (const mensaje of lecturasAMensajes(lote, catalogo)) tiempoReal.difundir(mensaje);
  },
});
const ingesta = iniciarIngestaMqtt({
  url: config.mqtt.url,
  usuario: config.mqtt.usuario,
  clave: config.mqtt.clave,
  loteador,
  alCambiarGateway: (id, info) => tiempoReal.difundir(mensajeGateway(id, info)),
});

let apagando = false;

/**
 * Apagado ordenado, de afuera hacia adentro: primero se dejan de recibir datos, después se escribe
 * lo pendiente y al final se cierra la base, que los pasos anteriores todavía necesitan.
 * @param {string} senal la señal recibida: 'SIGINT' (Ctrl+C) o 'SIGTERM' (Docker, systemd)
 * Efecto: termina el proceso con código 0 si todo cerró bien, o 1 si no.
 */
async function apagar(senal) {
  if (apagando) return; // POR QUÉ: un segundo Ctrl+C no debe iniciar otro cierre a medias
  apagando = true;
  console.log(`${senal} recibido: apagado ordenado`);

  // Red de seguridad: si algo no cierra en 8 s, sale igual. 8 s: menos que los 10 s que Docker
  // espera tras el SIGTERM antes de matar con SIGKILL. unref(): este timer no mantiene vivo el
  // proceso por sí solo.
  setTimeout(() => {
    console.error('El apagado tardó más de 8 s: salgo a la fuerza');
    process.exit(1);
  }, 8_000).unref();

  let codigo = 0;
  try {
    detenerRefresco(); // sin más consultas periódicas al catálogo
    // 0. WebSocket: cierra los dashboards con 1001 ("me voy"); el navegador se reconectará solo.
    tiempoReal.cerrar();
    // 1. HTTP: close() deja de aceptar conexiones y espera las peticiones en curso. Desde Node 19
    //    también cierra las conexiones keep-alive ociosas.
    await new Promise((resolve, reject) => servidor.close((err) => (err ? reject(err) : resolve())));
    // 2. MQTT: no entran más mensajes. La sesión persistente sigue en el broker y guarda lo que llegue.
    await ingesta.detener();
    // 3. Loteador: escribe lo pendiente mientras el pool sigue abierto.
    if ((await loteador.detener()) > 0) codigo = 1;
    // 4. Pool: al final, porque los pasos anteriores lo usan.
    await cerrarPool();
  } catch (err) {
    console.error('Error durante el apagado:', err.message);
    codigo = 1;
  }
  console.log('Apagado completo');
  process.exit(codigo);
}

// OJO: en Windows, Ctrl+C entrega SIGINT, pero SIGTERM entre procesos no existe: se prueba en
// Docker (Fase 12) y en systemd (Fase 13), que lo mandan al detener el servicio.
process.on('SIGINT', () => apagar('SIGINT'));
process.on('SIGTERM', () => apagar('SIGTERM'));
