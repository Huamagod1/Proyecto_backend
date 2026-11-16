#!/bin/bash
# 003_usuario_app.sh · crea telemetria_app, el usuario de la API, con permisos mínimos (Fase 2).
# Lo ejecuta el entrypoint de MySQL al crear la base, después de 001 y 002 (orden alfabético).
# La clave viene de DB_CLAVE: .env → docker-compose.yml → entorno del contenedor. Así no queda
# escrita en el repositorio, que es público.
# OJO: el entrypoint "sourcea" este archivo si no es ejecutable y lo ejecuta si lo es. Funciona
# igual en los dos casos porque solo usa el cliente mysql y variables de entorno.

# SEGURIDAD: sin clave no se crea un usuario sin contraseña; el error queda en `docker compose logs mysql`.
if [ -z "${DB_CLAVE:-}" ]; then
  echo "003_usuario_app.sh: falta DB_CLAVE en el entorno del contenedor (revisa tu .env)" >&2
  return 1 2>/dev/null || exit 1   # return si lo sourcean; exit si lo ejecutan
fi

# Duplica las comillas simples: dentro de '...' en SQL, '' es una comilla literal.
# SEGURIDAD: una comilla en la clave no puede cerrar el texto y cambiar la sentencia.
clave_sql=${DB_CLAVE//\'/\'\'}

# Cliente mysql como root, por el socket local: durante la inicialización, MySQL no escucha por TCP.
# --defaults-extra-file recibe un archivo en memoria (<(...)), así la clave de root no aparece en `ps`.
# OJO: --defaults-extra-file tiene que ser la primera opción del comando.
mysql --defaults-extra-file=<(printf '[client]\npassword="%s"\n' "$MYSQL_ROOT_PASSWORD") \
  --protocol=socket -uroot <<SQL
-- '%' = el usuario puede conectarse desde cualquier host: la API corre fuera del contenedor.
CREATE USER IF NOT EXISTS 'telemetria_app'@'%' IDENTIFIED BY '${clave_sql}';

-- Catálogos: la API solo los lee.
GRANT SELECT ON telemetria.sitios    TO 'telemetria_app'@'%';
GRANT SELECT ON telemetria.variables TO 'telemetria_app'@'%';

-- Tablas de trabajo: leer, crear y actualizar, pero nunca borrar (las bajas son lógicas).
-- POR QUÉ el UPDATE: INSERT ... ON DUPLICATE KEY UPDATE lo exige, aunque no cambie nada.
GRANT SELECT, INSERT, UPDATE ON telemetria.motores       TO 'telemetria_app'@'%';
GRANT SELECT, INSERT, UPDATE ON telemetria.usuarios      TO 'telemetria_app'@'%';
GRANT SELECT, INSERT, UPDATE ON telemetria.lecturas      TO 'telemetria_app'@'%';
GRANT SELECT, INSERT, UPDATE ON telemetria.estado_actual TO 'telemetria_app'@'%';

-- Auditoría: solo agregar y leer. SEGURIDAD: desde la API nadie puede alterar el registro.
GRANT SELECT, INSERT ON telemetria.auditoria_accesos TO 'telemetria_app'@'%';
SQL
