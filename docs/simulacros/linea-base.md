# Línea base: ¿cómo se ve el sistema sano?

La foto de la plataforma `v1.0.0` cuando todo anda bien. En un simulacro o en un incidente, mide lo mismo y compara: lo que no calce con esta página es la primera pista. Es un documento de consulta: se busca la sección que hace falta, no se lee de corrido.

**Medida el 2026-11-25 a las 13:36 UTC (10:36 en Chile),** con los perfiles `completo` y `nodered` arriba y 8 minutos de marcha estable después de arrancar Docker. MTR-01 lo lee el gateway en contenedor, y MTR-02, Node-RED. Las cifras valen para esa configuración.

## De un vistazo

| Qué | Sano | Sección |
|---|---|---|
| Servicios | Los 6 en `Up`; api, mysql y nodered, además, `(healthy)` | 1 |
| `/api/listo` | `listo`, con `db` y `mqtt` en `ok` | 2 |
| Rechazos, fallos y descartadas | 0 | 2 |
| Motores sin datos | 8, siempre los mismos: de MTR-03 a MTR-10 | 2 |
| Memoria de la API | 95 MB | 2 |
| Mensajes por minuto en el broker | 42: 12 de MTR-01 y 30 de MTR-02 | 3 |
| Estado retenido del gateway | `gw-norte` en `online` | 3 |
| Filas por minuto en `lecturas` | 294: 84 de MTR-01 y 210 de MTR-02 | 4 |
| Tamaño de `lecturas` | 201,5 MB y 2.807.769 filas, todas en `p2026_11` | 5 |
| Avisos y errores en el log | Ninguno en marcha normal; 11 en cada arranque de Docker | 6 |

**La cuenta que une las cifras.** Cada mensaje trae las 7 variables del catálogo, y cada variable es una fila. Por eso, filas por minuto = mensajes por minuto × 7: MTR-01, 12 × 7 = 84; MTR-02, 30 × 7 = 210. Si un día no calza, algo se rechaza o se pierde entre el broker y la base.

## Antes de los comandos

Corre todo en Git Bash, desde la raíz del repositorio, con tu `.env` cargado:

```bash
set -a; source .env; set +a      # set -a exporta cada variable que se define; set +a lo apaga
```

Las claves quedan en variables y no se imprimen. En los comandos de MySQL, `$DB_CLAVE` se expande dentro del contenedor. MySQL avisa `[Warning] Using a password on the command line interface can be insecure`: aquí es esperable, y no se copió en las salidas de abajo.

## 1. Servicios

```bash
docker compose ps --format 'table {{.Service}}\t{{.Status}}\t{{.Ports}}'
```

`--format 'table …'` deja solo el servicio, el estado y los puertos; la salida normal es muy ancha.

```
SERVICE     STATUS                   PORTS
api         Up 8 minutes (healthy)   0.0.0.0:3000->3000/tcp, [::]:3000->3000/tcp
gateway     Up 8 minutes             3000/tcp
mosquitto   Up 8 minutes             0.0.0.0:1883->1883/tcp, [::]:1883->1883/tcp
mysql       Up 8 minutes (healthy)   0.0.0.0:3306->3306/tcp, [::]:3306->3306/tcp
nodered     Up 8 minutes (healthy)   127.0.0.1:1880->1880/tcp
simulador   Up 8 minutes             127.0.0.1:5020->5020/tcp
```

**Qué mirar**
- Los seis en `Up`. `(healthy)` solo aparece donde hay healthcheck: api y mysql lo tienen en `docker-compose.yml`, y nodered lo trae su imagen. Que gateway, mosquitto y simulador no lo digan es normal.
- El mismo tiempo en todos: arrancaron juntos. Un servicio con menos tiempo que el resto se reinició, y eso pide mirar su log.
- 3306, 1883 y 3000 abiertos en todas las interfaces; 5020 y 1880, solo en `127.0.0.1`.

## 2. Disponibilidad y métricas de la API

```bash
curl -s localhost:3000/api/listo
```

```
{"estado":"listo","db":"ok","mqtt":"ok"}
```

