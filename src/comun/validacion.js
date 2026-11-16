/**
 * validacion.js · validación de entradas con zod (fases 3 y 5).
 * validar() convierte un fallo de zod en ErrorHttp 422. Desde la Fase 5 también define la forma
 * de una lectura y evaluarLectura(), la regla que decide si una lectura se guarda. La usan la
 * ingesta HTTP (rutas/lecturas.js) y la ingesta MQTT (Fase 6).
 * Todo aquí son funciones puras: mismas entradas, misma salida, sin base ni red. Fáciles de probar.
 */
import { z } from './zod.js';
import { ErrorHttp } from './errores.js';

/**
 * Valida datos contra un esquema de zod.
 * @template T
 * @param {z.ZodType<T>} esquema reglas que deben cumplir los datos
 * @param {unknown} datos lo que mandó el cliente (body, params o query)
 * @returns {T} los datos validados, ya convertidos (por ejemplo, texto a número con z.coerce)
 * @throws {ErrorHttp} 422 con los errores por campo: { codigo: ['debe ser MTR- y ...'] }
 */
export function validar(esquema, datos) {
  // safeParse no lanza: devuelve { success, data } o { success: false, error }.
  const resultado = esquema.safeParse(datos);
  if (!resultado.success) {
    // z.flattenError agrupa los problemas por campo: fácil de mostrar junto a cada input.
    throw new ErrorHttp(422, 'Datos inválidos', z.flattenError(resultado.error).fieldErrors);
  }
  return resultado.data;
}

// ── Lecturas (Fase 5) ───────────────────────────────────────────────────────────────────────

/** Forma de una lectura: { motor: 'MTR-01', variable: 'rpm', ts: '2026-11-15T10:00:00Z', valor: 1500 } */
export const esquemaLectura = z.object({
  motor: z.string().min(1).max(20),
  variable: z.string().min(1).max(40),
  // ISO 8601 con zona obligatoria (Z o -03:00). POR QUÉ: "2026-11-15T10:00:00" sin zona es ambiguo.
  ts: z.iso.datetime({ offset: true }),
  valor: z.number(), // en zod 4, z.number() ya rechaza NaN e Infinity
});

/** Un lote: de 1 a 1000 lecturas. El tope evita que un solo POST acapare la base. */
export const esquemaLote = z.object({
  lecturas: z.array(esquemaLectura).min(1).max(1000),
});

const CINCO_MIN_MS = 5 * 60 * 1000;          // 5 min en ms: tolerancia a relojes de terreno adelantados
const TREINTA_DIAS_MS = 30 * 24 * 3600 * 1000; // 30 días en ms: más antiguo es un reloj sin hora o un error

/**
 * Decide si una lectura con forma válida se guarda, y cómo.
 * Los controles van en orden: motor, sitio, variable y hora. El rango no rechaza: marca la calidad.
 * @param {{motor: string, variable: string, ts: string, valor: number}} lectura ya validada por forma
 * @param {{motor: Function, variable: Function}} catalogo búsquedas por código (catalogo.js)
 * @param {{rol: string, sitio: number|null}} usuario quien envía: req.usuario, o el gateway de MQTT
 * @param {Date} ahora la hora de referencia; parámetro para que las pruebas no dependan del reloj
 * @returns {{ok: true, fila: [number, number, Date, number, number]} | {ok: false, motivo: string}}
 *   fila = [motor_id, variable_id, ts, valor, calidad], lista para el INSERT
 */
export function evaluarLectura(lectura, catalogo, usuario, ahora) {
  const motor = catalogo.motor(lectura.motor);
  if (!motor) return { ok: false, motivo: 'motor_desconocido' };

  // Misma regla que puedeVerSitio (auth.js): el admin todo, el resto solo su sitio. Va escrita aquí
  // para que esta función siga pura y no dependa de la configuración del JWT.
  if (usuario.rol !== 'admin' && usuario.sitio !== motor.sitio_id) {
    return { ok: false, motivo: 'motor_de_otro_sitio' };
  }

  const variable = catalogo.variable(lectura.variable);
  if (!variable) return { ok: false, motivo: 'variable_desconocida' };

  const ts = new Date(lectura.ts);
  if (ts.getTime() - ahora.getTime() > CINCO_MIN_MS) return { ok: false, motivo: 'hora_en_el_futuro' };
  if (ahora.getTime() - ts.getTime() > TREINTA_DIAS_MS) return { ok: false, motivo: 'hora_demasiado_antigua' };

  // POR QUÉ no se rechaza fuera de rango: un sensor que marca 160 °C puede ser una falla real del
  // motor; borrar ese dato escondería justo lo que importa. Se guarda con calidad = 1.
  const calidad = lectura.valor < variable.minimo || lectura.valor > variable.maximo ? 1 : 0;
  return { ok: true, fila: [motor.id, variable.id, ts, lectura.valor, calidad] };
}
