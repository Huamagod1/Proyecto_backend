# Fase 11 · SQL con volumen: millones de filas

## Mapa
- `npm run volumen` carga 2,4 millones de lecturas en 21 s (lotes de 5.000, en orden de PK).
- Línea base con `EXPLAIN ANALYZE` de tres consultas: A (serie), B (promedio por hora) y C (fuera de rango).
- `sql/004_rendimiento.sql`: índice `(calidad, ts)`, tabla `lecturas_hora`, evento horario y permiso de lectura.
- Particiones por mes, `DELETE` contra `DROP PARTITION`, `OFFSET` contra cursor y slow query log; todo medido en `docs/rendimiento.md`.

## Conceptos
- **EXPLAIN y EXPLAIN ANALYZE:** el plan estimado y el plan ejecutado, con tiempos y filas reales.
- **type, key, rows:** cómo lee (const, ref, range, index, ALL), con qué índice y cuántas filas estima.
- **Full scan:** recorrer la tabla entera; con millones de filas, la causa típica de una consulta lenta.
- **Índice compuesto:** sirve de izquierda a derecha; primero las igualdades y después el rango u orden.
- **Agregado precalculado:** se calcula una vez y se lee muchas; cambia frescura por velocidad.
- **Partición y poda:** un archivo por mes; la consulta solo abre los que toca su rango.
- **Paginación por clave:** "los 50 siguientes al último que viste"; costo constante.
- **Slow query log:** el registro de las consultas que superan `long_query_time`.

## Decisiones
- No tocar A → ya usaba la PK; un índice extra solo encarece los INSERT.
- `(calidad, ts)` y no `(ts, calidad)` → igualdad primero, orden después.
- Promedio ponderado por `n` sobre `lecturas_hora` → el promedio de promedios engaña.
- El evento recalcula las 2 últimas horas → entran lecturas atrasadas de un buffer.
- `DELETE` y paginación medidos sobre copias → los datos reales y la auditoría no se ensucian.
- Cursor `?antesDe=` en `/api/auditoria` → reemplaza a `?pagina=` (desvío: el parámetro cambió de nombre).

## Comandos para saber de memoria
```sql
EXPLAIN ANALYZE SELECT ...;
SHOW INDEX FROM lecturas;
SELECT PARTITION_NAME, TABLE_ROWS FROM information_schema.PARTITIONS WHERE TABLE_NAME = 'lecturas';
ALTER TABLE lecturas DROP PARTITION p2026_10;
SET GLOBAL long_query_time = 1;  SELECT @@slow_query_log_file;
```

## Preguntas de entrevista
- **Una consulta se puso lenta con millones de filas, ¿qué haces?** Primero mido, con el slow query log y `EXPLAIN ANALYZE`. Después, un índice que calce con el `WHERE` y el `ORDER BY`, agregados precalculados para los dashboards, particiones para borrar datos viejos sin bloquear, y vuelvo a medir. Aquí bajé B de 268 a 1,2 ms y C de 330 a 0,5 ms.
- **¿Cuándo un agregado y cuándo una partición?** El agregado acelera lecturas repetidas de resúmenes; la partición acelera el mantenimiento (borrar meses) y las consultas por rango de fechas. Resuelven problemas distintos y conviven.
- **¿Por qué no OFFSET?** Porque recorre y descarta todo lo anterior: la página 4000 leyó 200.000 filas. Con un cursor lee siempre 50.

## Ejercicios a mano
1. Escribe de memoria el promedio por hora sobre `lecturas_hora`.
2. Crea un índice para "las últimas lecturas de un sitio" y mide antes y después.