`/api/metricas` exige un token de `admin`. Se pide como en `docs/COMO-ABORDAR.md`, sección 3.2, y queda en `$TOKEN` sin mostrarse:

```bash
TOKEN=$(curl -s -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' \
  -d "{\"usuario\":\"admin\",\"clave\":\"$CLAVE_ADMIN\"}" \
  | node -pe 'JSON.parse(require("fs").readFileSync(0, "utf8")).token')
curl -s -H "Authorization: Bearer $TOKEN" localhost:3000/api/metricas \
  | node -pe 'JSON.stringify(JSON.parse(require("fs").readFileSync(0, "utf8")), null, 2)'
```

El último `node` solo ordena el JSON en varias líneas, porque este equipo no tiene `jq`.

```json
{
  "mqtt": {
    "mensajes": 342,
    "aceptadas": 2366,
    "rechazos": {}
  },
  "loteador": {
    "pendientes": 0,
    "escritas": 2366,
    "lotes": 289,
    "fallos": 0,
    "descartadas": 0
  },
  "websocketClientes": 0,
  "motoresSinDatos": [
    "MTR-03",
    "MTR-10",
    "MTR-04",
    "MTR-05",
    "MTR-06",
    "MTR-07",
    "MTR-08",
    "MTR-09"
  ],
  "encendidoSeg": 488,
  "memoriaMB": 95
}
```

**Qué mirar**
- `/api/listo` en `listo`. Si dice `no_listo` (HTTP 503), el campo que está en `error` dice qué dependencia falla: la base o el broker.
- `rechazos` vacío, y `fallos` y `descartadas` en 0.
- `pendientes` en 0 o cerca: la cola del loteador se vacía en cada lote. Si crece, MySQL no alcanza a escribir.
- `aceptadas` igual a `escritas`: todo lo que pasó la validación llegó a MySQL.
- Los contadores suman desde que arrancó la API (`encendidoSeg`: 488 s). Para ver un ritmo, mide dos veces con un minuto de diferencia y resta.
- `mensajes` cuenta todo lo que llega, también los estados de los gateways y el mensaje que falló al arrancar (sección 6). Por eso es algo mayor que `aceptadas` / 7.
- `motoresSinDatos`: los 8 equipos activos en la base que ningún gateway lee. MTR-03 solo habla cuando corres `npm run can`. Es ruido conocido; lo anormal sería ver ahí a MTR-01 o a MTR-02.
- `websocketClientes` en 0: nadie tenía el dashboard abierto.

## 3. Mensajes por minuto en el broker

```bash
docker compose exec -T mosquitto mosquitto_sub -u api -P "$MQTT_CLAVE" -t 'motores/#' -v -R -W 60 \
  | awk '{print $1}' | sort | uniq -c
```

- `-v` imprime el tópico antes de cada mensaje. `awk` se queda con el tópico, y `sort | uniq -c` cuenta cuántos llegaron de cada uno.
- `-R` descarta lo retenido, así que solo cuenta lo que llega durante el minuto.
- `-W 60` corta a los 60 s. Por eso termina con `Timed out`, que va a stderr y no es un error.
- Usa el usuario `api`. No desconecta a la API, porque `mosquitto_sub` entra con otro client id.

```
Timed out
     12 motores/norte/MTR-01/telemetria
     30 motores/norte/MTR-02/telemetria
```

**Qué mirar**
- MTR-01, 12 por minuto: el gateway lee cada 5 s (`GATEWAY_PERIODO_MS`, en `src/gateway/gateway.js`). MTR-02, 30: Node-RED lee cada 2 s (`"repeat": "2"`, en `flows/gateway-modbus.json`).
- Nada de `motores/sur/...`: hoy nadie publica en sur.
- Si un equipo baja de su cifra aquí, el problema está antes del broker: en el equipo o en el gateway. Si aquí está bien y en la sección 4 no, está después.

**Lo que el broker guarda.** Sin `-R`, lo retenido llega apenas te suscribes. Es lo primero que ve cualquier sistema que se conecta (medido a las 13:38 UTC):

