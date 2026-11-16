/**
 * server.js · punto de entrada de la API: abre el puerto y hace el apagado ordenado (Fase 3).
 * Arranca con `npm run api` (o `npm run api:dev`, que reinicia al guardar cambios).
 * Las fases 6 y 9 suman al apagado el cierre de MQTT, del loteador y de los WebSocket.
 */
import { crearApp } from './app.js';
import { cerrarPool } from './db.js';
import { config } from '../comun/config.js';

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

let apagando = false;

/**
 * Apagado ordenado: deja de aceptar conexiones, espera las peticiones en curso y cierra el pool.
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

  // close(): deja de aceptar conexiones nuevas y espera que terminen las peticiones en curso.
  // Desde Node 19 también cierra las conexiones keep-alive que están ociosas.
  servidor.close(async (err) => {
    if (err) console.error('Error al cerrar el servidor HTTP:', err.message);
    await cerrarPool(); // OJO: el pool se cierra después del HTTP; una petición en curso aún puede usarlo
    console.log('Apagado completo');
    process.exit(err ? 1 : 0);
  });
}

// OJO: en Windows, Ctrl+C entrega SIGINT, pero SIGTERM entre procesos no existe: se prueba en
// Docker (Fase 12) y en systemd (Fase 13), que lo mandan al detener el servicio.
process.on('SIGINT', () => apagar('SIGINT'));
process.on('SIGTERM', () => apagar('SIGTERM'));
