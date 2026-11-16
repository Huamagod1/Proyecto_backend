/**
 * log.js · logs estructurados: una línea JSON por evento (Fase 14).
 * Lo usan la API y el gateway. Cada línea lleva ts, nivel, evento y los datos del caso:
 *   {"ts":"2026-11-16T13:20:00.000Z","nivel":"aviso","evento":"motor_en_silencio","motor":"MTR-01"}
 * POR QUÉ JSON: journald (Fase 13), jq o cualquier sistema de logs filtra por campo
 * (`journalctl -u telemetria-api -o cat | jq 'select(.nivel=="error")'`), y un texto libre no.
 * Nivel mínimo con LOG_NIVEL (debug, info, aviso, error); por defecto, info.
 */

const NIVELES = { debug: 10, info: 20, aviso: 30, error: 40 };
const minimo = NIVELES[process.env.LOG_NIVEL] ?? NIVELES.info;

/**
 * Escribe un evento como una línea JSON.
 * @param {'debug'|'info'|'aviso'|'error'} nivel
 * @param {string} evento nombre corto y estable en snake_case: se busca por él, no se traduce
 * @param {Record<string, unknown>} [datos] campos del caso; un Error se convierte en mensaje y pila
 */
function escribir(nivel, evento, datos = {}) {
  if (NIVELES[nivel] < minimo) return;
  const registro = { ts: new Date().toISOString(), nivel, evento };
  for (const [clave, valor] of Object.entries(datos)) {
    // OJO: JSON.stringify de un Error da {}: se copian a mano el mensaje, el código y la pila.
    registro[clave] = valor instanceof Error ? { mensaje: valor.message, codigo: valor.code, pila: valor.stack } : valor;
  }
  // Los errores van a stderr y el resto a stdout: journald y Docker los separan por prioridad.
  (nivel === 'error' ? process.stderr : process.stdout).write(`${JSON.stringify(registro)}\n`);
}

export const log = {
  debug: (evento, datos) => escribir('debug', evento, datos),
  info: (evento, datos) => escribir('info', evento, datos),
  aviso: (evento, datos) => escribir('aviso', evento, datos),
  error: (evento, datos) => escribir('error', evento, datos),
};
