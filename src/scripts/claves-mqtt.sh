#!/usr/bin/env bash
# claves-mqtt.sh · (re)crea mosquitto/passwd con los usuarios del broker (Fase 6, paso 9).
# Lee usuarios y claves de .env y ejecuta mosquitto_passwd en un contenedor de un solo uso, con la
# misma imagen y los mismos volúmenes que el servicio mosquitto. Después reinicia el broker.
# SEGURIDAD: passwd guarda hashes (PBKDF2-SHA512 con sal), nunca las claves; igual, Git lo ignora.
# Uso: bash src/scripts/claves-mqtt.sh

# -e: sale al primer error · -u: error si falta una variable · pipefail: falla si falla un pipe.
set -euo pipefail
cd "$(dirname "$0")/../.."     # raíz del proyecto: ahí están docker-compose.yml y .env

# set -a: todas las variables que se definan desde aquí se exportan; source carga .env.
set -a
source .env
set +a

# POR QUÉ: Git Bash convertiría /mosquitto/config/passwd en C:/Program Files/Git/... al pasárselo
# a docker.exe. Con esto, la ruta llega tal cual al contenedor.
export MSYS_NO_PATHCONV=1

# run --rm: contenedor de un solo uso que se borra al terminar. --no-deps: no levanta otros
# servicios. --entrypoint: en vez del broker, ejecuta mosquitto_passwd.
# --user 1883:1883: lo ejecuta el usuario mosquitto del contenedor.
# OJO: mosquitto_passwd crea el archivo con permisos 0600 (solo su dueño lo lee). Si lo crea root,
# el broker, que corre como mosquitto (uid 1883), no lo puede abrir: "Unable to open pwfile".
# OJO: -b recibe la clave en la línea de comandos; aceptable en un contenedor efímero de laboratorio.
passwd_mqtt() {
  docker compose run --rm --no-deps --user 1883:1883 --entrypoint mosquitto_passwd mosquitto "$@" 2>&1 \
    | grep -v -E 'Container|Creating|Created' || true
}

# Se regenera completo en cada corrida: el archivo anterior pudo quedar con otro dueño.
rm -f mosquitto/passwd

echo "Creando mosquitto/passwd"
passwd_mqtt -c -b /mosquitto/config/passwd "$MQTT_USUARIO" "$MQTT_CLAVE"                   # -c: crea el archivo (borra el anterior)
passwd_mqtt -b /mosquitto/config/passwd "$GATEWAY_MQTT_USUARIO" "$GATEWAY_MQTT_CLAVE"     # sin -c: agrega
passwd_mqtt -b /mosquitto/config/passwd "$CAN_MQTT_USUARIO" "$CAN_MQTT_CLAVE"             # Fase 8: CAN del sitio sur

# El acl también debe ser del usuario mosquitto y no legible por otros; si no, el broker avisa que
# "una versión futura rechazará el archivo". Docker Desktop guarda este dueño y estos permisos
# aunque el archivo viva en tu disco de Windows (que sigue pudiendo editarlo).
docker compose run --rm --no-deps --entrypoint sh mosquitto \
  -c 'chown 1883:1883 /mosquitto/config/acl && chmod 0600 /mosquitto/config/acl' 2>&1 \
  | grep -v -E 'Container|Creating|Created' || true

echo "Usuarios en el archivo:"
cut -d: -f1 mosquitto/passwd | sed 's/^/  /'   # solo los nombres, antes del ':'

echo "Reiniciando el broker para cargar usuarios y ACL"
docker compose restart mosquitto
