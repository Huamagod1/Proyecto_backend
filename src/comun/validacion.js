/**
 * validacion.js · validación de entradas con zod (Fase 3; la Fase 5 agrega las lecturas).
 * Las rutas llaman a validar() con el body, los params o la query. Si algo no calza, sale un
 * ErrorHttp 422 que el middleware de errores de app.js responde con el detalle por campo.
 * POR QUÉ aquí y no en errores.js: la Fase 5 suma a este archivo las reglas de las lecturas.
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
