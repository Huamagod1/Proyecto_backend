/**
 * ayudas.js · utilidades compartidas por las pruebas (Fase 4).
 * No es un archivo de pruebas: `npm test` solo ejecuta test/*.test.js.
 */
import { firmarToken } from '../src/api/auth.js';

// Ids de sitio que deja 002_datos_iniciales.sql en una base recién creada.
export const NORTE = 1;
export const SUR = 2;

/**
 * Firma un token de prueba sin pasar por el login (no necesita el usuario en la base).
 * @param {string} rol 'admin', 'ingeniero', 'lector' o 'gateway'
 * @param {number|null} [sitio] id del sitio; null para el admin
 * @param {number} [id] id ficticio del usuario (va a la auditoría)
 * @returns {string} JWT válido por 15 minutos
 */
export function tokenDe(rol, sitio = null, id = 900) {
  return firmarToken({ id, usuario: `prueba-${rol}`, rol, sitio_id: sitio });
}

/**
 * Encabezado de autorización para supertest: .set(conToken(t)).
 * @param {string} token
 * @returns {{Authorization: string}}
 */
export const conToken = (token) => ({ Authorization: `Bearer ${token}` });
