/**
 * generar-volumen.js · carga 7 días de lecturas sintéticas para medir y optimizar SQL (Fase 11).
 * 10 motores × 4 variables × 1 lectura cada 10 s × 7 días = 2.419.200 filas en `lecturas`.
 * Antes asegura que existan los motores MTR-04 a MTR-10. Es idempotente: si se corre dos veces,
 * la PK absorbe las repetidas (ver CONCEPTO idempotencia en src/api/repositorio.js).
 * Uso: npm run volumen
 * Efecto: INSERT en `motores` y en `lecturas`, con el usuario de la API.
 */
import { pool, cerrarPool } from '../api/db.js';

const DIAS = 7;
const PASO_MS = 10_000;  // 10 s entre lecturas de cada serie
const LOTE = 5_000;      // filas por INSERT: unos 250 KB de SQL, muy por debajo de max_allowed_packet (64 MB)
const VARIABLES = ['rpm', 'temp_refrigerante', 'presion_aceite', 'carga'];

// Motores nuevos y su sitio. MTR-10 ya existe desde la Fase 3: ON DUPLICATE lo deja igual.
const MOTORES_NUEVOS = [
  ['MTR-04', 'norte'], ['MTR-05', 'norte'], ['MTR-06', 'sur'], ['MTR-07', 'sur'],
  ['MTR-08', 'norte'], ['MTR-09', 'sur'], ['MTR-10', 'norte'],
];

// 1. Motores MTR-04 a MTR-10.
for (const [codigo, sitio] of MOTORES_NUEVOS) {
  await pool.execute(
    `INSERT INTO motores (codigo, modelo, sitio_id)
     VALUES (?, '16V4000', (SELECT id FROM sitios WHERE codigo = ?)) AS nuevo
     ON DUPLICATE KEY UPDATE codigo = nuevo.codigo`, // neutra: un motor que ya existe queda igual
    [codigo, sitio],
  );
}
const [motores] = await pool.query("SELECT id, codigo FROM motores WHERE codigo BETWEEN 'MTR-01' AND 'MTR-10' ORDER BY id");
const [variables] = await pool.query('SELECT id, codigo, minimo, maximo FROM variables WHERE codigo IN (?)', [VARIABLES]);
console.log(`Motores: ${motores.map((m) => m.codigo).join(', ')}`);

/**
 * Valor sintético de una variable en un instante: una curva diaria más ruido, con picos raros.
 * @param {string} variable
 * @param {number} t milisegundos desde el inicio de la carga
 * @param {number} semilla distinta por motor, para que las series no sean idénticas
 * @returns {number}
 */
function valorSintetico(variable, t, semilla) {
  const dia = Math.sin((2 * Math.PI * t) / 86_400_000 + semilla); // ciclo de 24 h entre −1 y 1
  const ruido = (amplitud) => (Math.random() * 2 - 1) * amplitud;
  switch (variable) {
    case 'rpm': return Math.round(1500 + ruido(8));
    case 'carga': return Math.round(60 + 25 * dia + ruido(3));
    case 'presion_aceite': return Math.round(400 + 30 * dia + ruido(5));
    // 1 de cada 2000 lecturas, una sobretemperatura fuera de rango (> 150 °C): datos para la consulta C.
    case 'temp_refrigerante': return Math.random() < 0.0005 ? 150 + Math.random() * 20 : Number((82 + 6 * dia + ruido(0.5)).toFixed(1));
    default: return 0;
  }
}

// 2. Lecturas, en el orden de la PK (motor → variable → ts).
// POR QUÉ ese orden: InnoDB guarda la tabla ordenada por la PK; insertar en ese mismo orden agrega al
// final de cada tramo, sin partir páginas del índice. Insertar al azar sería varias veces más lento.
const fin = Math.floor(Date.now() / PASO_MS) * PASO_MS; // alineado a la grilla de 10 s
const inicio = fin - DIAS * 86_400_000;
const totalEsperado = motores.length * variables.length * ((fin - inicio) / PASO_MS);
console.log(`Generando ${totalEsperado.toLocaleString('es-CL')} filas, de ${new Date(inicio).toISOString()} a ${new Date(fin).toISOString()}`);

const t0 = performance.now();
let lote = [];
let escritas = 0;
let nuevas = 0;

/** Escribe el lote acumulado con un solo INSERT. */
async function escribirLote() {
  // VALUES ? con pool.query: un INSERT de 5000 filas (ver OJO de query vs execute en repositorio.js).
  const [r] = await pool.query(
    'INSERT INTO lecturas (motor_id, variable_id, ts, valor, calidad) VALUES ? ON DUPLICATE KEY UPDATE valor = valor',
    [lote],
  );
  nuevas += r.affectedRows; // con -FOUND_ROWS: solo las filas nuevas
  escritas += lote.length;
  lote = [];
  if (escritas % 200_000 === 0 || escritas === totalEsperado) {
    const segundos = (performance.now() - t0) / 1000;
    console.log(`${escritas.toLocaleString('es-CL')} filas · ${Math.round(escritas / segundos).toLocaleString('es-CL')} filas/s`);
  }
}

for (const [i, motor] of motores.entries()) {
  for (const variable of variables) {
    for (let ts = inicio; ts < fin; ts += PASO_MS) {
      const valor = valorSintetico(variable.codigo, ts - inicio, i);
      const calidad = valor < variable.minimo || valor > variable.maximo ? 1 : 0;
      lote.push([motor.id, variable.id, new Date(ts), valor, calidad]);
      if (lote.length === LOTE) await escribirLote();
    }
  }
}
if (lote.length > 0) await escribirLote();

const segundos = (performance.now() - t0) / 1000;
console.log(`Listo: ${escritas.toLocaleString('es-CL')} filas en ${segundos.toFixed(1)} s (${nuevas.toLocaleString('es-CL')} nuevas).`);
await cerrarPool();
