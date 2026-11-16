-- 004_rendimiento.sql · índice de calidad, agregados por hora y su evento (Fase 11).
-- En una base nueva corre al crearla, después de 003 (que creó telemetria_app).
-- En una base que ya existe se aplica una vez como root:
--   docker compose exec -T mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" telemetria' < sql/004_rendimiento.sql
-- Las mediciones de antes y después están en practica/rendimiento.sql y docs/rendimiento.md.

-- Índice para "las últimas lecturas fuera de rango": calidad primero (se compara por igualdad) y ts
-- después (se ordena por él). Con calidad = 1, MySQL recorre el índice desde el final y para en la fila 50.
-- OJO: el orden de las columnas importa; (ts, calidad) obligaría a recorrer todas las horas.
CREATE INDEX ix_lecturas_calidad_ts ON lecturas (calidad, ts);

-- CONCEPTO: agregado precalculado. El dashboard de 7 días no necesita 60 000 puntos por motor: le
-- basta una fila por hora. Se calcula una vez y se lee muchas veces (como un historiador que guarda
-- promedios horarios además del dato crudo).
CREATE TABLE lecturas_hora (
  motor_id     SMALLINT UNSIGNED NOT NULL,
  variable_id  SMALLINT UNSIGNED NOT NULL,
  hora         DATETIME          NOT NULL,   -- inicio de la hora, en UTC (10:00:00 = de 10:00 a 10:59:59)
  promedio     DOUBLE            NOT NULL,
  minimo       DOUBLE            NOT NULL,
  maximo       DOUBLE            NOT NULL,
  n            INT UNSIGNED      NOT NULL,   -- lecturas que entraron; sirve para promediar horas o motores entre sí
  PRIMARY KEY (motor_id, variable_id, hora)  -- mismo orden que lecturas: rangos por motor, variable y tiempo
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Llenado inicial con todo el historial.
-- POR QUÉ la subconsulta con alias (agg): en INSERT ... SELECT, el ON DUPLICATE KEY UPDATE solo puede
-- nombrar las columnas calculadas si el SELECT es una tabla derivada con nombre.
INSERT INTO lecturas_hora (motor_id, variable_id, hora, promedio, minimo, maximo, n)
SELECT * FROM (
  SELECT motor_id, variable_id,
         DATE_FORMAT(ts, '%Y-%m-%d %H:00:00') AS hora_inicio,   -- trunca la hora: 10:37:12 → 10:00:00
         AVG(valor) AS prom, MIN(valor) AS mn, MAX(valor) AS mx, COUNT(*) AS cuantas
  FROM lecturas
  GROUP BY motor_id, variable_id, hora_inicio
) AS agg
ON DUPLICATE KEY UPDATE promedio = agg.prom, minimo = agg.mn, maximo = agg.mx, n = agg.cuantas;

-- CONCEPTO: EVENT. Una tarea programada dentro de MySQL (como un cron de la base); la ejecuta el
-- event_scheduler, que en MySQL 8.4 viene encendido. Corre como su creador (root), no como la API.
-- Cada hora, 5 minutos después de la hora en punto, recalcula las DOS últimas horas.
-- POR QUÉ dos: un gateway que drena su buffer trae lecturas atrasadas de la hora anterior.
CREATE EVENT ev_lecturas_hora
  ON SCHEDULE EVERY 1 HOUR
  STARTS (DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%d %H:05:00') + INTERVAL 1 HOUR)
  COMMENT 'Fase 11: agregados por hora de las dos últimas horas'
  DO
    INSERT INTO lecturas_hora (motor_id, variable_id, hora, promedio, minimo, maximo, n)
    SELECT * FROM (
      SELECT motor_id, variable_id, DATE_FORMAT(ts, '%Y-%m-%d %H:00:00') AS hora_inicio,
             AVG(valor) AS prom, MIN(valor) AS mn, MAX(valor) AS mx, COUNT(*) AS cuantas
      FROM lecturas
      WHERE ts >= DATE_FORMAT(UTC_TIMESTAMP() - INTERVAL 1 HOUR, '%Y-%m-%d %H:00:00')
      GROUP BY motor_id, variable_id, hora_inicio
    ) AS agg
    ON DUPLICATE KEY UPDATE promedio = agg.prom, minimo = agg.mn, maximo = agg.mx, n = agg.cuantas;

-- La API solo lee los agregados. Sin base en el nombre: vale para la base en uso (telemetria o telemetria_test).
GRANT SELECT ON lecturas_hora TO 'telemetria_app'@'%';
