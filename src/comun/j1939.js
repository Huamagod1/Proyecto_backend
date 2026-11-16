/**
 * j1939.js · decodifica tramas CAN J1939 de la ECU de un motor (Fase 8).
 * Lo usa src/scripts/can-a-mqtt.js para pasar un log de candump a mensajes MQTT, con el mismo
 * formato que el gateway Modbus. La teoría está en docs/j1939.md.
 * CONCEPTO: CAN es una sala donde todos hablan fuerte: la ECU anuncia sus datos sin que nadie le
 * pregunte (al revés que Modbus, donde el maestro pregunta). J1939 es el diccionario: el PGN dice
 * qué mensaje es, y cada SPN, qué variable va dentro, en qué bytes y con qué escala.
 * Funciones puras: se prueban en test/j1939.test.js.
 */

/** PGN conocidos: 61444 = EEC1 (Electronic Engine Controller 1), 65262 = ET1 (Engine Temperature 1). */
export const PGN = { EEC1: 61444, ET1: 65262 };

/**
 * Desarma el identificador CAN extendido de 29 bits.
 * Bits, del más alto al más bajo: prioridad (3) · reservado/EDP (1) · página de datos DP (1) ·
 * PF (8) · PS (8) · dirección de origen SA (8).
 * @param {number} id identificador de 29 bits, p. ej. 0x0CF00400
 * @returns {{prioridad: number, pgn: number, destino: number|null, origen: number}}
 *   destino: null si el mensaje es para todos (PDU2)
 */
export function desarmarId(id) {
  // >>> corre los bits a la derecha (sin signo) y & 0xFF se queda con los 8 de abajo.
  const prioridad = (id >>> 26) & 0x7;  // 0 = más urgente; los datos de motor suelen ir en 3 o 6
  const edp = (id >>> 25) & 0x1;        // extended data page (reservado en J1939 clásico)
  const dp = (id >>> 24) & 0x1;         // data page
  const pf = (id >>> 16) & 0xff;        // PDU format
  const ps = (id >>> 8) & 0xff;         // PDU specific: destino o extensión del grupo, según PF
  const origen = id & 0xff;             // SA: dirección de quien habla (0 = motor 1)

  // CONCEPTO: PDU1 y PDU2. Con PF < 240 (PDU1) el mensaje va dirigido a alguien: PS es su dirección
  // y NO forma parte del PGN. Con PF >= 240 (PDU2) es para todos y PS completa el número del PGN.
  const esPdu2 = pf >= 240;
  const pgn = (edp << 17) | (dp << 16) | (pf << 8) | (esPdu2 ? ps : 0);
  return { prioridad, pgn, destino: esPdu2 ? null : ps, origen };
}

/**
 * EEC1 (PGN 61444): velocidad del motor, SPN 190, en los bytes 4 y 5 (índices 3 y 4).
 * @param {Buffer} datos los 8 bytes de la trama
 * @returns {{rpm: number|null}} null si el valor no está disponible
 */
export function decodificarEEC1(datos) {
  // OJO: J1939 es little-endian, el byte BAJO va primero. E0 2E → 0x2EE0 = 12 000.
  const crudo = datos[3] | (datos[4] << 8);
  // En parámetros de 2 bytes, 0xFE00–0xFEFF indica error y 0xFF00–0xFFFF "no disponible".
  if (crudo >= 0xfe00) return { rpm: null };
  return { rpm: crudo * 0.125 }; // 0,125 rpm por bit: 12 000 × 0,125 = 1500 rpm
}

/**
 * ET1 (PGN 65262): temperatura del refrigerante, SPN 110, en el byte 1 (índice 0).
 * @param {Buffer} datos los 8 bytes de la trama
 * @returns {{temp_refrigerante: number|null}} en °C; null si no está disponible
 */
export function decodificarET1(datos) {
  const crudo = datos[0];
  if (crudo >= 0xfe) return { temp_refrigerante: null }; // 0xFE error, 0xFF no disponible
  return { temp_refrigerante: crudo - 40 }; // 1 °C por bit con desplazamiento −40: 0x7D = 125 → 85 °C
}

/**
 * Lee una línea de `candump -L` (formato de log de can-utils).
 * @param {string} linea p. ej. '(1794744000.123456) can0 0CF00400#F07D7DE02EFFFFFF'
 * @returns {{ts: Date, interfaz: string, id: number, datos: Buffer} | null} null si la línea no es una trama
 */
export function parsearLineaCandump(linea) {
  // (segundos.microsegundos) interfaz ID_hex#DATOS_hex
  const m = /^\((\d+)\.(\d+)\)\s+(\S+)\s+([0-9A-Fa-f]{3,8})#([0-9A-Fa-f]{0,16})\s*$/.exec(linea.trim());
  if (!m) return null;
  const [, seg, fraccion, interfaz, idHex, datosHex] = m;
  // Milisegundos: segundos × 1000 + los 3 primeros dígitos de la fracción.
  const ms = Number(seg) * 1000 + Number(fraccion.padEnd(3, '0').slice(0, 3));
  return { ts: new Date(ms), interfaz, id: parseInt(idHex, 16), datos: Buffer.from(datosHex, 'hex') };
}

/**
 * Decodifica una trama según su PGN.
 * @param {number} id identificador de 29 bits
 * @param {Buffer} datos los bytes de la trama
 * @returns {{pgn: number, lecturas: Record<string, number|null>}} lecturas vacías si el PGN no se conoce
 */
export function decodificarTrama(id, datos) {
  const { pgn } = desarmarId(id);
  if (pgn === PGN.EEC1) return { pgn, lecturas: decodificarEEC1(datos) };
  if (pgn === PGN.ET1) return { pgn, lecturas: decodificarET1(datos) };
  return { pgn, lecturas: {} }; // un bus real lleva decenas de PGN; se ignoran los que no se usan
}
