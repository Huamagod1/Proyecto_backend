// funcion-decodificar.js · cuerpo del nodo function "Decodificar registros" del flujo de Node-RED (Fase 10).
// Recibe los 8 holding registers de MTR-02 que entrega el nodo modbus-getter y arma el mismo JSON
// que publica el gateway en código (docs/topicos.md), con gateway: 'node-red'.
// Es la misma lógica que src/comun/decodificacion.js, en una sola pieza, porque un nodo function no
// puede importar módulos del proyecto. Se pega tal cual en el nodo; desplegar-nodered.js la inyecta sola.
// Variables que da Node-RED: msg (el mensaje), node (para avisos en el panel de depuración).

// msg.payload: los registros leídos con la función 03 desde la dirección 0 (40001).
const r = msg.payload;
const SIN_DATO = 0x7fff; // "sin dato" en un registro simple (sensor cortado): se omite, no se inventa

if (!Array.isArray(r) || r.length < 8) {
  node.warn(`se esperaban 8 registros y llegaron ${Array.isArray(r) ? r.length : typeof r}`);
  return null; // return null: el mensaje no sigue al nodo MQTT
}

// Complemento a dos en 16 bits: de 0x8000 en adelante el registro es negativo (65486 → −50).
const aInt16 = (x) => (x >= 0x8000 ? x - 0x10000 : x);

const lecturas = {};
// Un registro simple: si no es SIN_DATO, se convierte y se guarda con el nombre de la variable.
const simple = (nombre, registro, convertir) => {
  if (registro !== SIN_DATO) lecturas[nombre] = convertir(registro);
};

simple('rpm', r[0], (x) => x);
simple('temp_refrigerante', r[1], (x) => aInt16(x) / 10); // ×0,1 °C y con signo
simple('presion_aceite', r[2], (x) => x);                 // kPa
simple('voltaje_bateria', r[3], (x) => x / 100);          // ×0,01 V
simple('carga', r[4], (x) => x);                          // %

// horas_motor: float32 en los registros 5 y 6 con las palabras invertidas (CDAB): el 6 lleva la
// palabra alta. Buffer está disponible en los nodos function.
const b = Buffer.alloc(4);
b.writeUInt16BE(r[6], 0);
b.writeUInt16BE(r[5], 2);
const horas = b.readFloatBE(0);
if (!Number.isNaN(horas)) lecturas.horas_motor = Math.round(horas * 100) / 100;

simple('alarmas', r[7], (x) => x); // 16 bits, uno por alarma

// El nodo mqtt out convierte el objeto en JSON al publicar.
msg.payload = { motor: 'MTR-02', gateway: 'node-red', ts: new Date().toISOString(), lecturas };
return msg;