```bash
docker compose exec -T mosquitto mosquitto_sub -u api -P "$MQTT_CLAVE" \
  -t 'motores/+/gateways/+/estado' -t 'motores/+/alertas' -v -W 3
```

```
motores/norte/gateways/gw-norte/estado online
motores/norte/alertas {"ts":"2026-11-25T13:28:59.061Z","sitio":"norte","motores_sin_datos":["MTR-10","MTR-04","MTR-05","MTR-08"]}
motores/sur/alertas {"ts":"2026-11-25T13:28:59.060Z","sitio":"sur","motores_sin_datos":["MTR-03","MTR-06","MTR-07","MTR-09"]}
Timed out
```

- `gw-norte` en `online`. Si se cae sin despedirse, el broker publica `offline` por él: es su Last Will (Fase 7).
- Node-RED no publica estado: su salud se ve en `docker compose ps` y en los mensajes de MTR-02.
- Cada sitio lista sus 4 equipos sin datos: los mismos de `motoresSinDatos`.

## 4. Filas por minuto en `lecturas`

```bash
docker compose exec -T mysql sh -c 'mysql -t -u telemetria_app -p"$DB_CLAVE" telemetria' <<'SQL'
SELECT DATE_FORMAT(l.recibido_en, '%H:%i') AS minuto_utc, m.codigo AS motor, COUNT(*) AS filas
FROM lecturas l
JOIN motores m ON m.id = l.motor_id
WHERE l.recibido_en >= DATE_FORMAT(UTC_TIMESTAMP() - INTERVAL 5 MINUTE, '%Y-%m-%d %H:%i:00')
  AND l.recibido_en <  DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%d %H:%i:00')
GROUP BY minuto_utc, motor
ORDER BY minuto_utc, motor;
SQL
```

- `docker compose exec -T mysql sh -c '…'` corre el cliente `mysql` dentro del contenedor. `-T` no abre una terminal: hace falta para pasarle el SQL por la entrada estándar. `-t` dibuja la salida como tabla.
- `<<'SQL' … SQL` es un heredoc: entrega las líneas de en medio como entrada del comando. Las comillas en `'SQL'` impiden que Git Bash expanda lo que parezca una variable.
- `recibido_en` es la hora en que la fila llegó a la base; `ts`, la de la lectura en el equipo. Contar por `recibido_en` mide lo que entra ahora, aunque traiga datos atrasados, como un buffer que drena.
- La ventana va desde el minuto exacto de hace 5 minutos hasta el minuto en curso, sin incluirlo: ese todavía se está llenando.

```
+------------+--------+-------+
| minuto_utc | motor  | filas |
+------------+--------+-------+
| 13:31      | MTR-01 |    84 |
| 13:31      | MTR-02 |   210 |
| 13:32      | MTR-01 |    84 |
| 13:32      | MTR-02 |   210 |
| 13:33      | MTR-01 |    84 |
| 13:33      | MTR-02 |   210 |
| 13:34      | MTR-01 |    84 |
| 13:34      | MTR-02 |   210 |
| 13:35      | MTR-01 |    84 |
| 13:35      | MTR-02 |   210 |
+------------+--------+-------+
```

**Qué mirar**
- 84 y 210 por minuto, sin variación: es la cuenta del principio, mensajes × 7.
- Si bajan todos los motores a la vez, mira la ingesta y la base: la API, el loteador y MySQL. Si baja uno solo, mira primero su camino: su gateway y sus mensajes en el broker (sección 3).
- OJO: `recibido_en` no tiene índice, así que la consulta recorre la tabla entera (`type: ALL` en el `EXPLAIN`). Hoy tarda unos 2 s, y tardará más a medida que la tabla crezca.

## 5. Tamaño de cada tabla

