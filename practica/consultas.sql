-- consultas.sql · datos de prueba y las cinco consultas clave de la Fase 2.
-- OJO: vive en practica/ y no en sql/, porque todo lo de sql/ se ejecuta al crear la base.
-- Ejecútalo con el usuario de la API (la clave DB_CLAVE ya está en el entorno del contenedor):
--   docker compose exec -T mysql sh -c 'mysql -t -u telemetria_app -p"$DB_CLAVE" telemetria' < practica/consultas.sql
-- -T: sin TTY, para poder redirigir el archivo; -t: resultados en tabla.

-- ── 6a. Datos de prueba: 10 lecturas de MTR-01 en los últimos 10 minutos ─────────────────────
-- Variables de sesión con los id: el INSERT queda legible y no depende de qué id tocó a cada uno.
SET @mtr01 = (SELECT id FROM motores   WHERE codigo = 'MTR-01');
SET @rpm   = (SELECT id FROM variables WHERE codigo = 'rpm');
SET @temp  = (SELECT id FROM variables WHERE codigo = 'temp_refrigerante');

-- UTC_TIMESTAMP(3) - INTERVAL n MINUTE: horas relativas a "ahora", siempre recientes.
INSERT INTO lecturas (motor_id, variable_id, ts, valor, calidad) VALUES
  (@mtr01, @rpm,  UTC_TIMESTAMP(3) - INTERVAL 10 MINUTE, 1490, 0),
  (@mtr01, @rpm,  UTC_TIMESTAMP(3) - INTERVAL 8 MINUTE,  1502, 0),
  (@mtr01, @rpm,  UTC_TIMESTAMP(3) - INTERVAL 6 MINUTE,  1511, 0),
  (@mtr01, @rpm,  UTC_TIMESTAMP(3) - INTERVAL 4 MINUTE,  1497, 0),
  (@mtr01, @rpm,  UTC_TIMESTAMP(3) - INTERVAL 2 MINUTE,  1505, 0),
  (@mtr01, @temp, UTC_TIMESTAMP(3) - INTERVAL 9 MINUTE,  84.6, 0),
  (@mtr01, @temp, UTC_TIMESTAMP(3) - INTERVAL 7 MINUTE,  85.1, 0),
  (@mtr01, @temp, UTC_TIMESTAMP(3) - INTERVAL 5 MINUTE,  85.9, 0),
  (@mtr01, @temp, UTC_TIMESTAMP(3) - INTERVAL 3 MINUTE,  152.0, 1),  -- fuera de rango (máximo 150 °C)
  (@mtr01, @temp, UTC_TIMESTAMP(3) - INTERVAL 1 MINUTE,  86.4, 0);

-- El último valor de cada variable va a estado_actual. Upsert: inserta, o actualiza si ya existe.
INSERT INTO estado_actual (motor_id, variable_id, ts, valor, calidad) VALUES
  (@mtr01, @rpm,  UTC_TIMESTAMP(3) - INTERVAL 2 MINUTE, 1505, 0),
  (@mtr01, @temp, UTC_TIMESTAMP(3) - INTERVAL 1 MINUTE, 86.4, 0)
AS nuevo                                         -- alias de la fila nueva (reemplaza a VALUES(), obsoleto)
ON DUPLICATE KEY UPDATE valor = nuevo.valor, calidad = nuevo.calidad, ts = nuevo.ts;

-- ── 1. Último valor de cada variable de MTR-01, con nombre y unidad ───────────────────────────
-- Lee la tabla chica estado_actual, no el historial: es lo que consulta el dashboard.
SELECT v.codigo, v.descripcion, v.unidad, e.valor, e.ts, e.calidad
FROM estado_actual e
JOIN motores   m ON m.id = e.motor_id
JOIN variables v ON v.id = e.variable_id
WHERE m.codigo = 'MTR-01'
ORDER BY v.codigo;

-- ── 2. Las rpm de MTR-01 en la última hora ────────────────────────────────────────────────────
-- Los JOIN por código único son "const": MySQL los resuelve primero y recorre `lecturas` por un
-- tramo de su PK (motor_id, variable_id, ts) = rango contiguo en disco.
SELECT l.ts, l.valor
FROM lecturas l
JOIN motores   m ON m.id = l.motor_id    AND m.codigo = 'MTR-01'
JOIN variables v ON v.id = l.variable_id AND v.codigo = 'rpm'
WHERE l.ts >= UTC_TIMESTAMP(3) - INTERVAL 1 HOUR
ORDER BY l.ts;

-- ── 3. Promedio de rpm por minuto en la última hora ───────────────────────────────────────────
-- DATE_FORMAT trunca la hora al minuto; GROUP BY junta las lecturas de cada minuto.
SELECT DATE_FORMAT(l.ts, '%Y-%m-%d %H:%i') AS minuto,
       ROUND(AVG(l.valor), 1)              AS rpm_promedio,
       COUNT(*)                            AS n
FROM lecturas l
JOIN motores   m ON m.id = l.motor_id    AND m.codigo = 'MTR-01'
JOIN variables v ON v.id = l.variable_id AND v.codigo = 'rpm'
WHERE l.ts >= UTC_TIMESTAMP(3) - INTERVAL 1 HOUR
GROUP BY minuto
ORDER BY minuto;

-- ── 4. Motores sin datos en los últimos 5 minutos, incluidos los que nunca enviaron ───────────
-- LEFT JOIN: el motor aparece aunque no tenga filas en estado_actual (MAX da NULL).
-- HAVING filtra después de agrupar, sobre el último dato de cada motor.
SELECT m.codigo, MAX(e.ts) AS ultimo_dato
FROM motores m
LEFT JOIN estado_actual e ON e.motor_id = m.id
WHERE m.activo = TRUE
GROUP BY m.id, m.codigo
HAVING ultimo_dato IS NULL OR ultimo_dato < UTC_TIMESTAMP(3) - INTERVAL 5 MINUTE
ORDER BY m.codigo;

-- ── 5. Lecturas fuera de rango de cada motor hoy (día UTC) ────────────────────────────────────
-- Las condiciones van en el ON y no en el WHERE: así los motores sin fallas salen con 0.
SELECT m.codigo, COUNT(l.motor_id) AS fuera_de_rango
FROM motores m
LEFT JOIN lecturas l ON l.motor_id = m.id AND l.calidad = 1 AND l.ts >= UTC_DATE()
GROUP BY m.id, m.codigo
ORDER BY m.codigo;

-- ── 7. Plan de la consulta 2: debe usar la PK de lecturas con un rango ───────────────────────
-- Esperado en la fila de `l`: type = range y key = PRIMARY.
-- OJO: aquí aparece "Using filesort" (ordena las 5 filas aparte). Si la consulta recibe los id
-- ya resueltos, como hace la API con su catálogo (Fase 5), MySQL lee en el orden de la PK y no
-- ordena nada: EXPLAIN SELECT ts, valor FROM lecturas WHERE motor_id = 1 AND variable_id = 1
-- AND ts >= ... ORDER BY ts → type range, key PRIMARY, sin filesort.
EXPLAIN
SELECT l.ts, l.valor
FROM lecturas l
JOIN motores   m ON m.id = l.motor_id    AND m.codigo = 'MTR-01'
JOIN variables v ON v.id = l.variable_id AND v.codigo = 'rpm'
WHERE l.ts >= UTC_TIMESTAMP(3) - INTERVAL 1 HOUR
ORDER BY l.ts;
