-- rendimiento.sql · mediciones y optimizaciones de la Fase 11, en el orden en que se hicieron.
-- Los resultados (milisegundos reales) están en docs/rendimiento.md.
-- Datos: npm run volumen (2.419.200 lecturas: 10 motores × 4 variables × 1 cada 10 s × 7 días).
-- Cómo correr un bloque:
--   consultas  → docker compose exec -T mysql sh -c 'mysql -t -u telemetria_app -p"$DB_CLAVE" telemetria'
--   DDL (root) → docker compose exec -T mysql sh -c 'mysql -t -uroot -p"$MYSQL_ROOT_PASSWORD" telemetria'
-- CONCEPTO: EXPLAIN ANALYZE ejecuta la consulta y muestra el plan con tiempos reales:
-- "actual time=0.27..3.49" = primera fila a los 0,27 ms y la última a los 3,49 ms; rows = filas reales.

-- ── 1. Línea base ─────────────────────────────────────────────────────────────────────────────

-- A. La serie de rpm de un motor en 24 h. Ya es óptima: rango de la PK (motor, variable, ts).
EXPLAIN ANALYZE
SELECT ts, valor FROM lecturas
WHERE motor_id = (SELECT id FROM motores WHERE codigo = 'MTR-01')
  AND variable_id = (SELECT id FROM variables WHERE codigo = 'rpm')
  AND ts >= UTC_TIMESTAMP(3) - INTERVAL 24 HOUR
ORDER BY ts;

-- B. Promedio por hora de las rpm de todo el sitio norte en 7 días: lee cientos de miles de filas.
EXPLAIN ANALYZE
SELECT DATE_FORMAT(l.ts, '%Y-%m-%d %H:00') AS hora, ROUND(AVG(l.valor), 1) AS rpm_promedio, COUNT(*) AS n
FROM lecturas l JOIN motores m ON m.id = l.motor_id
WHERE m.sitio_id = (SELECT id FROM sitios WHERE codigo = 'norte')
  AND l.variable_id = (SELECT id FROM variables WHERE codigo = 'rpm')
  AND l.ts >= UTC_TIMESTAMP(3) - INTERVAL 7 DAY
GROUP BY hora ORDER BY hora;

-- C. Las últimas 50 lecturas fuera de rango del sitio norte: sin índice por calidad, recorre todo.
EXPLAIN ANALYZE
SELECT m.codigo, l.variable_id, l.ts, l.valor
FROM lecturas l JOIN motores m ON m.id = l.motor_id
WHERE m.sitio_id = (SELECT id FROM sitios WHERE codigo = 'norte') AND l.calidad = 1
ORDER BY l.ts DESC LIMIT 50;

-- ── 2 y 3. Índice (calidad, ts) y agregados por hora ─────────────────────────────────────────
-- Son permanentes: están en sql/004_rendimiento.sql (en una base nueva se crean solos).
-- Después de aplicarlo, la consulta C se repite tal cual y B se reescribe sobre lecturas_hora.

-- B sobre los agregados. OJO: el promedio de promedios es incorrecto si las horas tienen distinta
-- cantidad de lecturas; se pondera por n: SUM(promedio × n) / SUM(n).
EXPLAIN ANALYZE
SELECT DATE_FORMAT(h.hora, '%Y-%m-%d %H:00') AS hora,
       ROUND(SUM(h.promedio * h.n) / SUM(h.n), 1) AS rpm_promedio,
       SUM(h.n) AS n
FROM lecturas_hora h JOIN motores m ON m.id = h.motor_id
WHERE m.sitio_id = (SELECT id FROM sitios WHERE codigo = 'norte')
  AND h.variable_id = (SELECT id FROM variables WHERE codigo = 'rpm')
  AND h.hora >= DATE_FORMAT(UTC_TIMESTAMP() - INTERVAL 7 DAY, '%Y-%m-%d %H:00:00')
GROUP BY h.hora ORDER BY h.hora;

-- ── 4. Particiones por mes (root) ─────────────────────────────────────────────────────────────
-- CONCEPTO: partición. La tabla se guarda en varios archivos, uno por mes. Una consulta con rango
-- de fechas solo abre las particiones que tocan ese rango (poda), y un mes viejo se borra soltando
-- su archivo entero. Funciona porque ts está en la PK; por eso lecturas no tiene FK (MySQL no
-- permite claves foráneas en tablas particionadas).
ALTER TABLE lecturas
  PARTITION BY RANGE COLUMNS (ts) (
    PARTITION p2026_10 VALUES LESS THAN ('2026-11-01'),
    PARTITION p2026_11 VALUES LESS THAN ('2026-12-01'),
    PARTITION p2026_12 VALUES LESS THAN ('2027-01-01'),
    PARTITION p_futuro VALUES LESS THAN (MAXVALUE)   -- reserva: un INSERT con fecha futura nunca falla
  );

