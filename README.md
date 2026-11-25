# Proyecto_backend · Plataforma de telemetría de motores

Proyecto de práctica para el cargo de Back-end Developer de datos industriales. Lleva la
telemetría de motores desde el terreno hasta un dashboard y otros sistemas:

```
Simulador Modbus TCP ── gateway (buffer SQLite) ─┐
Log CAN J1939 ───────── decodificador ───────────┼─ MQTT QoS 1 (Mosquitto 2.1, usuarios y ACL)
Node-RED (Modbus en bloques) ────────────────────┘                │
                                                                   ▼
            API Node.js + Express 5: ingesta MQTT y HTTP, zod, JWT, roles, permiso por sitio, auditoría
                       │                        │                          │
             MySQL 8.4 (PK compuesta,     WebSocket ──> dashboard    API de integración (X-API-Key)
             agregados, particiones)                                  y MQTT de solo lectura ──> SCADA / EMS
```

## Documentación

| Documento | Tipo | Responde a | Lectura |
|---|---|---|---|
| [docs/README.md](docs/README.md) | Consultar | ¿Qué leo según lo que necesito, y qué documentos existen? | 5 min |
| [docs/GUIA.md](docs/GUIA.md) | Entender | ¿Cómo funciona todo, desde cero? | 30 min (secciones 1 a 4) |
| [docs/COMO-ABORDAR.md](docs/COMO-ABORDAR.md) | Entender | ¿Cómo leo y estudio un proyecto de este tamaño? | 25 min |
| [docs/CRITERIO.md](docs/CRITERIO.md) | Entender | ¿Cómo decido rápido y bien? | 5 min (la tarjeta de bolsillo) |
| [docs/OT-TI.md](docs/OT-TI.md) | Entender | ¿Qué hacer y qué no en un ambiente industrial? | 40 min |
| [docs/ATLAS-VISUAL.md](docs/ATLAS-VISUAL.md) | Entender | ¿Cómo se ve cada idea del proyecto, en un dibujo? | 15 min |
| [docs/MAPA-DEL-CARGO.md](docs/MAPA-DEL-CARGO.md) | Consultar | ¿Qué pide el cargo, dónde lo construye el proyecto y cuánto lo domino? | 5 min |
| [PLAN-2.md](PLAN-2.md) | Aprender | ¿Qué construyo en cada fase de la Parte 2, y cómo lo verifico? | 10 min por fase |

- **Plan y avance:** [PLAN.md](PLAN.md) (Parte 1, fases 0 a 14) · [PROGRESO.md](PROGRESO.md) · apuntes por fase en [docs/apuntes/](docs/apuntes/) · decisiones de diseño en [docs/decisiones.md](docs/decisiones.md)
- **Operar y consultar:** [docs/RUNBOOK.md](docs/RUNBOOK.md) · tópicos MQTT en [docs/topicos.md](docs/topicos.md) · [docs/j1939.md](docs/j1939.md) · [docs/rs485.md](docs/rs485.md) · rendimiento medido en [docs/rendimiento.md](docs/rendimiento.md)

## Requisitos

- Windows 11 con Git Bash (o Linux) y Node 26 LTS o superior.
- Docker Desktop con Docker Compose v2.

## Levantarlo todo en contenedores

```bash
cp .env.example .env                                # pon tus claves (openssl rand -hex 16)
docker compose --profile completo up -d --build     # MySQL, Mosquitto, API, gateway y simulador
bash src/scripts/claves-mqtt.sh                     # usuarios del broker desde .env (la primera vez)
npm install && npm run sembrar                      # usuarios de la API (la primera vez)
```

Dashboard en http://localhost:3000: inicia sesión, por ejemplo, con `ing-norte` y la clave
`CLAVE_ING_NORTE` de tu `.env`. Cada usuario ve solo los motores de su sitio.

## Desarrollar pieza por pieza

```bash
docker compose up -d --wait       # solo MySQL y Mosquitto
npm run api:dev                   # API con reinicio al guardar
npm run simulador                 # Modbus TCP en el puerto 5020 (en la terminal de VS Code: teclas t, f, d)
npm run gateway                   # Modbus → SQLite → MQTT
npm run can                       # practica/candump-ejemplo.log (J1939) → MQTT, como MTR-03
```

Node-RED (lee MTR-02; con esto activo, deja `GATEWAY_EQUIPOS=1:MTR-01` en tu `.env`):

```bash
docker compose --profile nodered up -d
docker compose exec -w /data nodered npm install node-red-contrib-modbus    # solo la primera vez
docker compose restart nodered && npm run nodered:desplegar                 # editor en http://127.0.0.1:1880
```

## Pruebas

```bash
bash src/scripts/preparar-db-test.sh && npm test    # recrea telemetria_test y corre las 68 pruebas
```

## Operación e integración

```bash
curl -s localhost:3000/api/salud                    # el proceso está vivo
curl -s localhost:3000/api/listo                    # base y MQTT conectados (503 si no)
npm run clave-api -- scada-norte norte              # clave para un SCADA del sitio norte (se muestra una vez)
curl -s -H "X-API-Key: $CLAVE" "localhost:3000/api/integracion/estado?sitio=norte"
docker compose logs api --no-log-prefix | jq 'select(.nivel != "info")'   # logs JSON
```

## Datos de práctica

```bash
npm run lote-ejemplo                                # lote HTTP con horas recientes (practica/lote-ejemplo.json)
npm run volumen                                     # 2,4 millones de lecturas sintéticas en ~20 s
docker compose exec -T mysql sh -c 'mysql -t -u telemetria_app -p"$DB_CLAVE" telemetria' < practica/consultas.sql
# Una base creada antes de las fases 11 y 14 necesita, una vez y como root, sql/004 y sql/005:
docker compose exec -T mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" telemetria' < sql/004_rendimiento.sql
```

## Despliegue en Linux

Unidades de systemd, nginx, respaldos y despliegue con vuelta atrás en [deploy/](deploy/); los pasos
están en [docs/apuntes/fase-13.md](docs/apuntes/fase-13.md).

## Estado

v1.0.0 · fases 0 a 14 construidas. La Fase 13 tiene los archivos listos y verificados en contenedores;
falta ejecutar el despliegue en un Ubuntu 24.04 (WSL 2 o EC2).
