# Proyecto_backend · Plataforma de telemetría de motores

Proyecto de práctica para el cargo de Back-end Developer de datos industriales. Lleva la
telemetría de motores desde el terreno hasta un dashboard:

```
Simulador Modbus ─┐
Log CAN J1939 ────┼─ MQTT (Mosquitto) ─> API Node.js + Express ─> MySQL ─> WebSocket ─> Dashboard
Node-RED ─────────┘                       JWT, roles, auditoría             API de integración ─> SCADA / EMS
```

El plan completo, fase por fase, está en [PLAN.md](PLAN.md), y el avance en [PROGRESO.md](PROGRESO.md).
Los apuntes de estudio de cada fase están en [docs/apuntes/](docs/apuntes/).

## Requisitos

- Windows 11 con Git Bash (o Linux), Node 22.13 o superior (recomendado: Node 26 LTS).
- Docker Desktop con Docker Compose v2.

## Cómo levantarlo

```bash
cp .env.example .env              # y pon tus claves
npm install
docker compose up -d --wait       # MySQL 8.4 y Mosquitto 2.1; la primera vez crea la base con sql/
bash src/scripts/claves-mqtt.sh   # usuarios del broker (api, gw-norte) desde .env
```

Tópicos y formato de los mensajes MQTT: [docs/topicos.md](docs/topicos.md).

Terreno simulado, cada uno en su terminal (la de VS Code, para que el simulador reciba teclas):

```bash
npm run api          # ingesta HTTP y MQTT
npm run simulador    # Modbus TCP en el puerto 5020: MTR-01 y MTR-02
npm run gateway      # lee Modbus, guarda en SQLite y publica por MQTT
npm run can          # decodifica practica/candump-ejemplo.log (J1939) y publica MTR-03
```

Dashboard en vivo: abre http://localhost:3000 e inicia sesión (por ejemplo, `ing-norte` con la clave
`CLAVE_ING_NORTE` de tu `.env`). Cada usuario ve solo los motores de su sitio.

API y pruebas:

```bash
npm run sembrar                                     # usuarios admin, ing-norte, lector-sur, gw-norte
npm run api:dev                                     # http://localhost:3000/api/salud
bash src/scripts/preparar-db-test.sh && npm test    # recrea telemetria_test y corre las pruebas
```

Ingesta de un lote de ejemplo (con el token de `gw-norte`):

```bash
npm run lote-ejemplo     # regenera practica/lote-ejemplo.json con horas recientes
curl -s -X POST localhost:3000/api/lecturas -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d @practica/lote-ejemplo.json
```

Consultas de práctica sobre la base:

```bash
docker compose exec -T mysql sh -c 'mysql -t -u telemetria_app -p"$DB_CLAVE" telemetria' < practica/consultas.sql
```

## En qué fase va

Fase 9 · Tiempo real: WebSocket y dashboard.
