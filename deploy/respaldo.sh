#!/usr/bin/env bash
# respaldo.sh · respaldo comprimido de la base telemetria con mysqldump (Fase 13).
# MySQL corre en Docker: el volcado se hace DENTRO del contenedor, donde ya está la clave de root;
# así ninguna clave queda escrita en el servidor ni en este script.
# Programar a las 03:00 con `sudo crontab -e`:
#   0 3 * * * /opt/telemetria/actual/deploy/respaldo.sh >> /var/log/telemetria-respaldo.log 2>&1
# Variables opcionales: DESTINO (carpeta), DIAS (retención), CONTENEDOR (nombre del contenedor de MySQL).

# -e: sale al primer error · -u: error si falta una variable · pipefail: si mysqldump falla, falla
# todo el pipe aunque gzip termine bien (sin esto, quedaría un respaldo vacío "exitoso").
set -euo pipefail

DESTINO="${DESTINO:-/var/backups/telemetria}"   # dónde se guardan los respaldos
DIAS="${DIAS:-7}"                                # cuántos días se conservan
CONTENEDOR="${CONTENEDOR:-telemetria-mysql-1}"   # nombre que le da Compose al contenedor de MySQL

mkdir -p "$DESTINO"
# Fecha en UTC en el nombre: los respaldos se ordenan solos y no chocan.
archivo="$DESTINO/telemetria-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"

# Si algo falla, borra el archivo a medias: un respaldo incompleto es peor que ninguno.
trap 'rm -f "$archivo.tmp"' ERR

# mysqldump:
#   --single-transaction: una foto coherente de InnoDB sin bloquear la tabla (la ingesta sigue).
#   --routines --events --triggers: incluye el evento ev_lecturas_hora y cualquier procedimiento.
#   --no-tablespaces: no pide el privilegio PROCESS solo para listar tablespaces.
# OJO: comillas simples: $MYSQL_ROOT_PASSWORD lo expande el sh del contenedor, no este script.
docker exec -i "$CONTENEDOR" sh -c \
  'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --events --triggers --no-tablespaces telemetria' \
  2> >(grep -v 'Using a password' >&2) \
  | gzip > "$archivo.tmp"

# Recién completo, se le da el nombre final: nunca hay un .sql.gz a medio escribir con nombre válido.
mv "$archivo.tmp" "$archivo"
echo "$(date -u +%FT%TZ) respaldo listo: $archivo ($(du -h "$archivo" | cut -f1))"

# Retención: borra los respaldos de más de DIAS días (-mtime +N = modificados hace más de N días).
find "$DESTINO" -name 'telemetria-*.sql.gz' -mtime +"$DIAS" -print -delete
