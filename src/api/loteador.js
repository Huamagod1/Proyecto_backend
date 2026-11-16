/**
 * loteador.js · junta filas en memoria y las escribe por lotes (Fase 6).
 * La ingesta MQTT le agrega filas mensaje a mensaje; el loteador llama a `escribir` (guardarLote
 * de repositorio.js) con hasta `maxFilas` filas a la vez. server.js lo detiene al apagar.
 * CONCEPTO: el camión de la basura no pasa por cada bolsa: pasa cuando el contenedor se llena
 * (maxFilas) o cada cierto tiempo (intervaloMs). Mil INSERT de una fila cuestan mucho más que uno
 * de mil filas: cada viaje a la base tiene un costo fijo de red, parseo y commit.
 */

/**
 * Crea un loteador.
 * @param {object} opciones
 * @param {(filas: Array) => Promise<unknown>} opciones.escribir guarda un lote; si lanza, el lote se reintenta
 * @param {number} [opciones.maxFilas] filas por escritura; al juntar esta cantidad se escribe sin esperar
 * @param {number} [opciones.intervaloMs] ms entre escrituras aunque no se llene el lote
 * @param {number} [opciones.maxEnMemoria] tope de filas pendientes; sobre él se descartan las más antiguas
 * @param {(lote: Array, resultado: unknown) => void} [opciones.alEscribir] aviso tras cada escritura confirmada
 * @returns {{agregar: (filas: Array) => void, vaciar: () => Promise<void>, detener: () => Promise<number>, estadisticas: () => object}}
 * Efecto: deja un temporizador cada `intervaloMs`; detener() lo quita.
 */
export function crearLoteador({ escribir, maxFilas = 500, intervaloMs = 1000, maxEnMemoria = 50_000, alEscribir = () => {} }) {
  let cola = [];                 // filas pendientes, en orden de llegada
  let escrituraEnCurso = null;   // la promesa de la escritura activa, o null
  const totales = { escritas: 0, lotes: 0, fallos: 0, descartadas: 0 };

  // Cada intervaloMs escribe lo que haya. unref(): el temporizador no mantiene vivo el proceso.
  const temporizador = setInterval(() => void vaciar(), intervaloMs);
  temporizador.unref();

  /** Aplica el tope de memoria: descarta las más antiguas y las cuenta. */
  function recortar() {
    const exceso = cola.length - maxEnMemoria;
    if (exceso > 0) {
      cola.splice(0, exceso); // las primeras son las más antiguas
      totales.descartadas += exceso;
    }
  }

  /**
   * Agrega filas a la cola. Si se juntan maxFilas, dispara una escritura sin esperarla.
   * @param {Array} filas filas listas para escribir
   */
  function agregar(filas) {
    for (const fila of filas) cola.push(fila); // OJO: push(...filas) con arreglos enormes desborda la pila
    recortar();
    if (cola.length >= maxFilas) void vaciar();
  }

  /**
   * Escribe todo lo pendiente, de a maxFilas, hasta vaciar la cola o hasta el primer fallo.
   * @returns {Promise<void>} se resuelve cuando termina; si ya había una escritura, devuelve esa misma
   */
  function vaciar() {
    // POR QUÉ una escritura a la vez: dos escrituras en paralelo podrían guardar fuera de orden y
    // duplicar la carga sobre la base justo cuando está lenta.
    if (escrituraEnCurso) return escrituraEnCurso;
    if (cola.length === 0) return Promise.resolve();

    escrituraEnCurso = (async () => {
      try {
        while (cola.length > 0) {
          // El lote SALE de la cola antes de escribir: si llegan filas durante la escritura, o si el
          // tope descarta antiguas, no se mezclan con las que están en vuelo.
          const lote = cola.splice(0, maxFilas);
          try {
            const resultado = await escribir(lote);
            totales.escritas += lote.length;
            totales.lotes += 1;
            alEscribir(lote, resultado);
          } catch (err) {
            // La base falló: el lote vuelve AL FRENTE de la cola, en su orden, y se reintenta en el
            // próximo ciclo del temporizador. Si la cola supera el tope, se pierden las más antiguas.
            totales.fallos += 1;
            cola = lote.concat(cola);
            recortar();
            console.error(`loteador: no pude escribir ${lote.length} filas (${err.message}); reintento en ${intervaloMs} ms`);
            return; // sin reintento inmediato: si la base está caída, no se la martilla
          }
        }
      } finally {
        escrituraEnCurso = null;
      }
    })();
    return escrituraEnCurso;
  }

  /**
   * Detiene el temporizador y escribe lo pendiente (un intento).
   * @returns {Promise<number>} filas que quedaron sin escribir (0 si todo se guardó)
   */
  async function detener() {
    clearInterval(temporizador);
    await vaciar();
    if (cola.length > 0) console.error(`loteador: quedaron ${cola.length} filas sin escribir al apagar`);
    return cola.length;
  }

  /** Números para el monitoreo (Fase 14): pendientes, escritas, lotes, fallos y descartadas. */
  const estadisticas = () => ({ pendientes: cola.length, ...totales });

  return { agregar, vaciar, detener, estadisticas };
}
