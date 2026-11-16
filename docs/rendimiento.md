# Rendimiento con volumen (Fase 11)

**Entorno:** MySQL 8.4 en Docker Desktop (Windows 11, motor WSL 2), configuración por defecto (buffer pool de 128 MB). Medido el 2026-11-16 con `EXPLAIN ANALYZE`, tercera corrida de cada consulta (caché caliente). Las sentencias están en [practica/rendimiento.sql](../practica/rendimiento.sql).

**Datos:** `npm run volumen` cargó **2.419.200 lecturas** (10 motores × 4 variables × 1 cada 10 s × 7 días) en **21,1 s**, unas **115.000 filas/s**: lotes de 5.000 filas por `INSERT` y en el orden de la PK.

## Antes y después

| Consulta | Antes | Después | Qué cambió |
|---|---|---|---|
| **A.** Serie de rpm de MTR-01 en 24 h | 3,49 ms · rango de la PK, 8.839 filas | sin cambio | Nada: la PK `(motor, variable, ts)` ya calza con la consulta |
| **B.** Promedio por hora de rpm del sitio norte, 7 días | 268 ms · 363.300 filas | **1,23 ms** · 1.008 filas | Tabla `lecturas_hora` (agregado precalculado) |
| **C.** Últimas 50 fuera de rango del sitio norte | 330 ms | **0,47 ms** · 81 filas | Índice `(calidad, ts)`, recorrido hacia atrás |
| Borrar un mes (2.422.937 filas) | `DELETE`: 28.367 ms | `DROP PARTITION`: **3.910 ms** | Particiones por mes |
| Auditoría, página 1000 (de 50) | `OFFSET`: 16,3 ms · 50.000 filas | **0,058 ms** · 50 filas | Paginación por clave (`id < cursor`) |
| Auditoría, página 4000 | `OFFSET`: 61,7 ms · 200.000 filas | **0,031 ms** · 50 filas | Paginación por clave |

## Los planes

- **C con el índice:** `Index lookup on l using ix_lecturas_calidad_ts (calidad=1) (reverse)`: entra a las filas con calidad 1, ya ordenadas por `ts`, y se detiene al juntar 50 del sitio norte.
- **B sobre agregados:** `Covering index lookup on m using fk_motores_sitio` y 1.008 filas de `lecturas_hora` (6 motores × 168 horas), en vez de 363.300 lecturas.
- **Poda de particiones:** `EXPLAIN SELECT COUNT(*) FROM lecturas WHERE ts >= '2026-11-01' AND ts < '2026-12-01'` → `partitions: p2026_11`. Solo abre el archivo de noviembre.
- **Slow query log** (`long_query_time = 1`): capturó una agregación de toda la tabla con `Query_time: 2.363028`, el usuario y el SQL completo.

## Lecturas
- **Medir antes de corregir.** A ya era óptima: agregarle un índice solo habría hecho más lento cada INSERT.
- **El orden de las columnas del índice importa:** `(calidad, ts)` sirve para "calidad = 1, las más nuevas"; `(ts, calidad)` no.
- **Agregados:** el promedio de promedios es incorrecto si las horas tienen distinta cantidad de lecturas; se pondera por `n`. El evento `ev_lecturas_hora` recalcula cada hora las dos últimas, por las lecturas atrasadas de un buffer.
- **`DROP PARTITION` no depende del número de filas.** En Docker Desktop tardó 3,9 s porque soltar el archivo pasa por el sistema de archivos de la VM; en un Linux nativo suele tomar milisegundos. El `DELETE` además escribe cada fila en el undo y en el binlog, que MySQL 8.4 trae encendido.
- **`OFFSET` crece con la página; el cursor no.** El cursor tampoco repite ni salta filas si entran registros nuevos mientras se pagina.
- **La tabla `lecturas` de esta base quedó particionada;** una base nueva se crea sin particiones (`sql/001`). Particionar es un paso de operación, con su mantenimiento mensual (`REORGANIZE PARTITION p_futuro`).