```bash
docker compose exec -T mysql sh -c 'mysql -t -u telemetria_app -p"$DB_CLAVE" telemetria' <<'SQL'
SET SESSION information_schema_stats_expiry = 0;
SELECT TABLE_NAME AS tabla, TABLE_ROWS AS filas_aprox,
       ROUND(DATA_LENGTH / 1048576, 1) AS datos_mb, ROUND(INDEX_LENGTH / 1048576, 1) AS indices_mb
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'telemetria'
ORDER BY DATA_LENGTH + INDEX_LENGTH DESC;
SELECT PARTITION_NAME AS particion, PARTITION_DESCRIPTION AS hasta, TABLE_ROWS AS filas_aprox,
       ROUND((DATA_LENGTH + INDEX_LENGTH) / 1048576, 1) AS mb
FROM information_schema.PARTITIONS
WHERE TABLE_SCHEMA = 'telemetria' AND TABLE_NAME = 'lecturas'
ORDER BY PARTITION_ORDINAL_POSITION;
SELECT COUNT(*) AS filas_exactas FROM lecturas;
SQL
```

- `information_schema_stats_expiry = 0`: MySQL 8 guarda estas cifras en caché hasta 24 h (86.400 s); con 0, las lee de nuevo.
- `information_schema.TABLES` da el tamaño de cada tabla, y `PARTITIONS`, el de cada partición de `lecturas`. 1048576 es 1024 × 1024: pasa de bytes a MB.

```
+-------------------+-------------+----------+------------+
| tabla             | filas_aprox | datos_mb | indices_mb |
+-------------------+-------------+----------+------------+
| lecturas          |     2422624 |    125.8 |       75.7 |
| lecturas_hora     |        6772 |      0.4 |        0.0 |
| claves_api        |           2 |      0.0 |        0.0 |
| auditoria_accesos |          25 |      0.0 |        0.0 |
| motores           |          10 |      0.0 |        0.0 |
| usuarios          |           4 |      0.0 |        0.0 |
| sitios            |           2 |      0.0 |        0.0 |
| variables         |           7 |      0.0 |        0.0 |
| estado_actual     |          16 |      0.0 |        0.0 |
+-------------------+-------------+----------+------------+
+-----------+--------------+-------------+-------+
| particion | hasta        | filas_aprox | mb    |
+-----------+--------------+-------------+-------+
| p2026_10  | '2026-11-01' |           0 |   0.0 |
| p2026_11  | '2026-12-01' |     2422624 | 201.3 |
| p2026_12  | '2027-01-01' |           0 |   0.0 |
| p2027_01  | '2027-02-01' |           0 |   0.0 |
| p2027_02  | '2027-03-01' |           0 |   0.0 |
| p_futuro  | MAXVALUE     |           0 |   0.0 |
+-----------+--------------+-------------+-------+
+---------------+
| filas_exactas |
+---------------+
|       2807769 |
+---------------+
```

**Qué mirar**
- `lecturas` es casi todo: 201,5 MB, con 125,8 de datos y 75,7 de índices. Las demás juntas no llegan a 1 MB.
- OJO: `filas_aprox` es una estimación de InnoDB. Dice 2.422.624, y el `COUNT(*)` real es 2.807.769, un 16 % más. Para comparar, usa `filas_exactas`.
- Todas las filas están en `p2026_11`. Las particiones de diciembre a febrero y la reserva `p_futuro` están vacías. Desde el 1 de diciembre a las 00:00 UTC, las filas nuevas caen en `p2026_12`.
- A 294 filas por minuto entran unas 423.000 filas al día. Con unos 75 bytes por fila, índices incluidos, son unos 30 MB diarios.

## 6. Últimos avisos y errores del log

```bash
docker compose logs api gateway --since 24h | grep -E '"nivel":"(aviso|error)"' | cut -c1-210
```

- `--since 24h` deja las últimas 24 horas. En un incidente, acórtalo; por ejemplo, a `--since 30m`.
- `grep -E` deja las líneas de nivel `aviso` o `error`. `cut -c1-210` corta cada línea en 210 caracteres, para que la pila de un error no llene la pantalla.
- OJO: no agregues `2>&1`. `docker compose logs` ya entrega por stdout lo que los contenedores escriben en stderr. Si además juntaras el stderr del propio Docker, un error suyo (por ejemplo, el motor apagado) pasaría por el `grep`, desaparecería, y la salida vacía parecería un sistema sano.
- OJO: el orden entre servicios no es cronológico, porque `docker compose logs` lee cada contenedor por su lado. Guíate por el campo `ts`.

