-- 005_integracion.sql · claves de API para SCADA y EMS (Fase 14).
-- En una base nueva corre al crearla; en una que ya existe se aplica una vez como root:
--   docker compose exec -T mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" telemetria' < sql/005_integracion.sql

CREATE TABLE claves_api (
  id          INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  nombre      VARCHAR(60)       NOT NULL,                 -- qué sistema la usa: 'scada-norte', 'ems-central'
  hash_clave  CHAR(64)          NOT NULL,                 -- SHA-256 en hexadecimal; la clave nunca se guarda
  rol         ENUM('integracion') NOT NULL DEFAULT 'integracion',
  sitio_id    SMALLINT UNSIGNED NULL,                     -- NULL = todos los sitios
  activa      BOOLEAN           NOT NULL DEFAULT TRUE,    -- revocar = FALSE (se conserva para la auditoría)
  ultimo_uso  DATETIME(3)       NULL,                     -- para detectar claves olvidadas
  creada_en   DATETIME(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_claves_api_hash (hash_clave),             -- la búsqueda de cada petición va por aquí
  UNIQUE KEY uq_claves_api_nombre (nombre),
  CONSTRAINT fk_claves_api_sitio FOREIGN KEY (sitio_id) REFERENCES sitios (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- La API lee las claves, crea nuevas (crear-clave-api.js) y actualiza ultimo_uso o activa. Nunca borra.
GRANT SELECT, INSERT, UPDATE ON claves_api TO 'telemetria_app'@'%';
