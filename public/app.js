/**
 * app.js · lógica del dashboard: login, foto inicial por REST y actualizaciones por WebSocket (Fase 9).
 * Flujo: POST /api/auth/login → GET /api/motores y /estado de cada uno → WebSocket /ws?token=...
 * Cada mensaje 'lecturas' actualiza la tabla de su motor; 'gateway' actualiza el estado online/offline.
 * El servidor ya filtra por sitio: aquí no se decide qué puede ver cada usuario.
 */

const $ = (selector) => document.querySelector(selector);
const SIN_DATOS_MS = 60_000; // 1 min sin datos: el motor se marca como "sin datos recientes"

// POR QUÉ sessionStorage: sobrevive a recargar la página, pero se borra al cerrar la pestaña.
// SEGURIDAD: un script inyectado podría leerlo; por eso la CSP solo permite los scripts propios y
// todo el texto se pinta con textContent, nunca con innerHTML.
let token = sessionStorage.getItem('token');
let socket = null;
let reintentoMs = 1000; // reconexión con espera creciente: 1 s, 2 s, 4 s... hasta 30 s

// ── Sesión ──────────────────────────────────────────────────────────────────────────────────

$('#form-login').addEventListener('submit', async (evento) => {
  evento.preventDefault(); // evita que el formulario recargue la página
  const datos = Object.fromEntries(new FormData(evento.target));
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  });
  const cuerpo = await res.json();
  if (!res.ok) {
    $('#error-login').textContent = cuerpo.error ?? 'No se pudo iniciar sesión';
    return;
  }
  token = cuerpo.token;
  sessionStorage.setItem('token', token);
  evento.target.reset();
  await abrirPanel();
});

$('#salir').addEventListener('click', () => cerrarSesion());

/** Vuelve al login y olvida el token. */
function cerrarSesion(mensaje = '') {
  token = null;
  sessionStorage.removeItem('token');
  socket?.close();
  socket = null;
  $('#vista-panel').hidden = true;
  $('#vista-login').hidden = false;
  $('#salir').hidden = true;
  $('#quien').textContent = '';
  $('#error-login').textContent = mensaje;
}

/**
 * GET con el token. Si la API responde 401 (token vencido), vuelve al login.
 * @param {string} ruta p. ej. '/api/motores'
 */
async function api(ruta) {
  const res = await fetch(ruta, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) {
    cerrarSesion('La sesión venció. Vuelve a entrar.');
    throw new Error('401');
  }
  return res.json();
}

// ── Panel ───────────────────────────────────────────────────────────────────────────────────

/** Carga la foto inicial por REST y abre el WebSocket para lo que venga después. */
async function abrirPanel() {
  $('#vista-login').hidden = true;
  $('#vista-panel').hidden = false;
  $('#salir').hidden = false;
  $('#motores').replaceChildren();
  $('#gateways').replaceChildren();

  const motores = await api('/api/motores'); // ya viene filtrado por el sitio del usuario
  for (const motor of motores) {
    crearTarjetaMotor(motor);
    const estado = await api(`/api/motores/${encodeURIComponent(motor.codigo)}/estado`);
    for (const lectura of estado.variables) pintarLectura(motor.codigo, lectura);
  }
  conectarSocket();
}

/** Crea la tarjeta de un motor con su tabla vacía. */
function crearTarjetaMotor(motor) {
  const tarjeta = document.createElement('article');
  tarjeta.className = 'tarjeta motor';
  tarjeta.id = `motor-${motor.codigo}`;
  const titulo = document.createElement('h3');
  titulo.textContent = `${motor.codigo} · ${motor.modelo} · sitio ${motor.sitio}`;
  const ultimo = document.createElement('p');
  ultimo.className = 'ultimo';
  ultimo.textContent = 'Sin datos todavía';
  const tabla = document.createElement('table');
  tabla.innerHTML = '<thead><tr><th>Variable</th><th>Valor</th><th>Hora (local)</th></tr></thead><tbody></tbody>'; // texto fijo, sin datos externos
  tarjeta.append(titulo, ultimo, tabla);
  $('#motores').append(tarjeta);
}

/**
 * Escribe (o actualiza) la fila de una variable en la tabla de su motor.
 * @param {string} motor código del motor
 * @param {{variable: string, unidad: string, valor: number, ts: string, calidad: number}} lectura
 */
