-- 001_esquema.sql · tablas de la base de telemetría (Fase 2).
-- Lo ejecuta MySQL al crear la base (docker-entrypoint-initdb.d), dentro de `telemetria`.
-- También lo carga src/scripts/preparar-db-test.sh en `telemetria_test` (Fase 3).
-- OJO: no lleva `USE telemetria`: la base la elige quien ejecuta el script.
-- Convenciones: InnoDB, utf8mb4 y fechas DATETIME(3) en UTC, con milisegundos.
-- CONCEPTO: DATETIME guarda la fecha tal cual; TIMESTAMP la convierte según la zona de la sesión
-- y termina en 2038. Con DATETIME y todo en UTC, lo que se escribe es lo que se lee.

-- Sitios o faenas. Cada motor y cada usuario (salvo el admin) pertenece a uno.
CREATE TABLE sitios (
  id      SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,    -- 2 bytes: hasta 65 535 sitios
  codigo  VARCHAR(20)       NOT NULL,                   -- identificador legible y estable: 'norte'
  nombre  VARCHAR(100)      NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sitios_codigo (codigo)                   -- el código va en tópicos MQTT y URLs: no se repite
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;                 -- InnoDB: transacciones y FK; utf8mb4: tildes y ñ

-- Motores. La API los identifica por `codigo` (MTR-01); el `id` numérico es interno.
CREATE TABLE motores (
  id        SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo    VARCHAR(20)       NOT NULL,                 -- 'MTR-01'; la API exige ^MTR-\d{2,4}$
  modelo    VARCHAR(50)       NOT NULL,
  sitio_id  SMALLINT UNSIGNED NOT NULL,
  activo    BOOLEAN           NOT NULL DEFAULT TRUE,    -- baja lógica: el historial de lecturas sigue valiendo
  PRIMARY KEY (id),
  UNIQUE KEY uq_motores_codigo (codigo),                 -- de aquí sale el 409 de la API (ER_DUP_ENTRY)
  CONSTRAINT fk_motores_sitio FOREIGN KEY (sitio_id) REFERENCES sitios (id)  -- no hay motor sin sitio
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Catálogo de variables, con su rango válido. Un valor fuera de rango se guarda con calidad = 1.
CREATE TABLE variables (
  id           SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo       VARCHAR(40)       NOT NULL,              -- 'rpm', 'temp_refrigerante'...
  descripcion  VARCHAR(120)      NOT NULL,
  unidad       VARCHAR(16)       NOT NULL,              -- 'rpm', '°C', 'kPa'
  minimo       DOUBLE            NOT NULL,              -- límites del rango válido, en la unidad de la variable
  maximo       DOUBLE            NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_variables_codigo (codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Usuarios de la API (Fase 4). La contraseña nunca se guarda: solo su hash bcrypt.
CREATE TABLE usuarios (
  id             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  usuario        VARCHAR(40)   NOT NULL,
  password_hash  CHAR(60)      NOT NULL,                -- bcrypt mide siempre 60 caracteres ($2b$12$...)
  rol            ENUM('admin', 'ingeniero', 'lector', 'gateway') NOT NULL,  -- ENUM: MySQL rechaza un rol que no existe
  sitio_id       SMALLINT UNSIGNED NULL,                -- NULL = todos los sitios (solo el admin)
  activo         BOOLEAN       NOT NULL DEFAULT TRUE,
  creado_en      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),  -- en UTC: las sesiones están en +00:00
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_usuario (usuario),
  CONSTRAINT fk_usuarios_sitio FOREIGN KEY (sitio_id) REFERENCES sitios (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Auditoría de accesos (Fase 4): una fila por petición. La API solo puede insertar y leer.
-- POR QUÉ sin FK a usuarios: el registro debe sobrevivir aunque se borre el usuario, y un
-- intento con un usuario inexistente también se anota.
CREATE TABLE auditoria_accesos (
  id           BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,  -- BIGINT: crece con cada petición, sin techo práctico
  ts           DATETIME(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  usuario_id   INT UNSIGNED      NULL,                  -- NULL si la petición no traía un token válido
  usuario      VARCHAR(40)       NULL,                  -- copia del nombre: legible aunque el usuario cambie
  rol          VARCHAR(20)       NULL,
  metodo       VARCHAR(10)       NOT NULL,              -- GET, POST, PUT, DELETE
  recurso      VARCHAR(255)      NOT NULL,              -- la ruta pedida, sin el dominio
  estado_http  SMALLINT UNSIGNED NOT NULL,              -- 200, 401, 403...
  ip           VARCHAR(45)       NULL,                  -- 45 caracteres: el largo máximo de una IPv6 en texto
  duracion_ms  INT UNSIGNED      NOT NULL,
  PRIMARY KEY (id),
  KEY ix_auditoria_ts (ts),                              -- filtro por rango de fechas
  KEY ix_auditoria_usuario_ts (usuario_id, ts)           -- "qué hizo este usuario", ya ordenado por tiempo
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Lecturas: el historiador. Una fila por motor, variable e instante.
-- CONCEPTO: en InnoDB la PK es el orden físico de la tabla (índice agrupado). Con
-- (motor_id, variable_id, ts), "las rpm de MTR-01 entre dos horas" son filas contiguas en disco.
-- La misma PK da la idempotencia: la misma lectura no puede guardarse dos veces.
-- POR QUÉ sin FK: con millones de filas, cada INSERT revisaría motores y variables, y las tablas
-- particionadas (Fase 11) no admiten FK. La validación la hace la API con el catálogo.
CREATE TABLE lecturas (
  motor_id     SMALLINT UNSIGNED NOT NULL,
  variable_id  SMALLINT UNSIGNED NOT NULL,
  ts           DATETIME(3)       NOT NULL,              -- hora del equipo que midió, en UTC
  valor        DOUBLE            NOT NULL,              -- 8 bytes: alcanza para rpm, temperaturas y horas
  calidad      TINYINT UNSIGNED  NOT NULL DEFAULT 0,    -- 0 buena, 1 fuera del rango del catálogo
  recibido_en  DATETIME(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP(3),  -- cuándo llegó a la base
  PRIMARY KEY (motor_id, variable_id, ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Último valor de cada variable de cada motor: lo que lee el dashboard sin recorrer `lecturas`.
CREATE TABLE estado_actual (
  motor_id     SMALLINT UNSIGNED NOT NULL,
  variable_id  SMALLINT UNSIGNED NOT NULL,
  ts           DATETIME(3)       NOT NULL,
  valor        DOUBLE            NOT NULL,
  calidad      TINYINT UNSIGNED  NOT NULL DEFAULT 0,
  PRIMARY KEY (motor_id, variable_id)                    -- una sola fila por motor y variable
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
