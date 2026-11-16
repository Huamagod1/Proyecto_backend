#!/usr/bin/env bash
# preparar-db-test.sh · recrea la base telemetria_test para las pruebas (Fase 3).
# Corre el SQL dentro del contenedor mysql, donde ya existe MYSQL_ROOT_PASSWORD, y genera
# .env.test a partir de tu .env con DB_NOMBRE=telemetria_test.
# OJO: borra y recrea telemetria_test cada vez; nunca toca la base telemetria.
# Uso: bash src/scripts/preparar-db-test.sh && npm test

# -e: sale al primer error · -u: error si se usa una variable sin valor · pipefail: un pipe falla
# si falla cualquiera de sus partes, no solo la última.
set -euo pipefail

# Se ubica en la raíz del proyecto, la llame quien la llame: ahí están docker-compose.yml y sql/.
cd "$(dirname "$0")/../.."

# Ejecuta el cliente mysql como root dentro del contenedor, con los argumentos que reciba.
# -T: sin TTY, para poder pasarle un archivo por la entrada estándar.
# OJO: comillas simples: $MYSQL_ROOT_PASSWORD lo expande el sh del contenedor, no tu Git Bash.
# 2> >(...): quita de los errores solo el aviso "Using a password on the command line".
mysql_root() {
  docker compose exec -T mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$@"' sh "$@" \
    2> >(grep -v 'Using a password' >&2)
}

echo "1/4 Recreando la base telemetria_test"
mysql_root -e "DROP DATABASE IF EXISTS telemetria_test; CREATE DATABASE telemetria_test CHARACTER SET utf8mb4;"

echo "2/4 Cargando los .sql de sql/ en orden (los .sh crean usuarios: no hacen falta aquí)"
for archivo in sql/*.sql; do
  echo "    $archivo"
  mysql_root telemetria_test < "$archivo"
done

echo "3/4 Permisos de telemetria_app sobre telemetria_test"
# Los mismos verbos que en producción, sin DELETE: si el código intenta borrar, la prueba lo detecta.
mysql_root -e "GRANT SELECT, INSERT, UPDATE ON telemetria_test.* TO 'telemetria_app'@'%';"

echo "4/4 Generando .env.test (igual a .env, con DB_NOMBRE=telemetria_test)"
sed 's/^DB_NOMBRE=.*/DB_NOMBRE=telemetria_test/' .env > .env.test

echo "Listo: ahora corre npm test"
