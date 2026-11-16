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

Todo en contenedores, con un comando (Fase 12):

```bash
cp .env.example .env                                # y pon tus claves
docker compose --profile completo up -d --build     # MySQL, Mosquitto, API, gateway y simulador
bash src/scripts/claves-mqtt.sh                     # usuarios del broker (la primera vez)
npm install && npm run sembrar                      # usuarios de la API (la primera vez; el contenedor no recibe las CLAVE_*)
```

Dashboard en http://localhost:3000. Para desarrollar, cada pieza también corre en tu equipo:

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

Node-RED (MTR-02 en bloques; con esto activo, deja `GATEWAY_EQUIPOS=1:MTR-01` en tu `.env`):

```bash
docker compose --profile nodered up -d                                      # simulador en contenedor + Node-RED
docker compose exec -w /data nodered npm install node-red-contrib-modbus    # solo la primera vez
docker compose restart nodered && npm run nodered:desplegar                 # editor en http://127.0.0.1:1880
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

Volumen y rendimiento (Fase 11; resultados en [docs/rendimiento.md](docs/rendimiento.md)):

```bash
npm run volumen      # 2,4 millones de lecturas sintéticas en ~20 s
# En una base creada antes de la Fase 11, aplica una vez el índice y los agregados como root:
docker compose exec -T mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" telemetria' < sql/004_rendimiento.sql
```

Consultas de práctica sobre la base:

```bash
docker compose exec -T mysql sh -c 'mysql -t -u telemetria_app -p"$DB_CLAVE" telemetria' < practica/consultas.sql
```

## En qué fase va

Fase 12 · Docker: todo con un comando.
