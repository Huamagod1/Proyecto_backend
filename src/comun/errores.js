/**
 * errores.js · errores HTTP esperados de la API (Fase 3).
 * Las rutas lanzan ErrorHttp (404, 409, 422...) y el middleware de errores de app.js lo convierte
 * en la respuesta JSON. Cualquier otro error es inesperado y sale como 500, sin detalles internos.
 */

/** Error que la API espera y sabe responder: lleva el estado HTTP y un mensaje para el cliente. */
export class ErrorHttp extends Error {
  /**
   * @param {number} estado código HTTP: 404, 409, 422...
   * @param {string} mensaje texto para el cliente, sin detalles internos
   * @param {unknown} [detalle] información extra para el cliente, por ejemplo los campos inválidos
   */
  constructor(estado, mensaje, detalle) {
    super(mensaje);
    this.name = 'ErrorHttp';
    this.estado = estado;
    this.detalle = detalle;
  }
}
