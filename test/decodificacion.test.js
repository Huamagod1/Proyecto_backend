/**
 * decodificacion.test.js · registros Modbus ↔ valores de ingeniería (Fase 7).
 * Escritas antes que el código, como pide el plan: complemento a dos, float32 en los dos órdenes,
 * el bug del orden equivocado, 0x7FFF como "sin dato" y la palabra de alarmas.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aInt16,
  registrosAFloat,
  floatARegistros,
  decodificarRegistros,
  armarRegistros,
  alarmasActivas,
  SIN_DATO,
} from '../src/comun/decodificacion.js';

test('aInt16 reinterpreta el complemento a dos', () => {
  assert.equal(aInt16(65486), -50);
  assert.equal(aInt16(852), 852);
  assert.equal(aInt16(0x8000), -32768);
  assert.equal(aInt16(0x7fff), 32767);
});

test('-5,0 °C viaja como 65486 y vuelve a -5', () => {
  const registros = armarRegistros({ rpm: 0, temp_refrigerante: -5, presion_aceite: 0, voltaje_bateria: 0, carga: 0, horas_motor: 0, alarmas: 0 });
  assert.equal(registros[1], 65486);
  assert.equal(decodificarRegistros(registros).lecturas.temp_refrigerante, -5);
});

test('un float32 hace ida y vuelta en ABCD y en CDAB', () => {
  for (const orden of ['ABCD', 'CDAB']) {
    const [r0, r1] = floatARegistros(12345.67, orden);
    // float32 guarda unos 7 dígitos significativos: 12345.67 vuelve como 12345.669921875.
    assert.ok(Math.abs(registrosAFloat(r0, r1, orden) - 12345.67) < 0.01, `orden ${orden}`);
  }
});

test('leer CDAB como si fuera ABCD da un valor absurdo (el bug clásico)', () => {
  const [r0, r1] = floatARegistros(12345.67, 'CDAB');
  const malo = registrosAFloat(r0, r1, 'ABCD');
  assert.ok(Math.abs(malo - 12345.67) > 1000, `con el orden equivocado salió ${malo}`);
});

test('decodificarRegistros aplica el mapa y las escalas', () => {
  const [h0, h1] = floatARegistros(12345.67, 'CDAB');
  const { lecturas, sinDato } = decodificarRegistros([1500, 852, 420, 2685, 64, h0, h1, 0b101]);
  assert.deepEqual(lecturas, {
    rpm: 1500,
    temp_refrigerante: 85.2,
    presion_aceite: 420,
    voltaje_bateria: 26.85,
    carga: 64,
    horas_motor: 12345.67,
    alarmas: 5,
  });
  assert.deepEqual(sinDato, []);
});

test('0x7FFF queda en sinDato y no se inventa un valor', () => {
  const [h0, h1] = floatARegistros(100, 'CDAB');
  const { lecturas, sinDato } = decodificarRegistros([1500, SIN_DATO, 420, 2685, 64, h0, h1, 0]);
  assert.deepEqual(sinDato, ['temp_refrigerante']);
  assert.equal('temp_refrigerante' in lecturas, false);
});

test('alarmasActivas traduce los bits encendidos a nombres', () => {
  assert.deepEqual(alarmasActivas(0b101), ['sobretemperatura', 'sobrevelocidad']);
  assert.deepEqual(alarmasActivas(0), []);
});
