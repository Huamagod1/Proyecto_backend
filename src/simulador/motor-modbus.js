/**
 * motor-modbus.js · simula dos controladores de motor con Modbus TCP (Fase 7).
 * Un ServerTCP de modbus-serial en el puerto 5020: el Unit ID 1 es MTR-01 y el 2 es MTR-02, con 8
 * holding registers cada uno (mapa en src/comun/decodificacion.js). Cada segundo avanza un modelo
 * simple del motor. Lo lee src/gateway/gateway.js y, en la Fase 10, Node-RED.
 * Teclas (en una terminal interactiva): 1 o 2 elige el motor · t sobretemperatura ·
 * f sensor de temperatura cortado (0x7FFF) · d detener o arrancar · q salir.
 * Uso: npm run simulador
 */
import ModbusRTU from 'modbus-serial';
import { armarRegistros, alarmasActivas } from '../comun/decodificacion.js';

// 0.0.0.0: escucha en todas las interfaces (en Docker, la red del contenedor; Fase 10).
const HOST = process.env.SIMULADOR_HOST ?? '0.0.0.0';
// 5020 y no 502: el 502 estándar es un puerto privilegiado (< 1024) en Linux y pediría root.
const PUERTO = Number(process.env.SIMULADOR_PUERTO ?? 5020);

/** Estado inicial de un motor en marcha. Unidades: rpm, °C, kPa, V, %, h. */
const nuevoMotor = (codigo, horas) => ({
  codigo, encendido: true, sobretemp: false, sensorCortado: false,
  rpm: 1500, temp: 82, presion: 420, voltaje: 26.8, carga: 60, horas, alarmas: 0,
});

// Unit ID → motor. CONCEPTO: el Unit ID es "el número de lista" de cada equipo en el bus.
const motores = new Map([
  [1, nuevoMotor('MTR-01', 12_345.6)],
  [2, nuevoMotor('MTR-02', 8_765.4)],
]);

const ruido = (amplitud) => (Math.random() * 2 - 1) * amplitud; // valor al azar en ±amplitud
const acotar = (x, min, max) => Math.min(max, Math.max(min, x));

/**
 * Avanza un segundo el modelo del motor.
 * @param {ReturnType<typeof nuevoMotor>} m el motor (se modifica)
 */
function avanzar(m) {
  if (m.encendido) {
    m.carga = acotar(m.carga + ruido(2), 30, 95);   // la carga deriva despacio
    m.rpm = 1500 + ruido(6);                        // un generador a 50 Hz gira fijo cerca de 1500 rpm
    m.presion = 380 + m.carga * 0.8 + ruido(5);     // más carga, más presión de aceite
    m.voltaje = 26.8 + ruido(0.05);                 // alternador cargando una batería de 24 V
    m.horas += 1 / 3600;                            // 1 s = 1/3600 h
  } else {
    m.rpm *= 0.5;                                   // se detiene en pocos segundos
    m.presion *= 0.5;
    m.carga = 0;
    m.voltaje = 24.6 + ruido(0.05);                 // batería sin carga
  }
  // La temperatura se acerca a su objetivo de a poco (inercia térmica): 8 % de la diferencia por segundo.
  const objetivo = (m.encendido ? 70 + m.carga * 0.2 : 25) + (m.sobretemp ? 45 : 0);
  m.temp += (objetivo - m.temp) * 0.08 + ruido(0.1);
  // Palabra de alarmas: bit 0 sobretemperatura (> 105 °C), bit 1 baja presión, bit 5 falla de sensor.
  m.alarmas = (m.temp > 105 ? 1 : 0) | (m.encendido && m.presion < 150 ? 1 << 1 : 0) | (m.sensorCortado ? 1 << 5 : 0);
}

/** Los 8 registros actuales de un motor. */
const registrosDe = (m) =>
  armarRegistros(
    { rpm: m.rpm, temp_refrigerante: m.temp, presion_aceite: m.presion, voltaje_bateria: m.voltaje, carga: m.carga, horas_motor: m.horas, alarmas: m.alarmas },
    m.sensorCortado ? ['temp_refrigerante'] : [], // sensor cortado: el registro 1 vale 0x7FFF
  );