```
gateway-1  | {"ts":"2026-11-25T02:06:58.329Z","nivel":"aviso","evento":"mqtt_sin_enlace","enBuffer":0}
api-1      | {"ts":"2026-11-24T13:53:01.952Z","nivel":"error","evento":"catalogo_carga_fallida","error":{"mensaje":"connect ECONNREFUSED 172.22.0.7:3306","codigo":"ECONNREFUSED","pila":"Error: connect ECONNREFU
api-1      | {"ts":"2026-11-24T13:53:01.955Z","nivel":"error","evento":"detector_silencio_fallido","error":{"mensaje":"connect ECONNREFUSED 172.22.0.7:3306","codigo":"ECONNREFUSED","pila":"Error: connect ECONNR
api-1      | {"ts":"2026-11-24T13:53:01.971Z","nivel":"error","evento":"mqtt_mensaje_fallido","topico":"motores/norte/MTR-01/telemetria","error":{"mensaje":"connect ECONNREFUSED 172.22.0.7:3306","codigo":"ECONN
api-1      | {"ts":"2026-11-24T13:54:01.946Z","nivel":"aviso","evento":"motor_en_silencio","motor":"MTR-03","sitio":"sur","ultimo_dato":"2026-11-16T12:44:17.930Z"}
api-1      | {"ts":"2026-11-24T13:54:01.946Z","nivel":"aviso","evento":"motor_en_silencio","motor":"MTR-10","sitio":"norte","ultimo_dato":null}
api-1      | {"ts":"2026-11-24T13:54:01.946Z","nivel":"aviso","evento":"motor_en_silencio","motor":"MTR-04","sitio":"norte","ultimo_dato":null}
api-1      | {"ts":"2026-11-24T13:54:01.946Z","nivel":"aviso","evento":"motor_en_silencio","motor":"MTR-05","sitio":"norte","ultimo_dato":null}
api-1      | {"ts":"2026-11-24T13:54:01.946Z","nivel":"aviso","evento":"motor_en_silencio","motor":"MTR-06","sitio":"sur","ultimo_dato":null}
api-1      | {"ts":"2026-11-24T13:54:01.946Z","nivel":"aviso","evento":"motor_en_silencio","motor":"MTR-07","sitio":"sur","ultimo_dato":null}
api-1      | {"ts":"2026-11-24T13:54:01.946Z","nivel":"aviso","evento":"motor_en_silencio","motor":"MTR-08","sitio":"norte","ultimo_dato":null}
api-1      | {"ts":"2026-11-24T13:54:01.946Z","nivel":"aviso","evento":"motor_en_silencio","motor":"MTR-09","sitio":"sur","ultimo_dato":null}
api-1      | {"ts":"2026-11-25T02:06:58.286Z","nivel":"error","evento":"mqtt_error","error":{"mensaje":"write ECONNRESET","codigo":"ECONNRESET","pila":"Error: write ECONNRESET\n    at afterWriteDispatched (node
api-1      | {"ts":"2026-11-25T13:27:59.068Z","nivel":"error","evento":"catalogo_carga_fallida","error":{"mensaje":"connect ECONNREFUSED 172.22.0.7:3306","codigo":"ECONNREFUSED","pila":"Error: connect ECONNREFU
api-1      | {"ts":"2026-11-25T13:27:59.069Z","nivel":"error","evento":"detector_silencio_fallido","error":{"mensaje":"connect ECONNREFUSED 172.22.0.7:3306","codigo":"ECONNREFUSED","pila":"Error: connect ECONNR
api-1      | {"ts":"2026-11-25T13:27:59.088Z","nivel":"error","evento":"mqtt_mensaje_fallido","topico":"motores/norte/MTR-01/telemetria","error":{"mensaje":"connect ECONNREFUSED 172.22.0.7:3306","codigo":"ECONN
api-1      | {"ts":"2026-11-25T13:28:59.060Z","nivel":"aviso","evento":"motor_en_silencio","motor":"MTR-03","sitio":"sur","ultimo_dato":"2026-11-16T12:44:17.930Z"}
api-1      | {"ts":"2026-11-25T13:28:59.060Z","nivel":"aviso","evento":"motor_en_silencio","motor":"MTR-10","sitio":"norte","ultimo_dato":null}
api-1      | {"ts":"2026-11-25T13:28:59.060Z","nivel":"aviso","evento":"motor_en_silencio","motor":"MTR-04","sitio":"norte","ultimo_dato":null}
api-1      | {"ts":"2026-11-25T13:28:59.060Z","nivel":"aviso","evento":"motor_en_silencio","motor":"MTR-05","sitio":"norte","ultimo_dato":null}
api-1      | {"ts":"2026-11-25T13:28:59.060Z","nivel":"aviso","evento":"motor_en_silencio","motor":"MTR-06","sitio":"sur","ultimo_dato":null}
api-1      | {"ts":"2026-11-25T13:28:59.060Z","nivel":"aviso","evento":"motor_en_silencio","motor":"MTR-07","sitio":"sur","ultimo_dato":null}
api-1      | {"ts":"2026-11-25T13:28:59.060Z","nivel":"aviso","evento":"motor_en_silencio","motor":"MTR-08","sitio":"norte","ultimo_dato":null}
api-1      | {"ts":"2026-11-25T13:28:59.060Z","nivel":"aviso","evento":"motor_en_silencio","motor":"MTR-09","sitio":"sur","ultimo_dato":null}
```

