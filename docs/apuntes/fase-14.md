# Fase 14 · Operación e integración con SCADA/EMS

## Mapa
- **Logs estructurados** (`src/comun/log.js`): una línea JSON por evento en la API y el gateway.
- **`/api/salud`** (vivo) y **`/api/listo`** (base y MQTT; 503 si no); **`/api/metricas`** (admin): ingesta, loteador, WebSocket, motores sin datos y memoria.
- **Detector de silencio** (`silencio.js`): cada minuto busca motores sin datos en 5 minutos; avisa en el log, por WebSocket y con un resumen retenido en `motores/{sitio}/alertas`.
- **Integración:** `GET /api/integracion/estado?sitio=` con `X-API-Key` (claves en `claves_api` como SHA-256), y para un EMS, MQTT con credencial propia y ACL de solo lectura.
- **`docs/RUNBOOK.md`** con cuatro procedimientos y **`docs/decisiones.md`** con las seis decisiones principales.

## Conceptos
- **Salud y disponibilidad:** vivo no es lo mismo que listo; a uno se lo reinicia y al otro se le deja de mandar tráfico.
- **Log estructurado:** campos con nombre (`nivel`, `evento`, `motor`) que se filtran con `jq` o journald.
- **Alerta por transición:** se avisa cuando algo cambia (se calla o vuelve), no cada minuto.
- **Clave de API:** identifica a un sistema; larga y aleatoria, se guarda como SHA-256 y se revoca a mano.
- **Contrato estable:** el formato de la API de integración no cambia sin aviso, porque otro sistema depende de él.

## Decisiones
- `/api/salud` ya no toca MySQL → una base caída no debe hacer que Docker reinicie la API.
- `desplegar.sh` comprueba `/api/listo` → una versión que no llega a sus dependencias no se da por buena.
- SHA-256 para las claves de API y bcrypt para las contraseñas → la clave es aleatoria y larga; la contraseña humana no.
- El resumen de alertas va retenido en MQTT → un EMS que se conecta después ve el estado actual al instante.
- La API publica solo en `motores/+/alertas` (ACL) → mínimo privilegio también para la API.
- Las dependencias de `/api/listo` y `/api/metricas` entran como opciones de `crearApp()` → se prueban sin broker.

## Comandos para saber de memoria
```bash
curl -s localhost:3000/api/listo
docker compose logs api --no-log-prefix | jq 'select(.nivel=="aviso")'
npm run clave-api -- scada-norte norte          # muestra la clave una sola vez
curl -s -H "X-API-Key: $CLAVE" "localhost:3000/api/integracion/estado?sitio=norte"
docker compose exec mosquitto mosquitto_sub -u api -P "$MQTT_CLAVE" -t 'motores/+/alertas' -v
```

## Preguntas de entrevista
- **¿Cómo te enteras de que algo falla antes que el cliente?** Con salud y disponibilidad, métricas, un detector de silencio que alerta cuando un sitio deja de enviar datos, logs estructurados y un runbook para actuar rápido.
- **¿Cómo integrarías un SCADA o un EMS?** Para lectura en vivo, MQTT con credencial propia y ACL de solo lectura sobre su sitio. Para sistemas que solo hablan HTTP, una API con clave por sistema, guardada como hash, revocable y auditada, con un formato plano y estable.
- **¿Cuál es la diferencia entre salud y disponibilidad?** Salud responde "¿estás vivo?" y se usa para reiniciar; disponibilidad, "¿puedes atender?" (base y broker), y se usa para mandar o no tráfico.

## Ejercicios a mano
1. Escribe sin mirar el procedimiento "un sitio dejó de enviar datos".
2. Agrega a `/api/metricas` el tiempo promedio de escritura del loteador.