// El "vector" le dice a ServerTCP de dónde sacar cada dato. Solo hay holding registers (función 03).
const vector = {
  /**
   * Lectura de varios holding registers.
   * @param {number} direccion primera dirección (0 = 40001)
   * @param {number} cantidad cuántos registros
   * @param {number} unitId el equipo al que se le pregunta
   * @returns {number[]}
   * @throws excepción Modbus 0x0B (equipo no responde) o 0x02 (dirección inválida)
   */
  getMultipleHoldingRegisters(direccion, cantidad, unitId) {
    const motor = motores.get(unitId);
    // modbusErrorCode: ServerTCP lo devuelve como excepción Modbus en vez de un error genérico.
    if (!motor) throw Object.assign(new Error(`Unit ID ${unitId} no existe`), { modbusErrorCode: 0x0b });
    const registros = registrosDe(motor);
    if (direccion + cantidad > registros.length) {
      throw Object.assign(new Error('dirección fuera del mapa'), { modbusErrorCode: 0x02 });
    }
    return registros.slice(direccion, direccion + cantidad);
  },
  /** Lectura de un solo registro: reutiliza la anterior. */
  getHoldingRegister(direccion, unitId) {
    return vector.getMultipleHoldingRegisters(direccion, 1, unitId)[0];
  },
};

// unitID: 255 = responde a cualquier Unit ID; el vector decide si existe.
const servidor = new ModbusRTU.ServerTCP(vector, { host: HOST, port: PUERTO, debug: false, unitID: 255 });
servidor.on('initialized', () => console.log(`Simulador Modbus TCP en ${HOST}:${PUERTO} · Unit 1 = MTR-01, Unit 2 = MTR-02 (PID ${process.pid})`));
servidor.on('socketError', (err) => console.error('simulador: error de socket:', err.message));

// Modelo: un paso por segundo. Cada 10 s, una línea de resumen por motor.
let segundos = 0;
setInterval(() => {
  for (const m of motores.values()) avanzar(m);
  if (++segundos % 10 === 0) {
    for (const m of motores.values()) {
      const temp = m.sensorCortado ? 'sin dato' : `${m.temp.toFixed(1)} °C`;
      const alarmas = alarmasActivas(m.alarmas).join(', ') || 'sin alarmas';
      console.log(`${m.codigo}: ${m.encendido ? 'en marcha' : 'detenido'} · ${Math.round(m.rpm)} rpm · ${temp} · ${alarmas}`);
    }
  }
}, 1000);

// Teclado: solo si hay una terminal interactiva (en Docker no la hay).
let elegido = 1;
if (process.stdin.isTTY) {
  // Modo raw: cada tecla llega al instante, sin esperar Enter. OJO: Ctrl+C ya no genera SIGINT;
  // llega como el carácter \u0003 y hay que atenderlo a mano.
  process.stdin.setRawMode(true);
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (tecla) => {
    const m = motores.get(elegido);
    if (tecla === '1' || tecla === '2') elegido = Number(tecla);
    else if (tecla === 't') m.sobretemp = !m.sobretemp;
    else if (tecla === 'f') m.sensorCortado = !m.sensorCortado;
    else if (tecla === 'd') m.encendido = !m.encendido;
    else if (tecla === 'q' || tecla === '\u0003') process.exit(0);
    const e = motores.get(elegido);
    console.log(`> ${e.codigo}: sobretemperatura ${e.sobretemp ? 'SÍ' : 'no'} · sensor cortado ${e.sensorCortado ? 'SÍ' : 'no'} · ${e.encendido ? 'en marcha' : 'detenido'}`);
  });
  console.log('Teclas: 1/2 elige motor · t sobretemperatura · f sensor cortado · d detener/arrancar · q salir');
}

// Apagado: el servidor no guarda nada, así que basta con cerrar el socket.
for (const senal of ['SIGINT', 'SIGTERM']) {
  process.on(senal, () => servidor.close(() => process.exit(0)));
}
