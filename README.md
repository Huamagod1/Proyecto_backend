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
docker compose up -d --wait       # MySQL 8.4; la primera vez crea la base con sql/
```

API y pruebas:

```bash
npm run api:dev                                     # http://localhost:3000/api/salud
bash src/scripts/preparar-db-test.sh && npm test    # recrea telemetria_test y corre las pruebas
```

Consultas de práctica sobre la base:

```bash
docker compose exec -T mysql sh -c 'mysql -t -u telemetria_app -p"$DB_CLAVE" telemetria' < practica/consultas.sql
```

## En qué fase va

Fase 3 · API base con Express.
