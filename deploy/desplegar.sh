#!/usr/bin/env bash
# desplegar.sh <tag> · despliega una versión etiquetada, con vuelta atrás automática (Fase 13).
# Cada versión vive en /opt/telemetria/releases/<tag>; /opt/telemetria/actual es un enlace a la
# vigente. Desplegar = cambiar el enlace y reiniciar; volver atrás = devolver el enlace.
# Uso (como root): sudo /opt/telemetria/actual/deploy/desplegar.sh fase-13
# CONCEPTO: es como cambiar un equipo en terreno dejando el anterior conectado al lado: si el nuevo
# no arranca, se reconecta el viejo en segundos.

set -euo pipefail

TAG="${1:?uso: desplegar.sh <tag>   (por ejemplo: desplegar.sh v1.0.0)}"
# Repositorio público: se clona por HTTPS sin llave. Si fuera privado, una deploy key de solo lectura.
REPO="${REPO:-https://github.com/Huamagod1/Proyecto_backend.git}"
BASE=/opt/telemetria
DESTINO="$BASE/releases/$TAG"
ACTUAL="$BASE/actual"
# /api/listo y no /api/salud: una versión que arranca pero no llega a MySQL o al broker no sirve (Fase 14).
SALUD="${SALUD:-http://127.0.0.1:3000/api/listo}"
SERVICIOS=(telemetria-api telemetria-gateway)

# La versión vigente, para poder volver a ella. readlink -f: a qué carpeta apunta el enlace hoy.
anterior=$(readlink -f "$ACTUAL" 2>/dev/null || true)

# 1. Descarga e instala la versión, solo si no está ya (desplegar dos veces el mismo tag es seguro).
if [ ! -d "$DESTINO" ]; then
  # --depth 1: solo el último commit del tag, sin todo el historial. --branch acepta tags.
  git clone --depth 1 --branch "$TAG" "$REPO" "$DESTINO"
  # npm ci: exactamente lo de package-lock.json; --omit=dev: sin las dependencias de prueba.
  (cd "$DESTINO" && npm ci --omit=dev --no-audit --no-fund)
fi

# Cambia el enlace de forma atómica: se crea uno nuevo y se renombra encima del viejo (mv -T).
# POR QUÉ: con `ln -sfn` directo hay un instante sin enlace; con rename nunca falta.
cambiar_enlace() {
  ln -sfn "$1" "$ACTUAL.nuevo"
  mv -T "$ACTUAL.nuevo" "$ACTUAL"
}

# 2. Activa la versión nueva y reinicia los servicios.
cambiar_enlace "$DESTINO"
systemctl restart "${SERVICIOS[@]}"

# 3. Comprueba la salud: 15 intentos cada 2 s (30 s en total) para darle tiempo de arrancar.
for _ in $(seq 1 15); do
  if curl -fsS "$SALUD" > /dev/null; then
    echo "Desplegado $TAG: la API responde en $SALUD"
    exit 0
  fi
  sleep 2
done

# 4. Vuelta atrás: la versión nueva no respondió.
echo "La versión $TAG no respondió; vuelvo a ${anterior:-ninguna}" >&2
if [ -n "$anterior" ] && [ "$anterior" != "$DESTINO" ]; then
  cambiar_enlace "$anterior"
  systemctl restart "${SERVICIOS[@]}"
fi
exit 1
