-- 002_datos_iniciales.sql · sitios, motores y catálogo de variables (Fase 2).
-- Corre después de 001_esquema.sql, al crear la base, y también en telemetria_test (Fase 3).

-- POR QUÉ: el archivo trae tildes y "°C"; así el cliente las envía como utf8mb4 y no se corrompen.
SET NAMES utf8mb4;

INSERT INTO sitios (codigo, nombre) VALUES
  ('norte', 'Faena Norte'),
  ('sur',   'Faena Sur');

-- El sitio se busca por código: no se asume que 'norte' quedó con id 1.
INSERT INTO motores (codigo, modelo, sitio_id) VALUES
  ('MTR-01', '16V4000', (SELECT id FROM sitios WHERE codigo = 'norte')),
  ('MTR-02', '16V4000', (SELECT id FROM sitios WHERE codigo = 'norte')),
  ('MTR-03', 'QSK60',   (SELECT id FROM sitios WHERE codigo = 'sur'));

-- Rango válido de cada variable, en su unidad. Fuera de rango no se rechaza: se marca con calidad = 1.
INSERT INTO variables (codigo, descripcion, unidad, minimo, maximo) VALUES
  ('rpm',               'Velocidad del motor',          'rpm',  0,   3000),
  ('temp_refrigerante', 'Temperatura del refrigerante', '°C',   -40, 150),
  ('presion_aceite',    'Presión de aceite',            'kPa',  0,   1000),
  ('voltaje_bateria',   'Voltaje de batería',           'V',    0,   36),
  ('carga',             'Carga del motor',              '%',    0,   110),
  ('horas_motor',       'Horas de operación',           'h',    0,   200000),
  ('alarmas',           'Palabra de alarmas (16 bits)', 'bits', 0,   65535);