**Qué mirar.** En marcha normal, el log no tiene avisos ni errores: entre un arranque y el siguiente no aparece ninguno. Los 24 de estas 24 horas vienen de dos arranques de Docker y de un apagado:

| Cuándo (UTC) | Qué | Por qué |
|---|---|---|
| 24-11 13:53 y 25-11 13:27, al arrancar | 3 `error` con `ECONNREFUSED …:3306`: `catalogo_carga_fallida`, `detector_silencio_fallido` y `mqtt_mensaje_fallido` | Al abrir Docker Desktop, Docker reinicia todos los contenedores a la vez, por su `restart: unless-stopped`, y no espera a nadie. El `depends_on` de `docker-compose.yml`, que hace esperar a la API hasta que MySQL esté `healthy`, solo lo aplica `docker compose up`. La API le pregunta a MySQL antes de que acepte conexiones. |
| Un minuto después de cada arranque | 8 `aviso` `motor_en_silencio`, de MTR-03 a MTR-10 | El detector avisa solo cuando un equipo cambia de estado, pero guarda los estados en memoria: al arrancar, todos los silencios parecen nuevos. Son los 8 equipos sin gateway: ruido conocido. |
| 25-11 02:06:58 | `mqtt_sin_enlace` del gateway y `mqtt_error` `ECONNRESET` de la API, en el mismo segundo | Todo se detuvo a la vez (23:06 del 24 en Chile): no hay más avisos ni errores hasta el arranque del 25. Por eso MTR-01 no tiene lecturas entre las 02:06:53.930 y las 13:28:02.952. No es una pérdida de la plataforma: el simulador también estaba apagado, así que no había nada que leer. |

**Un mensaje perdido en cada arranque.** `mqtt_mensaje_fallido` es un mensaje de MTR-01 que falló antes de llegar al loteador. mqtt.js ya lo había confirmado al broker (ver el OJO de `src/api/ingesta-mqtt.js`, línea 70), así que nadie lo reenvía: sus 7 lecturas no existen. Pasó en los dos arranques. Si en un simulacro aparece `mqtt_mensaje_fallido` sin un arranque de por medio, ya no es ruido.

## Cuándo medir de nuevo

- Cuando cambie la configuración: otro perfil, más equipos, otro `GATEWAY_EQUIPOS` o una imagen nueva.
- Cuando una fase cambie el camino del dato; por ejemplo, la flota simulada de la Fase 18.
- Actualiza esta página con la fecha nueva. La versión anterior queda en Git: `git log -p docs/simulacros/linea-base.md`.