function pintarLectura(motor, lectura) {
  const tarjeta = document.getElementById(`motor-${motor}`);
  if (!tarjeta) return;
  let fila = tarjeta.querySelector(`tr[data-variable="${CSS.escape(lectura.variable)}"]`);
  if (!fila) {
    fila = document.createElement('tr');
    fila.dataset.variable = lectura.variable;
    fila.append(document.createElement('td'), document.createElement('td'), document.createElement('td'));
    tarjeta.querySelector('tbody').append(fila);
  }
  const [celdaVariable, celdaValor, celdaHora] = fila.children;
  celdaVariable.textContent = lectura.variable;
  celdaValor.textContent = `${redondear(lectura.valor)} ${lectura.unidad ?? ''}`;
  celdaHora.textContent = new Date(lectura.ts).toLocaleTimeString(); // la base guarda UTC; aquí se ve en hora local
  fila.classList.toggle('fuera-de-rango', lectura.calidad === 1);
  // La hora del último dato del motor: la más nueva de sus variables.
  const ts = new Date(lectura.ts).getTime();
  if (!tarjeta.dataset.ultimo || ts > Number(tarjeta.dataset.ultimo)) {
    tarjeta.dataset.ultimo = String(ts);
    tarjeta.querySelector('.ultimo').textContent = `Último dato: ${new Date(ts).toLocaleString()}`;
  }
}

const redondear = (x) => (Number.isInteger(x) ? x : Number(x).toFixed(2));

/** Muestra el estado online/offline de un gateway. */
function pintarGateway({ id, sitio, estado, desde }) {
  let chip = document.getElementById(`gw-${id}`);
  if (!chip) {
    chip = document.createElement('span');
    chip.id = `gw-${id}`;
    $('#gateways').append(chip);
  }
  chip.className = `chip ${estado === 'online' ? 'online' : 'offline'}`;
  chip.textContent = `${id} (${sitio}): ${estado} desde ${new Date(desde).toLocaleTimeString()}`;
}

// Cada 5 s marca en rojo los motores sin datos en el último minuto.
setInterval(() => {
  for (const tarjeta of document.querySelectorAll('.motor')) {
    const ultimo = Number(tarjeta.dataset.ultimo ?? 0);
    tarjeta.classList.toggle('sin-datos', Date.now() - ultimo > SIN_DATOS_MS);
  }
}, 5000);

// ── WebSocket ───────────────────────────────────────────────────────────────────────────────

/** Abre el WebSocket con el token en la URL y se reconecta si se corta. */
function conectarSocket() {
  // wss:// si la página llegó por HTTPS (detrás de nginx con TLS); ws:// en desarrollo.
  const protocolo = location.protocol === 'https:' ? 'wss' : 'ws';
  socket = new WebSocket(`${protocolo}://${location.host}/ws?token=${encodeURIComponent(token)}`);

  socket.addEventListener('open', () => {
    reintentoMs = 1000;
    $('#conexion').className = 'punto conectado';
  });
  socket.addEventListener('message', (evento) => {
    const mensaje = JSON.parse(evento.data);
    if (mensaje.tipo === 'bienvenida') $('#quien').textContent = `${mensaje.usuario} (${mensaje.rol})`;
    if (mensaje.tipo === 'lecturas') for (const l of mensaje.lecturas) pintarLectura(mensaje.motor, l);
    if (mensaje.tipo === 'gateway') pintarGateway(mensaje);
    if (mensaje.tipo === 'alerta') pintarAlerta(mensaje); // Fase 14
  });
  socket.addEventListener('close', (evento) => {
    $('#conexion').className = 'punto';
    if (evento.code === 4001) return cerrarSesion('La sesión venció. Vuelve a entrar.');
    if (!token) return; // se cerró por "Salir"
    // Reconexión con espera creciente: no satura al servidor si está caído.
    setTimeout(conectarSocket, reintentoMs);
    reintentoMs = Math.min(reintentoMs * 2, 30_000);
  });
}

/** Fase 14: alerta de silencio de un sitio. */
function pintarAlerta(alerta) {
  const aviso = document.createElement('p');
  aviso.className = 'alerta';
  aviso.textContent = `${new Date(alerta.ts).toLocaleTimeString()} · ${alerta.texto}`;
  $('#alertas').prepend(aviso);
}

// Si ya había una sesión en esta pestaña, entra directo.
if (token) abrirPanel().catch(() => cerrarSesion());
