/**
 * catalogo.js · motores, variables y sitios en memoria, refrescados cada 60 s (Fase 5).
 * Lo leen la ingesta HTTP (rutas/lecturas.js) y, desde la Fase 6, la ingesta MQTT, para validar
 * cada lectura sin consultar MySQL por cada dato. Las rutas de motores lo recargan al escribir.
 * CONCEPTO: caché. Como la lista de equipos impresa en la sala de control: se consulta al
 * instante y se actualiza cada cierto tiempo, en vez de llamar a la oficina por cada dato.
 */
import { pool } from './db.js';

// El catálogo vigente. Se reemplaza entero en cada carga: quien lo lee nunca ve un Map a medio llenar.
let actual = { motores: new Map(), variables: new Map(), sitios: new Map(), cargadoEn: null };
let cargaEnCurso = null;
let temporizador = null;

/**
 * Lee motores activos, variables y sitios desde MySQL y reemplaza el catálogo.
 * @returns {Promise<void>}
 * Efecto: tres SELECT en MySQL. Si llegan dos llamadas juntas, comparten la misma carga.
 */
export function cargarCatalogo() {
  cargaEnCurso ??= (async () => {
    // Solo motores activos: uno dado de baja ya no recibe lecturas (motor_desconocido).
    const [motores] = await pool.query(
      `SELECT m.id, m.codigo, m.sitio_id, s.codigo AS sitio
       FROM motores m JOIN sitios s ON s.id = m.sitio_id
       WHERE m.activo = TRUE`,
    );
    const [variables] = await pool.query('SELECT id, codigo, unidad, minimo, maximo FROM variables');
    const [sitios] = await pool.query('SELECT id, codigo FROM sitios');
    actual = {
      motores: new Map(motores.map((m) => [m.codigo, m])),     // 'MTR-01' → { id, sitio_id, ... }
      variables: new Map(variables.map((v) => [v.codigo, v])), // 'rpm' → { id, minimo, maximo, ... }
      sitios: new Map(sitios.map((s) => [s.codigo, s])),       // 'norte' → { id, codigo }
      cargadoEn: new Date(),
    };
  })().finally(() => {
    cargaEnCurso = null; // la próxima llamada vuelve a leer la base
  });
  return cargaEnCurso;
}

/**
 * Garantiza que el catálogo se cargó al menos una vez.
 * @returns {Promise<typeof catalogo>} el catálogo, listo para consultar
 */
export async function catalogoListo() {
  if (!actual.cargadoEn) await cargarCatalogo();
  return catalogo;
}

/** Consultas al catálogo vigente, por código. Devuelven undefined si no existe. */
export const catalogo = {
  motor: (codigo) => actual.motores.get(codigo),
  variable: (codigo) => actual.variables.get(codigo),
  sitio: (codigo) => actual.sitios.get(codigo),
};

/**
 * Recarga el catálogo cada `ms` milisegundos.
 * @param {number} [ms] 60 000 ms = 60 s: un motor nuevo tarda como máximo eso en aceptar lecturas
 * Efecto: deja un temporizador; detenerRefresco() lo quita.
 */
export function iniciarRefresco(ms = 60_000) {
  detenerRefresco();
  temporizador = setInterval(() => {
    // Si MySQL falla, se conserva el catálogo anterior y se reintenta en el próximo ciclo.
    cargarCatalogo().catch((err) => console.error('catálogo: no pude refrescar:', err.message));
  }, ms);
  temporizador.unref(); // unref(): el temporizador no impide que el proceso termine
}

/** Detiene el refresco periódico. Lo llama el apagado ordenado. */
export function detenerRefresco() {
  clearInterval(temporizador);
  temporizador = null;
}