-- Poda: la columna `partitions` del plan debe decir solo p2026_11.
EXPLAIN SELECT COUNT(*) FROM lecturas WHERE ts >= '2026-11-01' AND ts < '2026-12-01';

-- Mantenimiento mensual: se parte la reserva para abrir el mes siguiente (en producción, con un EVENT).
-- ALTER TABLE lecturas REORGANIZE PARTITION p_futuro INTO (
--   PARTITION p2027_01 VALUES LESS THAN ('2027-02-01'),
--   PARTITION p_futuro VALUES LESS THAN (MAXVALUE));

-- DELETE de un mes contra DROP PARTITION, sobre dos copias (los datos reales no se tocan).
CREATE TABLE lecturas_copia_a LIKE lecturas;          -- LIKE copia columnas, índices y particiones
INSERT INTO lecturas_copia_a SELECT * FROM lecturas;
CREATE TABLE lecturas_copia_b LIKE lecturas;
INSERT INTO lecturas_copia_b SELECT * FROM lecturas;

SET @t = NOW(6);
DELETE FROM lecturas_copia_a WHERE ts >= '2026-11-01' AND ts < '2026-12-01';   -- fila por fila: undo, índices y binlog
SELECT ROW_COUNT() AS filas_borradas, ROUND(TIMESTAMPDIFF(MICROSECOND, @t, NOW(6)) / 1000) AS ms_delete;

SET @t = NOW(6);
ALTER TABLE lecturas_copia_b DROP PARTITION p2026_11;                          -- suelta el archivo del mes
SELECT ROUND(TIMESTAMPDIFF(MICROSECOND, @t, NOW(6)) / 1000) AS ms_drop_partition;

DROP TABLE lecturas_copia_a, lecturas_copia_b;        -- limpieza: solo las copias del experimento

-- ── 5. Paginación de la auditoría: OFFSET contra clave (root, sobre una tabla de prueba) ─────
-- POR QUÉ una copia: llenar auditoria_accesos con accesos falsos ensuciaría el registro real.
CREATE TABLE auditoria_prueba LIKE auditoria_accesos;
SET SESSION cte_max_recursion_depth = 200000;         -- por defecto un CTE recursivo para en 1000 vueltas
INSERT INTO auditoria_prueba (ts, usuario_id, usuario, rol, metodo, recurso, estado_http, ip, duracion_ms)
WITH RECURSIVE n AS (SELECT 1 AS i UNION ALL SELECT i + 1 FROM n WHERE i < 200000)
SELECT UTC_TIMESTAMP(3) - INTERVAL i SECOND, 2, 'ing-norte', 'ingeniero', 'GET', '/api/motores', 200, '127.0.0.1', 5 FROM n;

-- Página 1000 (50 por página) con OFFSET: recorre y descarta 49 950 filas.
EXPLAIN ANALYZE
SELECT id, ts, usuario, metodo, recurso, estado_http FROM auditoria_prueba
ORDER BY id DESC LIMIT 50 OFFSET 49950;

-- Página 1000 por clave: entra por la PK justo después de la última fila vista (@x).
SET @x = (SELECT id FROM auditoria_prueba ORDER BY id DESC LIMIT 1 OFFSET 49949);
EXPLAIN ANALYZE
SELECT id, ts, usuario, metodo, recurso, estado_http FROM auditoria_prueba
WHERE id < @x ORDER BY id DESC LIMIT 50;

DROP TABLE auditoria_prueba;                          -- limpieza: solo la tabla de prueba

-- ── 6. Slow query log ─────────────────────────────────────────────────────────────────────────
-- Encendido en docker-compose.yml (--slow-query-log=ON --long-query-time=1). Para verlo:
SELECT @@slow_query_log, @@long_query_time, @@slow_query_log_file;
-- Una consulta pesada a propósito (más de 1 s): promedio por hora de toda la tabla, sin agregados.
SELECT COUNT(*) FROM (
  SELECT DATE_FORMAT(ts, '%Y-%m-%d %H') AS h, AVG(valor) FROM lecturas GROUP BY h, motor_id, variable_id
) t;
-- Y en la terminal: docker compose exec mysql sh -c 'tail -n 8 /var/lib/mysql/*-slow.log'
