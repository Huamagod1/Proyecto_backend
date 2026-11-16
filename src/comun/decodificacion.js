/**
 * decodificacion.js · registros Modbus ↔ valores de ingeniería (Fase 7).
 * El gateway (src/gateway/gateway.js) decodifica los 8 holding registers de cada motor; el
 * simulador (src/simulador/motor-modbus.js) usa armarRegistros() para el camino inverso. Node-RED
 * repite esta misma lógica en flows/funcion-decodificar.js (Fase 10).
 *
 * Mapa de registros (dirección 0 = "40001" del manual):
 *   0 rpm (uint16, ×1) · 1 temp_refrigerante (int16, ×0,1 °C) · 2 presion_aceite (uint16, kPa)
 *   3 voltaje_bateria (uint16, ×0,01 V) · 4 carga (uint16, %) · 5-6 horas_motor (float32 CDAB)
 *   7 alarmas (16 bits, uno por alarma)
 * Funciones puras: sin red ni estado; se prueban en test/decodificacion.test.js.
 */

// CONCEPTO: un registro Modbus es un entero sin signo de 16 bits (0 a 65 535). Todo lo demás
// (signo, decimales, floats) es una convención del fabricante que hay que conocer por el manual.

/** 0x7FFF en un registro = "sin dato" (por ejemplo, un sensor cortado). */
export const SIN_DATO = 0x7fff;

/** Nombre de cada bit de la palabra de alarmas (registro 7), del bit 0 al 5. */
export const ALARMAS = ['sobretemperatura', 'baja_presion_aceite', 'sobrevelocidad', 'bajo_voltaje', 'parada_emergencia', 'falla_sensor'];

/**
 * Reinterpreta un registro como entero CON signo.
 * CONCEPTO: complemento a dos. En 16 bits, los valores de 0x8000 (32 768) en adelante son
 * negativos: 65 486 = 65 536 − 50 → −50.
 * @param {number} registro 0 a 65 535
 * @returns {number} −32 768 a 32 767
 */
export function aInt16(registro) {
  return registro >= 0x8000 ? registro - 0x10000 : registro;
}

/**
 * Une dos registros en un float32.
 * CONCEPTO: un float32 ocupa 4 bytes (A B C D, del más al menos significativo) repartidos en dos
 * registros. 'ABCD': el primer registro trae AB. 'CDAB' ("word swap"): el primero trae CD. Cada
 * fabricante elige uno; leerlo con el orden equivocado da números absurdos sin ningún error.
 * @param {number} r0 primer registro (dirección menor)
 * @param {number} r1 segundo registro
 * @param {'ABCD'|'CDAB'} orden orden de las palabras
 * @returns {number} el valor; NaN si el patrón es "no es un número"
 */
export function registrosAFloat(r0, r1, orden) {
  const bytes = Buffer.alloc(4); // 4 bytes = 32 bits
  const [alta, baja] = orden === 'ABCD' ? [r0, r1] : [r1, r0];
  bytes.writeUInt16BE(alta, 0); // BE (big-endian): byte más significativo primero, como Modbus
  bytes.writeUInt16BE(baja, 2);
  return bytes.readFloatBE(0);
}

/**
 * Parte un número en los dos registros de un float32. Inversa de registrosAFloat.
 * @param {number} valor
 * @param {'ABCD'|'CDAB'} orden
 * @returns {[number, number]} [registro en la dirección menor, registro siguiente]
 */
export function floatARegistros(valor, orden) {
  const bytes = Buffer.alloc(4);
  bytes.writeFloatBE(valor, 0);
  const alta = bytes.readUInt16BE(0);
  const baja = bytes.readUInt16BE(2);
  return orden === 'ABCD' ? [alta, baja] : [baja, alta];
}

/**
 * Convierte los 8 registros de un motor en lecturas, aplicando el mapa y las escalas.
 * @param {number[]} registros 8 valores leídos con la función 03 desde la dirección 0
 * @returns {{lecturas: Record<string, number>, sinDato: string[]}} sinDato: variables omitidas
 * @throws {Error} si llegan menos de 8 registros
 */
export function decodificarRegistros(registros) {
  if (registros.length < 8) throw new Error(`se esperaban 8 registros y llegaron ${registros.length}`);
  const lecturas = {};
  const sinDato = [];

  // Un registro simple: si trae 0x7FFF se anota como sin dato; si no, se convierte.
  // POR QUÉ no inventar: un 0 o el último valor conocido se confundirían con una medición real.
  const simple = (nombre, registro, convertir) => {
    if (registro === SIN_DATO) sinDato.push(nombre);
    else lecturas[nombre] = convertir(registro);
  };

  simple('rpm', registros[0], (r) => r);
  simple('temp_refrigerante', registros[1], (r) => aInt16(r) / 10); // 852 → 85,2 °C; con signo: puede bajar de 0
  simple('presion_aceite', registros[2], (r) => r);                 // kPa
  simple('voltaje_bateria', registros[3], (r) => r / 100);          // 2685 → 26,85 V
  simple('carga', registros[4], (r) => r);                          // %

  // En el float, "sin dato" es NaN: 0x7FFF podría ser parte legítima de un número.
  const horas = registrosAFloat(registros[5], registros[6], 'CDAB');
  if (Number.isNaN(horas)) sinDato.push('horas_motor');
  else lecturas.horas_motor = Math.round(horas * 100) / 100; // 2 decimales: float32 no da más precisión útil

  simple('alarmas', registros[7], (r) => r);
  return { lecturas, sinDato };
}

/**
 * Camino inverso: arma los 8 registros a partir de valores de ingeniería. Lo usa el simulador.
 * @param {{rpm: number, temp_refrigerante: number, presion_aceite: number, voltaje_bateria: number,
 *          carga: number, horas_motor: number, alarmas: number}} v valores en su unidad
 * @param {string[]} [sinDato] variables que deben ir como 0x7FFF (sensor cortado)
 * @returns {number[]} 8 registros de 16 bits
 */
export function armarRegistros(v, sinDato = []) {
  // uint16: redondea y acota a 0..65 535, que es todo lo que cabe en un registro.
  const u16 = (x) => Math.min(0xffff, Math.max(0, Math.round(x)));
  const registro = (nombre, valor) => (sinDato.includes(nombre) ? SIN_DATO : valor);
  const [h0, h1] = floatARegistros(v.horas_motor, 'CDAB');
  return [
    registro('rpm', u16(v.rpm)),
    // & 0xFFFF: deja solo 16 bits; un negativo queda en complemento a dos (−50 → 65 486).
    registro('temp_refrigerante', Math.round(v.temp_refrigerante * 10) & 0xffff),
    registro('presion_aceite', u16(v.presion_aceite)),
    registro('voltaje_bateria', u16(v.voltaje_bateria * 100)),
    registro('carga', u16(v.carga)),
    h0,
    h1,
    registro('alarmas', v.alarmas & 0xffff),
  ];
}

/**
 * Traduce la palabra de alarmas a la lista de alarmas encendidas.
 * @param {number} bits valor del registro 7
 * @returns {string[]} nombres de las alarmas activas, en orden de bit
 */
export function alarmasActivas(bits) {
  // (bits >> i) & 1: corre el bit i a la derecha y mira si quedó en 1.
  return ALARMAS.filter((_, i) => ((bits >> i) & 1) === 1);
}
