/**
 * tiempo-real.js · WebSocket en /ws: empuja lecturas y estados de gateways al dashboard (Fase 9).
 * server.js lo engancha al servidor HTTP. Verifica el JWT ANTES de aceptar la conexión y manda a
 * cada cliente solo lo de los sitios que puede ver. El loteador lo llama con cada escritura
 * confirmada en MySQL, y la ingesta MQTT con cada cambio de estado de un gateway.
 * CONCEPTO: HTTP es mandar cartas: el navegador pregunta y el servidor responde. WebSocket es una
 * llamada telefónica abierta: el servidor habla apenas tiene algo nuevo, sin que le pregunten.
 */
import { WebSocketServer, WebSocket } from 'ws';
import { verificarToken, puedeVerSitio } from './auth.js';

const LATIDO_MS = 30_000; // 30 s entre pings: detecta conexiones muertas (Wi-Fi caído, laptop cerrada)

/**
 * Inicia el servidor WebSocket sobre un servidor HTTP que ya escucha.
 * @param {import('node:http').Server} servidorHttp el que devuelve app.listen()
 * @param {{estadoInicial?: () => object[]}} [opciones] mensajes que recibe cada cliente al conectarse
 * @returns {{difundir: (mensaje: object) => number, clientes: () => number, cerrar: () => void}}
 * Efecto: atiende el evento 'upgrade' del servidor HTTP y deja un temporizador de pings.
 */
export function iniciarTiempoReal(servidorHttp, { estadoInicial = () => [] } = {}) {
  // noServer: ws no abre puerto propio; comparte el de Express y decide aquí qué upgrades acepta.
  // maxPayload: 4096 bytes como máximo por mensaje entrante; el dashboard no necesita mandar más.
  // SEGURIDAD: sin ese tope, un cliente podría mandar mensajes gigantes y agotar la memoria.
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });

  // CONCEPTO: upgrade. El navegador abre una petición HTTP normal con "Upgrade: websocket"; si el
  // servidor acepta, esa misma conexión TCP pasa a hablar el protocolo WebSocket.
  servidorHttp.on('upgrade', (req, socket, head) => {
    // req.url es solo la ruta (/ws?token=...); URL necesita una base para poder parsearla.
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname !== '/ws') return rechazar(socket, '404 Not Found');

    // POR QUÉ autenticar aquí y no después: si se acepta primero, cualquiera mantiene sockets
    // abiertos (y consume memoria) antes de probar quién es. Rechazar en el upgrade cuesta nada.
    // OJO: el navegador no permite encabezados propios en un WebSocket; por eso el token viaja
    // en la URL. Queda en los logs de los proxies: ver docs/decisiones.md (mejora: ticket de un uso).
    let datos;
    try {
      datos = verificarToken(url.searchParams.get('token') ?? '');
    } catch {
      return rechazar(socket, '401 Unauthorized');
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.usuario = { id: Number(datos.sub), usuario: datos.usuario, rol: datos.rol, sitio: datos.sitio };
      ws.vivo = true;
      // SEGURIDAD: la conexión no puede durar más que el token. Al vencer, se cierra con 4001
      // (los códigos 4000-4999 son de la aplicación) y el dashboard pide iniciar sesión de nuevo.
      const restanteMs = datos.exp * 1000 - Date.now();
      ws.vencimiento = setTimeout(() => ws.close(4001, 'token vencido'), restanteMs);
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws) => {
    ws.on('pong', () => {
      ws.vivo = true; // respondió al último ping: sigue ahí
    });
    ws.on('close', () => clearTimeout(ws.vencimiento));
    ws.on('error', (err) => console.error('websocket:', err.message));
    // Saludo y foto inicial (estados de los gateways), filtrados por sitio.
    enviar(ws, { tipo: 'bienvenida', usuario: ws.usuario.usuario, rol: ws.usuario.rol });
    for (const mensaje of estadoInicial()) {
      if (puedeVerSitio(ws.usuario, mensaje.sitio_id)) enviar(ws, mensaje);
    }
  });

  // Latido: cada 30 s, quien no respondió el ping anterior se da por muerto y se cierra.
  // POR QUÉ: una conexión TCP cortada sin aviso (un cable, un router) puede parecer abierta horas.
  const latido = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.vivo) {
        ws.terminate(); // cierre inmediato, sin el saludo de cierre de WebSocket
        continue;
      }
      ws.vivo = false;
      ws.ping();
    }
  }, LATIDO_MS);
  latido.unref();

  /**
   * Envía un mensaje a todos los clientes que pueden ver su sitio.
   * @param {{sitio_id: number}} mensaje cualquier objeto con el sitio al que pertenece
   * @returns {number} a cuántos clientes se envió
   */
  function difundir(mensaje) {
    const texto = JSON.stringify(mensaje); // se serializa una vez, no una por cliente
    let enviados = 0;
    for (const ws of wss.clients) {
      // SEGURIDAD: el mismo filtro que la API REST; un lector de sur nunca recibe datos de norte.
      if (ws.readyState === WebSocket.OPEN && puedeVerSitio(ws.usuario, mensaje.sitio_id)) {
        ws.send(texto);
        enviados++;
      }
    }
    return enviados;
  }

  /** Cierra todos los clientes con 1001 ("me voy") y detiene el latido. Lo llama el apagado. */
  function cerrar() {
    clearInterval(latido);
    for (const ws of wss.clients) ws.close(1001, 'servidor apagándose');
    wss.close();
  }

  return { difundir, clientes: () => wss.clients.size, cerrar };
}

/** Envía un objeto como JSON si el socket sigue abierto. */
function enviar(ws, mensaje) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(mensaje));
}

/**
 * Responde un upgrade rechazado con una respuesta HTTP mínima y cierra el socket.
 * @param {import('node:net').Socket} socket
 * @param {string} estado p. ej. '401 Unauthorized'
 */
function rechazar(socket, estado) {
  socket.write(`HTTP/1.1 ${estado}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  socket.destroy();
}

/**
 * Convierte filas escritas por el loteador en un mensaje por motor, con la última lectura de cada variable.
 * @param {Array<[number, number, Date, number, number]>} filas [motor_id, variable_id, ts, valor, calidad]
 * @param {{motorPorId: Function, variablePorId: Function}} catalogo búsquedas por id (catalogo.js)
 * @returns {Array<{tipo: 'lecturas', motor: string, sitio_id: number, lecturas: object[]}>}
 */
export function lecturasAMensajes(filas, catalogo) {
  const porMotor = new Map(); // motor_id → Map(variable_id → fila más nueva)
  for (const fila of filas) {
    const [motorId, variableId, ts] = fila;
    const variables = porMotor.get(motorId) ?? new Map();
    const previa = variables.get(variableId);
    if (!previa || previa[2] < ts) variables.set(variableId, fila); // el dashboard muestra lo último
    porMotor.set(motorId, variables);
  }
  const mensajes = [];
  for (const [motorId, variables] of porMotor) {
    const motor = catalogo.motorPorId(motorId);
    if (!motor) continue; // dado de baja entre la escritura y el aviso
    const lecturas = [...variables.values()].map(([, variableId, ts, valor, calidad]) => {
      const v = catalogo.variablePorId(variableId);
      return { variable: v?.codigo, unidad: v?.unidad, ts, valor, calidad };
    });
    mensajes.push({ tipo: 'lecturas', motor: motor.codigo, sitio_id: motor.sitio_id, lecturas });
  }
  return mensajes;
}
