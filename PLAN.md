# Plan de práctica · Plataforma de telemetría de motores

Vas a construir a mano, pieza por pieza, una plataforma de datos industriales con todo lo que pide el cargo de Back-end Developer para Datos Industriales:

- un controlador Modbus simulado y un gateway que no pierde datos;
- un broker MQTT;
- una API en Node.js con roles y auditoría, y tiempo real;
- SQL con millones de filas;
- Docker y un despliegue en Linux.

Cada fase termina en algo que funciona y que puedes mostrar.

## Cómo trabajar

El agente de código (Codex o Claude Code) escribe la aplicación siguiendo este plan y `AGENTS.md`, con comentarios que explican cada función, cada comando y el porqué de cada decisión. Tú aprendes con este ciclo en cada paso:

1. **Lee antes de ejecutar,** en el orden que indica el bloque *Para estudiar*: primero el encabezado y las firmas de las funciones, después el detalle.
2. **Ejecuta tú la verificación** y compárala con la salida esperada del plan.
3. **No avances con dudas:** pregunta con `explica` o `por qué`.
4. **Responde en voz alta la pregunta de entrevista** de la fase, en menos de un minuto.
5. **Cierra la fase con su apunte** (`docs/apuntes/fase-NN.md`), que también puedes importar a Notion. Sus dos ejercicios a mano los puedes dejar para después.
6. **El flujo de Git lo haces tú** (rama, commit, PR, merge y tag), porque también es parte de lo que practicas. Está en la Fase 1.

Las palabras clave están definidas en `AGENTS.md`: `implementa`, `implementa la fase`, `explica`, `por qué`, `pregúntame`, `ejercicio` y `cierra la fase`. Los prompts para arrancar están en `PROMPTS.md`.

**Solución de referencia:** `../lab-telemetria-motores/`, si la consigues. Hoy no está en el equipo, así que el agente construye sin ella; la tabla del final dice qué archivo corresponde a cada fase.

**Tu caso.** El repositorio es `Huamagod1/Proyecto_backend` (público) y vive en `F:\1. Proyectos personales\Developer Apis\Detroit`. Desarrollas en Windows 11 con Git Bash; los servicios corren en contenedores Linux y el despliegue de la Fase 13 se hace en Ubuntu 24.04 (WSL 2 o EC2).

## Lo que vas a construir

```
Simulador Modbus (MTR-01, MTR-02) ──Modbus TCP──> Gateway Node (buffer SQLite) ──┐
Log CAN J1939 (MTR-03) ──────────> decodificador J1939 ──────────────────────────┤  MQTT QoS 1
Node-RED (el mismo gateway, en bloques) ─────────────────────────────────────────┤
                                                                                  ▼
                                                                    Mosquitto (broker MQTT)
                                                                                  │
                                                                                  ▼
               API Node.js + Express 5: ingesta MQTT y HTTP, validación, JWT, roles, auditoría
                                                                                  │
                                          MySQL 8 (lecturas, estado, auditoría) ◄─┤
                                                                                  ▼
                                    WebSocket ──> Dashboard      API de integración ──> SCADA / EMS
```

Todo corre en Docker Compose y, al final, como servicios systemd detrás de nginx en Ubuntu.

## Requisito del cargo y dónde lo practicas

| Requisito del aviso | Fases |
|---|---|
| JavaScript / Node.js | 3 a 9 |
| APIs de ingestión, validación, consulta y exposición | 3, 5, 14 |
| MySQL y SQLite: modelado, consultas y mantenimiento | 2, 7, 11 |
| Autenticación, seguridad, roles y trazabilidad de accesos | 4, 6, 14 |
| Datos en tiempo real: procesar, almacenar y consultar | 6, 7, 9 |
| Servicios en servidores Linux | 13 |
| Git y control de versiones | 1 y todas |
| Express.js y JSON | 3 a 5 |
| Node-RED | 10 |
| WebSocket | 9 |
| Modbus TCP/IP y RS485 | 7 |
| CAN | 8 |
| MQTT | 6, 7 |
| Integración con SCADA y EMS | 14 |
| Docker | 2, 12 |
| Optimización SQL y grandes volúmenes | 11 |

## Avance

- [ ] Fase 0 · Entorno de trabajo (1 h)
- [x] Fase 1 · Git y esqueleto del proyecto (1 h)
- [x] Fase 2 · MySQL: modelo de datos y consultas (2–3 h)
- [x] Fase 3 · API base con Express (2–3 h)
- [x] Fase 4 · Seguridad: login, roles, permiso por sitio y auditoría (3 h)
- [x] Fase 5 · Ingesta HTTP: validar y no duplicar (2 h)
- [x] Fase 6 · MQTT: broker, tópicos y loteador (3 h)
- [x] Fase 7 · Terreno: simulador Modbus y gateway con buffer (3–4 h)
- [x] Fase 8 · CAN y J1939: decodificar tramas del motor (1–2 h)
- [x] Fase 9 · Tiempo real: WebSocket y dashboard (2–3 h)
- [x] Fase 10 · Node-RED: el gateway en bloques (1–2 h)
- [x] Fase 11 · SQL con volumen: millones de filas (3 h)
- [x] Fase 12 · Docker: todo con un comando (2 h)
- [ ] Fase 13 · Linux: despliegue como servicio (3 h) · archivos listos y verificados en contenedores; falta ejecutarlo en Ubuntu
- [ ] Fase 14 · Operación e integración con SCADA/EMS (2 h)

El plan completo toma unas 35 horas. **Ruta corta** (unas 22 horas): fases 0 a 7, más la 13. Es lo que más se pregunta en una entrevista técnica para este cargo.

## Estructura final del repositorio

```
Proyecto_backend/     (en tu equipo: F:\1. Proyectos personales\Developer Apis\Detroit)
├── AGENTS.md · CLAUDE.md · PLAN.md · PROMPTS.md · PROGRESO.md · README.md
├── .env.example · .gitignore · .gitattributes · .dockerignore · package.json
├── .vscode/          settings.json (saltos de línea LF y Git Bash como terminal)
├── docker-compose.yml · Dockerfile
├── mosquitto/        mosquitto.conf, acl
├── sql/              001_esquema.sql, 002_datos_iniciales.sql, 003_usuario_app.sh (corren al crear la base)
├── src/
│   ├── comun/        config.js, log.js, errores.js, validacion.js, decodificacion.js, j1939.js
│   ├── api/          app.js, server.js, db.js, auth.js, auditoria.js, catalogo.js, repositorio.js,
│   │                 loteador.js, ingesta-mqtt.js, tiempo-real.js, rutas/
│   ├── gateway/      gateway.js, buffer-local.js
│   ├── simulador/    motor-modbus.js
│   └── scripts/      sembrar-usuarios.js, preparar-db-test.sh, can-a-mqtt.js, generar-volumen.js
├── public/           index.html, app.js, estilos.css
├── practica/         consultas.sql, rendimiento.sql, lote-ejemplo.json, candump-ejemplo.log
├── test/             *.test.js
├── flows/            gateway-modbus.json (Node-RED)
├── deploy/           servicios systemd, nginx, respaldo.sh, desplegar.sh
└── docs/             apuntes/ (uno por fase), topicos.md, rs485.md, j1939.md, rendimiento.md, decisiones.md, RUNBOOK.md
```

---

## Fase 0 · Entorno de trabajo

**Objetivo:** Windows 11 con Git Bash, Node LTS, Docker Desktop, Git con GitHub por SSH, VS Code y el agente de código (Claude Code o Codex), listo para las fases 1 a 12. El Linux de verdad llega en la Fase 13.
**Tiempo:** 1 hora.

**La idea.** Es calibrar las herramientas antes de la obra. Trabajas en Windows, pero con una terminal bash (Git Bash) y con los servicios (MySQL, Mosquitto, Node-RED) en contenedores Linux. El despliegue de la Fase 13 se hace en un Ubuntu real.

**Pasos**

1. Terminal: en VS Code, *Ctrl+Shift+P* → *Terminal: Select Default Profile* → **Git Bash**. Todos los comandos del plan son bash. En PowerShell 5.1, `curl` es un alias de `Invoke-WebRequest`, y las comillas, `$(...)` y `\` no funcionan igual.
2. Node LTS (la 26), en el canal LTS de winget:
   ```bash
   winget install -e --id OpenJS.NodeJS.LTS
   ```
   Reemplaza la versión anterior; si winget avisa un conflicto, primero `winget uninstall -e --id OpenJS.NodeJS`. Cierra y abre la terminal.
3. Utilidades: `winget install -e --id jqlang.jq`. curl y openssl ya vienen con Git Bash. Los clientes `mysql`, `mosquitto_pub` y `mosquitto_sub` se usan dentro de sus contenedores (`docker compose exec ...`), así que no instalas nada más.
4. Evita que Git Bash reescriba las rutas de Linux al llamar a programas de Windows como `docker`:
   ```bash
   echo 'export MSYS_NO_PATHCONV=1' >> ~/.bashrc && source ~/.bashrc
   ```
   Sin esto, `/mosquitto/config/passwd` le llega a docker como `C:/Program Files/Git/mosquitto/config/passwd`.
5. Docker Desktop: ábrelo y espera *Engine running*. Usa el motor WSL 2 (*Settings* → *General*); la integración con las distros de WSL recién hace falta en la Fase 13.
6. VS Code: el repositorio trae `.vscode/settings.json`, con saltos de línea LF y Git Bash como terminal. Abre la carpeta con `code .`.
7. GitHub por SSH, con la cuenta dueña del repositorio (Huamagod1):
   ```bash
   cat ~/.ssh/id_ed25519.pub   # pégala en GitHub → Settings → SSH and GPG keys → New SSH key
   ssh -T git@github.com       # debe decir: Hi Huamagod1!
   ```
   Si no tienes llave, créala con `ssh-keygen -t ed25519`. OJO: tu `gh` tiene la sesión de otra cuenta (FernandoH98), así que `gh ssh-key add` agregaría la llave allá.
8. El agente: Claude Code ya está instalado (`claude --version`). Codex es opcional: `npm install -g @openai/codex`.
9. La carpeta del proyecto es `F:\1. Proyectos personales\Developer Apis\Detroit` (en Git Bash, `/f/1. Proyectos personales/Developer Apis/Detroit`). Tiene espacios: escríbela siempre entre comillas.

**Verifica**

| Comando | Esperado |
|---|---|
| `uname -s` | `MINGW64_NT-...` (estás en Git Bash) |
| `node -v` | v26.x (mínimo v22.13) |
| `jq --version` | `jq-1.x` |
| `docker run --rm hello-world` | `Hello from Docker!` |
| `docker compose version` | `Docker Compose version v2...` |
| `echo $MSYS_NO_PATHCONV` | `1` |
| `ssh -T git@github.com` | `Hi Huamagod1!` |
| `claude --version` o `codex --version` | un número de versión |

**La dominas si…**
- [ ] Sabes qué corre en Windows (Node, Git y tu código) y qué corre en Linux (los contenedores y, en la Fase 13, el servicio).
- [ ] Explicas los tres roces entre Windows y Linux: los saltos de línea (CRLF y LF), las rutas y las señales (`SIGTERM`).

**Pregunta de entrevista.** *"¿Por qué desarrollas en Windows si el servicio corre en Linux?"* Porque el código Node es multiplataforma y las dependencias corren en contenedores Linux, iguales a producción. Los roces los controlo: los saltos de línea con `.gitattributes`, las rutas con `node:path` y las señales probando el apagado en Docker y systemd. Antes de producción lo despliego en un Ubuntu real.

---

## Fase 1 · Git y esqueleto del proyecto

**Objetivo:** repositorio en GitHub con la estructura, los scripts y el flujo de trabajo que usarás en todas las fases.
**Tiempo:** 1 hora.

**La idea.** Git es la bitácora de mantención del código: cada commit es una intervención con fecha, autor y motivo. Una rama es un trabajo en el taller que no toca el equipo en operación hasta que se aprueba (el PR) y se instala (el merge).

**Pasos**

1. Ya está hecho: la carpeta `Detroit` con `PLAN.md`, `AGENTS.md`, `CLAUDE.md` y `PROMPTS.md`, el repositorio local (`git init -b main`), el primer commit y el remoto `origin` → `git@github.com:Huamagod1/Proyecto_backend.git`.
2. Inicializa Node como ES modules, con un script de pruebas:
   ```bash
   npm init -y
   npm pkg set type=module
   npm pkg set engines.node=">=22.13"
   npm pkg set scripts.test="node --test"
   ```
3. Crea las carpetas: `mkdir -p src/{comun,api/rutas,gateway,simulador,scripts} sql test public practica deploy docs flows mosquitto`.
4. Escribe `.gitignore` con `node_modules/`, `.env`, `.env.*`, `!.env.example`, `*.sqlite`, `datos/` y `mosquitto/passwd`: tu repositorio es público y ese archivo guarda los hashes de las claves del broker. `.gitattributes` (`* text=auto eol=lf`) ya existe: fija los saltos de línea en LF aunque trabajes en Windows.
5. Escribe `.env.example`, con las variables que irás usando y sin claves reales:
   ```ini
   PUERTO=3000
   JWT_SECRETO=cambia-esto-por-32-caracteres-o-mas
   MYSQL_ROOT_PASSWORD=cambia-esta-clave-de-root
   DB_HOST=127.0.0.1
   DB_PUERTO=3306
   DB_USUARIO=telemetria_app
   DB_CLAVE=cambia-esta-clave
   DB_NOMBRE=telemetria
   MQTT_URL=mqtt://127.0.0.1:1883
   ```
   Cópialo a `.env` (`cp .env.example .env`) y pon tus valores.
6. Escribe un `README.md` corto: qué es, cómo levantarlo (lo completarás en cada fase) y en qué fase vas.
7. El repositorio ya existe en GitHub: `Huamagod1/Proyecto_backend`, **público**. Sirve de portafolio, pero cualquiera puede leer lo que subas: por eso `.env` nunca se sube y las claves de laboratorio salen de `.env` (fases 2 y 6). Sube el esqueleto:
   ```bash
   git add . && git commit -m "chore: esqueleto del proyecto"
   git push -u origin main
   ```
   Para abrir PR con `gh`, inicia sesión también con Huamagod1 (`gh auth login`) y cambia de cuenta con `gh auth switch`.
8. Este es el flujo que repetirás en cada fase:
   ```bash
   git switch -c fase-02-mysql        # una rama por fase
   # commits pequeños: feat:, fix:, test:, docs:, chore:, refactor:, perf:
   git push -u origin fase-02-mysql   # abre el PR en GitHub, revísalo y haz merge
   git switch main && git pull
   git tag -a fase-02 -m "Fase 2: MySQL" && git push --tags
   ```

**Verifica:** `git log --oneline` muestra tu commit, `git status` dice *nothing to commit*, el repositorio aparece en GitHub y `.env` **no** está subido.

**La dominas si…**
- [ ] Explicas la diferencia entre commit, rama, merge, PR y tag.
- [ ] Sabes qué hacer si subiste un secreto por error: cambiar la clave, porque queda en el historial aunque borres el archivo.

**Pregunta de entrevista.** *"¿Cómo trabajas con Git en equipo?"* Ramas cortas por tarea, commits pequeños que explican el porqué, PR con revisión antes de integrar, nunca secretos en el repositorio y tags en lo que se despliega, para poder volver atrás.

**Cierre:** tag `fase-01`.

---

## Fase 2 · MySQL: modelo de datos y consultas

**Objetivo:** base `telemetria` en Docker, con el esquema, los datos iniciales, un usuario de permisos mínimos y cinco consultas clave.
**Tiempo:** 2 a 3 horas.

**La idea.** La tabla `lecturas` es un historiador, como el PI System que conoces. Guarda una fila por motor, variable e instante, en el mismo orden en que se consulta (motor → variable → tiempo), para leer rangos de tiempo muy rápido.

**Construyes:** `docker-compose.yml` (solo MySQL por ahora), `sql/001_esquema.sql`, `sql/002_datos_iniciales.sql`, `sql/003_usuario_app.sh` y `practica/consultas.sql`.

**Pasos**

1. Escribe `docker-compose.yml` con un servicio `mysql`:
   - imagen `mysql:8.4`, con `MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}` (Compose la lee de tu `.env`), `MYSQL_DATABASE: telemetria` y `DB_CLAVE: ${DB_CLAVE}`, que usa el script del paso 4;
   - zona horaria UTC: `TZ: UTC` y `command: ["--default-time-zone=+00:00"]`;
   - el puerto `3306:3306` y un volumen con nombre para los datos;
   - `./sql` montado en `/docker-entrypoint-initdb.d`. MySQL ejecuta esos archivos en orden alfabético, **solo** al crear la base. Por eso las consultas de práctica van en `practica/` y no en `sql/`;
   - un `healthcheck` con `mysqladmin ping` (en Compose, `$$MYSQL_ROOT_PASSWORD` lleva doble `$`).
2. Escribe `001_esquema.sql`, con todas las tablas en InnoDB y las fechas en `DATETIME(3)` y UTC:

   | Tabla | Columnas | Claves |
   |---|---|---|
   | `sitios` | id, codigo (`norte`), nombre | PK id, codigo único |
   | `motores` | id, codigo (`MTR-01`), modelo, sitio_id, activo | PK id, codigo único, FK a sitios |
   | `variables` | id, codigo (`rpm`), descripcion, unidad, minimo, maximo | PK id, codigo único |
   | `usuarios` | id, usuario, password_hash `CHAR(60)`, rol `ENUM('admin','ingeniero','lector','gateway')`, sitio_id (NULL = todos), activo, creado_en | PK id, usuario único |
   | `auditoria_accesos` | id, ts, usuario_id, usuario, rol, metodo, recurso, estado_http, ip, duracion_ms | PK id, índices (ts) y (usuario_id, ts) |
   | `lecturas` | motor_id, variable_id, ts, valor `DOUBLE`, calidad (0 buena, 1 fuera de rango), recibido_en | **PK (motor_id, variable_id, ts)**, sin FK |
   | `estado_actual` | motor_id, variable_id, ts, valor, calidad | PK (motor_id, variable_id) |

3. Escribe `002_datos_iniciales.sql`:
   - los sitios `norte` y `sur`;
   - los motores `MTR-01` y `MTR-02` en norte, y `MTR-03` en sur;
   - las variables, con unidad y rango: `rpm` (0–3000), `temp_refrigerante` (−40–150 °C), `presion_aceite` (0–1000 kPa), `voltaje_bateria` (0–36 V), `carga` (0–110 %), `horas_motor` (0–200000 h) y `alarmas` (0–65535).
4. Escribe `003_usuario_app.sh`, que crea el usuario `telemetria_app` con **solo** lo que necesita la API.
   - `SELECT` en sitios y variables.
   - `SELECT, INSERT, UPDATE` en motores, usuarios, lecturas y estado_actual. El `UPDATE` lo exige `INSERT ... ON DUPLICATE KEY UPDATE`.
   - `SELECT, INSERT` en auditoria_accesos: la auditoría nunca se modifica ni se borra.

   La clave sale de `DB_CLAVE` de tu `.env`: Compose se la pasa al contenedor, y MySQL también ejecuta los `.sh` de `/docker-entrypoint-initdb.d`. Así la clave no queda escrita en tu repositorio público.
5. Levanta la base con `docker compose up -d` y espera a que `docker compose ps` diga *healthy*. Conéctate con el cliente del contenedor: `docker compose exec mysql mysql -u telemetria_app -p telemetria`. También sirve el de tu MySQL 9.3, si agregas `C:\Program Files\MySQL\MySQL Server 9.3\bin` al PATH.
6. Inserta a mano unas 10 lecturas de MTR-01 de los últimos 10 minutos. Después escribe estas cinco consultas en `practica/consultas.sql`:
   1. el último valor de cada variable de MTR-01, desde `estado_actual`, con el nombre y la unidad de la variable;
   2. las rpm de MTR-01 en la última hora;
   3. el promedio de rpm por minuto en la última hora;
   4. los motores sin datos en los últimos 5 minutos, incluidos los que nunca enviaron;
   5. cuántas lecturas fuera de rango tuvo cada motor hoy.
7. Ejecuta `EXPLAIN` sobre la consulta 2 y confirma que usa la clave primaria.

**Verifica**
- `docker compose ps` → mysql *healthy*.
- Como root, `SHOW GRANTS FOR 'telemetria_app'@'%';` muestra solo los permisos del paso 4.
- `EXPLAIN` de la consulta 2 → `key: PRIMARY` y `type: range`.
- Con `telemetria_app`, `DELETE FROM auditoria_accesos;` falla con *DELETE command denied*.

**La dominas si…**
- [ ] Explicas por qué la PK de `lecturas` es (motor_id, variable_id, ts) y los dos trabajos que hace: orden físico e idempotencia.
- [ ] Explicas por qué `lecturas` no tiene claves foráneas: alto volumen y particiones.
- [ ] Explicas por qué todo va en UTC.

**Pregunta de entrevista.** *"¿Cómo modelarías datos de sensores en MySQL?"* Una tabla angosta con PK compuesta (motor, variable, tiempo) y fechas en UTC. Además, una tabla chica con el último valor para el dashboard, el rango válido de cada variable en un catálogo y, cuando crece, particiones por mes.

**Cierre:** `feat(db): esquema, datos iniciales y usuario con permisos mínimos` · tag `fase-02`.

---

## Fase 3 · API base con Express

**Objetivo:** una API ordenada, con configuración, conexión a MySQL, manejo central de errores, `/api/salud` y un CRUD de motores validado y con pruebas.
**Tiempo:** 2 a 3 horas.

**La idea.** Express es una cadena de filtros, como Spring Security en FlowSense: cada middleware revisa o transforma la petición y la pasa al siguiente. El orden de la cadena importa.

**Construyes:** `src/comun/config.js`, `src/comun/errores.js`, `src/api/db.js`, `src/api/app.js`, `src/api/server.js`, `src/api/rutas/motores.js`, `src/scripts/preparar-db-test.sh` y `test/motores.test.js`.

**Pasos**

1. `npm install express@5 mysql2 zod` y `npm install -D supertest`.
2. Scripts que leen `.env` sin librerías extra, porque Node trae `--env-file`:
   ```bash
   npm pkg set scripts.api="node --env-file=.env src/api/server.js"
   npm pkg set scripts.api:dev="node --env-file=.env --watch src/api/server.js"
   npm pkg set scripts.test="node --env-file=.env.test --test"
   ```
3. `config.js`: exporta la configuración leída de `process.env`, con valores por defecto donde tengan sentido. Si falta algo obligatorio, como `DB_CLAVE`, **termina al arrancar con un mensaje claro**, no en la primera petición.
4. `errores.js`: una clase `ErrorHttp(estado, mensaje, detalle)` para los errores esperados (404, 409, 422).
5. `db.js`: un pool de `mysql2/promise` con `timezone: 'Z'` y `connectionLimit: 10`, y una función `cerrarPool()`.
6. `app.js` exporta `crearApp()`, sin `listen`, para que las pruebas la usen sin abrir un puerto. Arma la cadena en este orden:
   - `express.json({ limit: '1mb' })`;
   - `GET /api/salud` → `{ estado: 'ok', db: 'ok' }`, o `db: 'error'` con estado 503 si `SELECT 1` falla;
   - las rutas de motores;
   - un 404 para las rutas desconocidas;
   - **al final**, el middleware de errores, con cuatro parámetros:
     - un `ErrorHttp` responde con su estado;
     - el JSON mal formado responde 400;
     - cualquier otro error responde 500 sin detalles internos, y el error completo va al log.
7. `server.js`: arranca en `PUERTO` y hace un apagado ordenado con `SIGINT` y `SIGTERM`: deja de aceptar conexiones y después cierra el pool. En Windows lo pruebas con Ctrl+C (`SIGINT`): `SIGTERM` entre procesos no existe en Windows, así que lo pruebas en Docker (Fase 12) y en systemd (Fase 13).
8. `rutas/motores.js`, siempre con SQL parametrizado (`?`):

   | Método y ruta | Hace | Respuestas |
   |---|---|---|
   | `GET /api/motores` | lista los activos, con el código del sitio | 200 |
   | `GET /api/motores/:codigo` | uno | 200, 404 |
   | `POST /api/motores` | crea; `codigo` debe calzar con `^MTR-\d{2,4}$` | 201 con encabezado `Location`, 409 si el código existe, 422 si no valida |
   | `PUT /api/motores/:codigo` | actualiza el modelo y el sitio | 200, 404, 422 |
   | `DELETE /api/motores/:codigo` | baja lógica (`activo = 0`) | 204, 404 |

   El 409 sale del error `ER_DUP_ENTRY` de MySQL. No consultes antes si existe: con dos peticiones simultáneas, las dos pasarían el chequeo.
9. Una base aparte para las pruebas. Escribe `preparar-db-test.sh`, que como root:
   - recrea la base `telemetria_test`;
   - carga `001` y `002`;
   - da permisos a `telemetria_app` sobre `telemetria_test.*`.

   Ejecuta los comandos dentro del contenedor, donde `MYSQL_ROOT_PASSWORD` ya existe:
   ```bash
   docker compose exec -T mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" ...'
   ```
   Crea un `.env.test` igual a `.env`, pero con `DB_NOMBRE=telemetria_test`.
10. `test/motores.test.js`, con `node:test` y `supertest`: un caso por fila de la tabla del paso 8. Cierra el pool en `after()` para que el proceso de pruebas termine.

**Verifica**
```bash
npm run api:dev
curl -s localhost:3000/api/salud | jq
curl -si -X POST localhost:3000/api/motores -H 'Content-Type: application/json' \
  -d '{"codigo":"MTR-10","modelo":"12V4000","sitio_id":1}'     # 201 con Location
# el mismo POST otra vez                                         # 409
curl -si -X POST localhost:3000/api/motores -H 'Content-Type: application/json' -d '{"codigo":"X"}'   # 422
curl -si -X POST localhost:3000/api/motores -H 'Content-Type: application/json' -d '{"codigo":'      # 400
bash src/scripts/preparar-db-test.sh && npm test                # todas pasan
```

**La dominas si…**
- [ ] Explicas por qué `crearApp()` va separado de `listen()`.
- [ ] Explicas qué pasa con un error dentro de una ruta `async` en Express 5: llega solo al middleware de errores.
- [ ] Explicas por qué el 409 sale de la restricción única y no de un SELECT previo.

**Pregunta de entrevista.** *"¿Cómo manejas los errores en una API?"* Con un middleware central. Los errores esperados salen con su estado y un mensaje claro; los inesperados, como 500 sin detalles internos y con todo el detalle en el log. La validación de entrada va en cada ruta, con zod.

**Cierre:** `feat(api): base de Express y CRUD de motores con validación` · tag `fase-03`.

---

## Fase 4 · Seguridad: login, roles, permiso por sitio y auditoría

**Objetivo:** que solo entre quien debe, que cada usuario vea solo lo suyo y que quede registro de cada acceso.
**Tiempo:** 3 horas.

**La idea.** Es el control de acceso de una faena. El guardia revisa tu credencial (autenticar). La credencial dice a qué áreas puedes entrar (autorizar por rol) y en qué faena (permiso por sitio). En cada puerta queda anotado quién pasó y a qué hora (auditoría).

**Construyes:** `src/scripts/sembrar-usuarios.js`, `src/api/auth.js`, `src/api/rutas/auth.js`, `src/api/auditoria.js`, `src/api/rutas/auditoria.js` y `test/seguridad.test.js`.

**Pasos**

1. `npm install jsonwebtoken bcryptjs helmet express-rate-limit`. Pon en `JWT_SECRETO` de tu `.env` un secreto de 32 caracteres o más (`openssl rand -base64 48`).
2. `sembrar-usuarios.js` crea o actualiza cuatro usuarios con `INSERT ... ON DUPLICATE KEY UPDATE`, con la contraseña en hash bcrypt de costo 12:

   | Usuario | Rol | Sitio |
   |---|---|---|
   | `admin` | admin | todos (NULL) |
   | `ing-norte` | ingeniero | norte |
   | `lector-sur` | lector | sur |
   | `gw-norte` | gateway | norte |

   Las contraseñas vienen de variables de entorno; nunca quedan escritas en el código.
3. `auth.js`:
   - `firmarToken(usuario)` → un JWT HS256 que vence en 15 minutos, con `sub`, `rol` y `sitio`;
   - `verificarToken(token)`, con `algorithms: ['HS256']` explícito, para rechazar un token con `alg: none`;
   - el middleware `autenticar`, que lee `Authorization: Bearer ...` y deja `req.usuario`; si el token falta o no sirve, 401;
   - `autorizar(...roles)`, que responde 403 si el rol no está en la lista;
   - `puedeVerSitio(usuario, sitioId)`: el admin ve todo y el resto, solo su sitio.
4. `POST /api/auth/login`:
   - valida el cuerpo con zod, busca el usuario y compara con `bcrypt.compare`;
   - si el usuario no existe o la clave está mal, responde **el mismo** 401 ("Usuario o contraseña incorrectos"), para no revelar qué usuarios existen;
   - limita a 5 intentos fallidos cada 15 minutos con `express-rate-limit` y `skipSuccessfulRequests: true`.
5. Protege las rutas de motores:
   - leer: cualquier usuario autenticado, filtrando por su sitio;
   - crear, editar o dar de baja: `admin` o `ingeniero`, y el ingeniero solo en su sitio;
   - un motor de otro sitio responde 404, como si no existiera, para no confirmar que existe.
6. `auditoria.js`: un middleware que, en `res.on('finish')`, inserta quién, el método, el recurso, el estado, la IP y cuánto tardó. Si el INSERT falla, lo deja en el log, pero nunca rompe la respuesta. Regístralo antes de las rutas.
7. `GET /api/auditoria` (solo admin), con filtros `usuario`, `desde` y `hasta`, y páginas de 50.
8. `app.use(helmet())` para los encabezados de seguridad.
9. Pruebas en `seguridad.test.js`:
   - sin token → 401;
   - token alterado → 401;
   - token con `alg: none` → 401;
   - un lector intenta crear un motor → 403;
   - `ing-norte` pide un motor de sur → 404;
   - 6 logins fallidos seguidos → el sexto da 429;
   - el 403 queda registrado en la auditoría.

**Verifica**
```bash
TOKEN=$(curl -s -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"usuario":"ing-norte","clave":"<tu-clave>"}' | jq -r .token)
curl -s localhost:3000/api/motores -H "Authorization: Bearer $TOKEN" | jq   # solo motores de norte
curl -si localhost:3000/api/motores                                        # 401
```
En MySQL: `SELECT usuario, metodo, recurso, estado_http FROM auditoria_accesos ORDER BY id DESC LIMIT 5;`

**La dominas si…**
- [ ] Explicas la diferencia entre autenticar, autorizar por rol y dar permiso por recurso.
- [ ] Explicas qué es BOLA, el primer riesgo del OWASP API Top 10, y cómo lo evitas.
- [ ] Explicas por qué usar bcrypt y no SHA-256 para contraseñas, y por qué el JWT dura poco.

**Pregunta de entrevista.** *"¿Cómo implementarías roles y permisos?"* Con autenticación por JWT de vida corta y contraseñas en bcrypt; autorización por rol en un middleware; y permiso por recurso, el sitio, en cada consulta, que es lo que más se olvida. Además, una auditoría de cada acceso en una tabla donde la aplicación solo puede insertar.

**Cierre:** `feat(auth): login con JWT, roles, permiso por sitio y auditoría` · tag `fase-04`.

---

## Fase 5 · Ingesta HTTP: validar y no duplicar

**Objetivo:** `POST /api/lecturas`, que recibe lotes de un gateway, valida cada dato, no duplica y responde claro. También, las consultas de series y de estado.
**Tiempo:** 2 horas.

**La idea.** Es la recepción de una bodega: quién trae la carga, si viene bien rotulada, si el producto existe, si la cantidad tiene sentido y si ya se recibió. Al final entrega un comprobante.

**Construyes:** `src/api/catalogo.js`, `src/comun/validacion.js`, `src/api/repositorio.js`, `src/api/rutas/lecturas.js` y `test/ingesta.test.js`.

**Pasos**

1. `catalogo.js`: al arrancar, carga los motores y las variables desde MySQL en dos `Map` por código, y los refresca cada 60 segundos. Expone `motor(codigo)` y `variable(codigo)`.
2. `validacion.js`, con funciones puras, fáciles de probar:
   - el esquema zod de una lectura: `motor`, `variable`, `ts` con `z.iso.datetime({ offset: true })` y `valor` numérico;
   - un lote de 1 a 1000 lecturas;
   - `evaluarLectura(lectura, catalogo, usuario, ahora)` → `{ ok: true, fila }` o `{ ok: false, motivo }`. Los motivos son:
     - `motor_desconocido`;
     - `motor_de_otro_sitio`;
     - `variable_desconocida`;
     - `hora_en_el_futuro` (más de 5 minutos adelante);
     - `hora_demasiado_antigua` (más de 30 días).

   Un valor fuera de rango **no** se rechaza: se guarda con `calidad = 1`.
3. `repositorio.js`:
   - `insertarLecturas(filas)`: un solo `INSERT ... VALUES ? ON DUPLICATE KEY UPDATE valor = valor`.
     - Usa `pool.query`, no `execute`, porque `execute` no expande arreglos.
     - Configura el pool con `flags: '-FOUND_ROWS'`, para que `affectedRows` cuente solo las filas nuevas.
   - `actualizarEstado(filas)`: un upsert en `estado_actual` que solo pisa el valor si la lectura es más nueva.
     - Usa el alias de fila (`VALUES ... AS nuevo`), no `VALUES()`, que está obsoleto.
     - MySQL aplica las asignaciones de izquierda a derecha, así que `ts` va al final.
   - Las dos escrituras van en una transacción.
4. `rutas/lecturas.js`:
   - `POST /api/lecturas` (rol `gateway` o `admin`) → 201 con `{ recibidas, nuevas, repetidas, fueraDeRango, rechazadas: [{ indice, motivo }] }`, o 422 si ninguna lectura sirve;
   - `GET /api/motores/:codigo/lecturas?variable=rpm&desde=...&hasta=...` → la serie, con un máximo de 7 días por consulta y permiso de sitio;
   - `GET /api/motores/:codigo/estado` → el último valor de cada variable.
5. Pruebas en `ingesta.test.js`:
   - un lote mixto da los conteos correctos;
   - el mismo lote dos veces da `nuevas: 0`;
   - sin token → 401;
   - lector → 403;
   - valor como texto → 422;
   - lote vacío → 422;
   - JSON roto → 400;
   - lote sin ninguna lectura válida → 422.

**Verifica:** arma `practica/lote-ejemplo.json` con lecturas buenas, una repetida, una fuera de rango y una de cada motivo de rechazo. Envíalo dos veces con `curl -d @practica/lote-ejemplo.json`: la segunda vez, `nuevas` debe ser 0. En MySQL, la lectura fuera de rango tiene `calidad = 1`. Pon horas recientes en el lote: una hora de hace más de 30 días se rechaza.

**La dominas si…**
- [ ] Explicas los seis controles de la ingesta en orden.
- [ ] Explicas por qué la idempotencia la garantiza la base y no un SELECT previo (tu historia de los folios duplicados).
- [ ] Explicas por qué se acepta el lote parcialmente.

**Pregunta de entrevista.** *"¿Cómo evitas datos duplicados si el gateway reenvía?"* Con una clave única por motor, variable y hora, y un `INSERT ... ON DUPLICATE KEY UPDATE`: la lectura repetida se ignora sin error. Un chequeo previo en el código falla con peticiones simultáneas.

**Cierre:** `feat(ingesta): POST /api/lecturas con validación e idempotencia` · tag `fase-05`.

---

## Fase 6 · MQTT: broker, tópicos y loteador

**Objetivo:** recibir telemetría por MQTT, escribirla en lotes y no perder mensajes si la API se reinicia.
**Tiempo:** 3 horas.

**La idea.** MQTT es una radio con canales: el gateway transmite en un tópico, y el broker, la antena central, se lo entrega a quien esté sintonizado. El loteador es el camión de la basura: no pasa por cada bolsa, sino cuando el contenedor se llena o cada cierto tiempo.

**Construyes:** el servicio `mosquitto` en Compose, `mosquitto/mosquitto.conf`, `docs/topicos.md`, `src/api/loteador.js`, `src/api/ingesta-mqtt.js` y `test/loteador.test.js`.

**Pasos**

1. Agrega `mosquitto` a Compose: `eclipse-mosquitto:2.1-alpine` (la versión vigente, fija hasta el minor; la 2.1 solo se publica con el sufijo `-alpine`), el puerto 1883 y tu `mosquitto.conf` montado.
   - Mosquitto 2 exige declarar `listener 1883`.
   - Por ahora usa `allow_anonymous true`, y activa `persistence true`.
2. Diseña los tópicos en `docs/topicos.md`:
   - `motores/{sitio}/{motor}/telemetria`: las lecturas, con QoS 1;
   - `motores/{sitio}/gateways/{id}/estado`: `online` u `offline`, retenido; es el Last Will del gateway;
   - el mensaje: `{ "motor": "MTR-01", "gateway": "gw-norte", "ts": "<ISO en UTC>", "lecturas": { "rpm": 1500, "temp_refrigerante": 85.2 } }`.
3. Prueba el broker a mano, en dos terminales. Los clientes vienen dentro de la imagen de Mosquitto:
   ```bash
   docker compose exec mosquitto mosquitto_sub -t 'motores/#' -v
   docker compose exec mosquitto mosquitto_pub -q 1 -t motores/norte/MTR-01/telemetria \
     -m "{\"motor\":\"MTR-01\",\"gateway\":\"manual\",\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"lecturas\":{\"rpm\":1500}}"
   ```
4. `npm install mqtt`.
5. `loteador.js`. Escribe **primero las pruebas**, con un `escribir` falso y sin base de datos.
   - La firma es `crearLoteador({ escribir, maxFilas = 500, intervaloMs = 1000, maxEnMemoria = 50000 })` y devuelve `{ agregar(filas), vaciar(), detener() }`.
   - Escribe cuando junta `maxFilas` o cuando pasan `intervaloMs`, y solo una escritura a la vez.
   - Si la base falla, conserva las filas y las reintenta en orden.
   - Sobre `maxEnMemoria`, descarta las más antiguas y las cuenta.
   - `detener()` escribe lo que quede pendiente.
6. `ingesta-mqtt.js`:
   - conecta con `clientId: 'api-ingesta'` y `clean: false`, es decir, una sesión persistente;
   - se suscribe con QoS 1 a `motores/+/+/telemetria` y a `motores/+/gateways/+/estado`;
   - con cada mensaje:
     - parsea el JSON (si falla, el motivo es `json_invalido`);
     - valida la forma y convierte `lecturas` en filas con el catálogo;
     - aplica `evaluarLectura` y agrega las válidas al loteador;
   - lleva contadores de lecturas aceptadas y de rechazos por motivo.
7. En `server.js`, el apagado ordenado ahora es: cerrar MQTT, `loteador.detener()` y cerrar el pool.
8. **Prueba de resiliencia:** detén la API, publica 20 mensajes con QoS 1 y vuelve a levantarla. Deben llegar los 20, porque el broker los guardó para la sesión persistente.
9. **Seguridad del broker** (recomendado):
   - cambia a `allow_anonymous false`;
   - crea las credenciales `api` y `gw-norte` con `mosquitto_passwd`, en un contenedor de un solo uso: `docker compose run --rm --entrypoint mosquitto_passwd mosquitto ...`;
   - en un archivo `acl`, deja que `gw-norte` escriba solo en `motores/norte/#` y que `api` solo lea `motores/#`;
   - carga los dos archivos con los plugins `mosquitto_password_file` y `mosquitto_acl_file` (`plugin` y `plugin_opt_...`). En Mosquitto 2.1, las opciones `password_file` y `acl_file` siguen funcionando, pero están obsoletas y desaparecen en la 3.0;
   - agrega `MQTT_USUARIO` y `MQTT_CLAVE` a tu `.env`;
   - verifica que `gw-norte` **no** puede publicar en `motores/sur/...`.

**Verifica:** `SELECT COUNT(*) FROM lecturas;` sube con cada mensaje; `npm test` pasa las pruebas del loteador; en la prueba de resiliencia no falta ninguno de los 20 mensajes.

**La dominas si…**
- [ ] Explicas QoS 0, 1 y 2, y por qué eliges QoS 1 más idempotencia.
- [ ] Explicas qué son una sesión persistente, un mensaje retenido y el Last Will.
- [ ] Explicas por qué conviene escribir en lotes y qué pasa si la base se cae.

**Pregunta de entrevista.** *"¿QoS 0, 1 o 2 para telemetría?"* QoS 1, que asegura que el mensaje llegue al menos una vez; los duplicados los absorbe la clave única de la base. QoS 2 cuesta más viajes y no protege nada más allá del broker.

**Cierre:** `feat(mqtt): ingesta por MQTT con loteador y sesión persistente` · tag `fase-06`.

---

## Fase 7 · Terreno: simulador Modbus y gateway con buffer

**Objetivo:** simular dos controladores Modbus TCP y construir el gateway que los lee, guarda cada mensaje en SQLite y lo publica por MQTT sin perder datos si se cae el enlace.
**Tiempo:** 3 a 4 horas.

**La idea.** Modbus es pasar lista: el gateway pregunta y cada equipo responde por su número. El gateway es el traductor de la faena, con un cuaderno (SQLite) donde anota todo **antes** de llamar a Santiago, para que un corte no borre nada.

**Construyes:** `src/comun/decodificacion.js`, `src/simulador/motor-modbus.js`, `src/gateway/buffer-local.js`, `src/gateway/gateway.js`, `test/decodificacion.test.js`, `test/buffer.test.js` y `docs/rs485.md`.

**El mapa de registros.** Son holding registers; la dirección 0 es el "40001" del manual.

| Registro | Variable | Tipo | Escala |
|---|---|---|---|
| 0 | rpm | uint16 | 1 |
| 1 | temp_refrigerante | int16 con signo | 0,1 (852 → 85,2 °C) |
| 2 | presion_aceite | uint16 | 1 kPa |
| 3 | voltaje_bateria | uint16 | 0,01 (2685 → 26,85 V) |
| 4 | carga | uint16 | 1 % |
| 5 y 6 | horas_motor | float32 con palabras invertidas (CDAB) | 2 decimales |
| 7 | alarmas | 16 bits, uno por alarma | — |

El valor `0x7FFF` en un registro significa "sin dato", por ejemplo un sensor cortado: esa lectura se omite, no se inventa.

**Pasos**

1. `npm install modbus-serial`. Agrega a `.env.example` las variables del gateway: `MODBUS_HOST`, `MODBUS_PUERTO=5020`, `GATEWAY_ID=gw-norte`, `GATEWAY_SITIO=norte`, `GATEWAY_EQUIPOS=1:MTR-01,2:MTR-02` y `GATEWAY_BUFFER=./datos/buffer.sqlite`.
2. `decodificacion.js`. Escribe **primero las pruebas**.
   - `aInt16(registro)`: reinterpreta el complemento a dos (65486 → −50).
   - `registrosAFloat(r0, r1, orden)` y su inversa, `floatARegistros(valor, orden)`, con los órdenes `'ABCD'` y `'CDAB'`. Usa un `Buffer` de 4 bytes.
   - `decodificarRegistros(registros)` → `{ lecturas, sinDato }`, aplicando el mapa.
   - `alarmasActivas(bits)` → los nombres de las alarmas encendidas.

   Casos de prueba:
   - −5,0 °C llega como 65486 y vuelve a −5;
   - un float hace ida y vuelta en ambos órdenes;
   - leerlo con el orden equivocado da un valor absurdo (el bug clásico);
   - `0x7FFF` queda en `sinDato`.
3. `motor-modbus.js`, el simulador:
   - un `ServerTCP` de `modbus-serial` en `0.0.0.0:5020`; el Unit ID 1 es MTR-01 y el 2 es MTR-02;
   - cada segundo actualiza un modelo simple: rpm cerca de 1500 con ruido, una temperatura que sube con la carga y horas que avanzan;
   - con el teclado provoca fallas: `t` sobretemperatura, `f` sensor cortado (`0x7FFF`) y `d` detener o arrancar.
4. `buffer-local.js`, con `DatabaseSync` de `node:sqlite`. Pruébalo con una base `:memory:`.
   - Una tabla `pendientes(id, topico, payload, creado_en)`.
   - `guardar(topico, payload)`, con un tope: si se llena, descarta los más antiguos y lo informa.
   - `siguientes(n)`, `confirmar(id)` y `pendientes()`.
5. `gateway.js`:
   - un bucle con `setTimeout` encadenado, no `setInterval`, para que un ciclo atrasado no se monte sobre el siguiente;
   - por cada equipo: `setID(unitId)`, `readHoldingRegisters(0, 8)`, decodificar, armar el mensaje y **guardarlo en el buffer antes de publicarlo**;
   - `drenar()`: publica los pendientes con `publishAsync` y QoS 1, y borra cada uno solo cuando el broker confirma;
   - el Last Will, retenido en el tópico de estado, es `offline`; al conectar, publica `online` retenido y drena;
   - en el apagado ordenado, publica `offline` a mano, porque una desconexión limpia no dispara el Last Will.
6. Agrega los scripts:
   - `"simulador": "node --env-file=.env src/simulador/motor-modbus.js"`;
   - `"gateway": "node --env-file=.env --disable-warning=ExperimentalWarning src/gateway/gateway.js"`. El flag calla el aviso de `node:sqlite` en Node 24.4 y anteriores; en las versiones recientes de la 24 y en la 26 ya no aparece.
7. **Prueba de corte:** con todo andando, detén el broker 60 segundos (`docker compose stop mosquitto`) y vuelve a levantarlo. El gateway acumula y después drena. Cuenta las lecturas por minuto en MySQL: no debe faltar ninguno.
8. `docs/rs485.md`: en cinco líneas, qué cambiaría con Modbus RTU sobre un RS485 real:
   - el puerto serie (`connectRTUBuffered('/dev/ttyUSB0', { baudRate: 9600 })`);
   - los baudios y la paridad;
   - la terminación de 120 Ω y la polaridad A/B;
   - un solo maestro, y direcciones de 1 a 247.

**Verifica:** con `npm run simulador` y `npm run gateway` andando, `docker compose exec mosquitto mosquitto_sub -t 'motores/#' -v` muestra mensajes cada pocos segundos y el estado `online` retenido. Si matas el gateway sin aviso, aparece `offline`: el Last Will. En Windows, el equivalente de `kill -9` es `taskkill /F /PID <pid>` (el gateway muestra su PID al arrancar). Corre el simulador en la terminal de VS Code: sus teclas necesitan una TTY.

**La dominas si…**
- [ ] Explicas qué son un holding register, un Unit ID y la función 03.
- [ ] Explicas el bug del orden de palabras en un float de 32 bits.
- [ ] Explicas *store-and-forward* y por qué se guarda antes de publicar.

**Pregunta de entrevista.** *"¿Qué pasa si se cae internet en la faena?"* El gateway guarda cada lectura en SQLite antes de publicarla, la borra solo cuando el broker confirma y, al volver el enlace, drena en orden. Las lecturas llevan la hora del equipo, la clave única absorbe los reenvíos y el Last Will avisa que el gateway quedó desconectado.

**Cierre:** `feat(gateway): simulador Modbus TCP y gateway con buffer SQLite` · tag `fase-07`.

---

## Fase 8 · CAN y J1939: decodificar tramas del motor

**Objetivo:** entender cómo habla la ECU de un motor por CAN y decodificar tramas de ejemplo hasta publicarlas por MQTT.
**Tiempo:** 1 a 2 horas.

**La idea.** CAN es una sala donde todos hablan fuerte: la ECU anuncia sus datos sin que nadie le pregunte. J1939 es el diccionario: el PGN dice qué mensaje es, y el SPN, qué variable va dentro y en qué bytes.

**Construyes:** `docs/j1939.md`, `src/comun/j1939.js`, `test/j1939.test.js`, `practica/candump-ejemplo.log` y `src/scripts/can-a-mqtt.js`.

**La teoría mínima.** Escríbela con tus palabras en `docs/j1939.md`.
- El identificador CAN de J1939 tiene 29 bits: prioridad (3 bits), reservado y página de datos (2 bits), PF (8 bits), PS (8 bits) y la dirección de origen (8 bits).
- Si PF es 240 o más, el PGN incluye a PS. Si es menor, PS es una dirección de destino y no forma parte del PGN.
- Los datos van en *little-endian*, con el byte bajo primero. `0xFF` o `0xFFFF` significan "no disponible".

**Pasos**

1. `j1939.js`. Escribe **primero las pruebas**.
   - `desarmarId(id)` → `{ prioridad, pgn, destino, origen }`.
   - `decodificarEEC1(bytes)` → `{ rpm }`. Es el SPN 190: bytes 4 y 5 (índices 3 y 4), a 0,125 rpm por bit; `0xFFFF` → `null`.
   - `decodificarET1(bytes)` → `{ temp_refrigerante }`. Es el SPN 110: byte 1 (índice 0), a 1 °C por bit con un desplazamiento de −40; `0xFF` → `null`.
   - `parsearLineaCandump(linea)`, para el formato `(1794744000.123456) can0 0CF00400#F07D7DE02EFFFFFF`.
2. Los casos de prueba (todos verificados):

   | Entrada | Resultado |
   |---|---|
   | `desarmarId(0x0CF00400)` | prioridad 3, PGN 61444 (EEC1), origen 0 |
   | `desarmarId(0x18FEEE00)` | prioridad 6, PGN 65262 (ET1), origen 0 |
   | `desarmarId(0x18EAFF00)` | prioridad 6, PGN 59904, destino 255, origen 0 |
   | EEC1 `F07D7DE02EFFFFFF` | 1500 rpm |
   | ET1 `7DFFFFFFFFFFFFFF` | 85 °C |
   | EEC1 con `FFFF` en los bytes 4 y 5 | `null` |

3. Escribe `practica/candump-ejemplo.log`, con unas 10 líneas que mezclen EEC1 y ET1 de MTR-03 (sitio sur).
4. `can-a-mqtt.js`:
   - lee el archivo línea por línea y decodifica EEC1 y ET1;
   - agrupa por instante y publica en `motores/sur/MTR-03/telemetria`, con el mismo formato JSON de siempre;
   - usa la hora actual al publicar, como si fuera en vivo; si no, la ingesta rechaza las horas viejas.
5. Opcional, en un Ubuntu con el módulo `vcan` (en una EC2 suele estar; en Windows no existe y en WSL 2 suele faltar):
   - `sudo modprobe vcan` y crea la interfaz `vcan0`;
   - instala `can-utils` y reproduce el archivo con `canplayer`.

**Verifica:** `npm test` pasa las pruebas de J1939, `mosquitto_sub` muestra MTR-03 y en MySQL hay lecturas de MTR-03.

**La dominas si…**
- [ ] Explicas qué son un PGN y un SPN.
- [ ] Decodificas a mano las rpm de una trama EEC1.

**Pregunta de entrevista.** *"¿Cómo leerías las rpm de un motor por CAN?"* Escuchando el PGN 61444 (EEC1): las rpm son el SPN 190, en los bytes 4 y 5, en little-endian y a 0,125 rpm por bit; `0xFFFF` significa "no disponible". En terreno lo hace un gateway con interfaz CAN, que en Linux se maneja con SocketCAN.

**Cierre:** `feat(can): decodificador J1939 de EEC1 y ET1` · tag `fase-08`.

---

## Fase 9 · Tiempo real: WebSocket y dashboard

**Objetivo:** empujar cada lectura nueva al navegador, solo a quien tiene permiso para verla, y mostrarla en un dashboard simple.
**Tiempo:** 2 a 3 horas.

**La idea.** HTTP es mandar cartas: el navegador pregunta y el servidor responde. WebSocket es una llamada telefónica abierta: el servidor habla apenas tiene algo nuevo.

**Construyes:** `src/api/tiempo-real.js`, `public/index.html`, `public/app.js` y `public/estilos.css`.

**Pasos**

1. `npm install ws`.
2. `tiempo-real.js`:
   - un `WebSocketServer({ noServer: true, maxPayload: 4096 })`;
   - escucha el evento `upgrade` del servidor HTTP en la ruta `/ws` y verifica el JWT **antes** de aceptar la conexión; si no sirve, responde `401` y cierra el socket;
   - guarda el usuario en cada conexión;
   - `difundir(mensaje)` envía a cada cliente solo los motores de los sitios que puede ver;
   - manda un ping cada 30 segundos y cierra las conexiones que no respondan.
3. Llama a `difundir` cuando el loteador confirma una escritura, para no mostrar datos que no quedaron guardados.
4. El dashboard, en HTML y JavaScript sin frameworks, servido con `express.static('public')`:
   - un formulario de login;
   - una tabla por motor que se actualiza en vivo;
   - el estado `online`/`offline` de cada gateway y la hora del último dato.

   Deja el JavaScript en `app.js` y no dentro del HTML: la política de seguridad de `helmet` bloquea los scripts en línea.
5. Sobre el token en la URL: es lo más simple para practicar, pero queda en los logs de los proxies. La mejora es un "ticket" de un solo uso que el navegador pide por `POST` justo antes de conectar. Anótalo en `docs/decisiones.md`.

**Verifica:** abre dos navegadores, uno con `ing-norte` y otro con `lector-sur`: cada uno ve solo su sitio. Sin navegador, prueba con `npx wscat -c "ws://localhost:3000/ws?token=$TOKEN"`. Con un token inválido, la conexión se rechaza.

**La dominas si…**
- [ ] Explicas por qué se autentica en el `upgrade` y no después.
- [ ] Explicas qué haría falta con varias instancias de la API: un bus compartido entre ellas, como el mismo MQTT o Redis.

**Pregunta de entrevista.** *"¿Cuándo usarías WebSocket y cuándo REST?"* WebSocket para empujar datos en vivo a un dashboard; REST para consultar la historia y hacer cambios. En WebSocket se autentica al abrir la conexión, se filtra cada mensaje por permisos y se detectan las conexiones muertas con ping.

**Cierre:** `feat(ws): tiempo real con WebSocket y dashboard` · tag `fase-09`.

---

## Fase 10 · Node-RED: el gateway en bloques

**Objetivo:** armar en Node-RED el flujo Modbus → JSON → MQTT y compararlo con tu gateway en código.
**Tiempo:** 1 a 2 horas.

**La idea.** Node-RED es como programar un PLC en bloques: ves el flujo completo de un vistazo y lo cambias en terreno sin compilar nada.

**Pasos**

1. Para que Node-RED llegue al simulador por su nombre, corre el simulador dentro de Compose. Agrega un servicio `simulador`:
   - imagen `node:26-trixie-slim`, con la carpeta del proyecto montada en `/app` y `working_dir: /app`;
   - un volumen anónimo en `/app/node_modules` y `command: sh -c "npm ci --omit=dev && node src/simulador/motor-modbus.js"`, para no mezclar el `node_modules` de Windows con Linux;
   - la variable `SIMULADOR_HOST=0.0.0.0`;
   - el puerto `5020:5020` publicado, para que tu gateway en código lo siga alcanzando en `127.0.0.1`.
2. Agrega `nodered` a Compose: la imagen `nodered/node-red:5.0`, el puerto 1880 y un volumen para `/data`. La 5.0 trae Node 24, y `node-red-contrib-modbus` exige Node 22 o superior.
3. En http://localhost:1880, abre *Manage palette* e instala `node-red-contrib-modbus`.
4. Arma el flujo **inject (cada 2 s) → Modbus Getter → function → mqtt out**:
   - *Modbus Getter*: servidor `simulador:5020`, Unit ID 2, FC3, dirección 0 y cantidad 8. *Modbus Read* no sirve aquí porque sondea solo y no acepta entradas; con un inject se usa el Getter. OJO: el inject debe mandar un payload (por ejemplo, la hora), porque el Getter descarta en silencio los mensajes sin payload;
   - *function*: el agente escribe la decodificación comentada en `flows/funcion-decodificar.js` (int16, escalas, float CDAB y el mismo JSON de siempre, con `gateway: 'node-red'`), y tú la pegas en el nodo;
   - *mqtt out*: broker `mosquitto:1883`, tópico `motores/norte/MTR-02/telemetria` y QoS 1. Usa una credencial si activaste la seguridad en la Fase 6.
5. Mientras tanto, configura tu gateway en código para leer solo MTR-01 (`GATEWAY_EQUIPOS=1:MTR-01`), así no duplicas MTR-02.
6. Exporta el flujo (*Menu → Export → JSON*) a `flows/gateway-modbus.json` y súbelo al repositorio.
7. En `docs/decisiones.md`, compara en cinco líneas Node-RED con tu gateway en código: rapidez, visibilidad, pruebas, buffer y versionado.

**Verifica:** `mosquitto_sub` muestra MTR-02 con `"gateway":"node-red"`, y llegan lecturas a MySQL.

**La dominas si…**
- [ ] Sabes cuándo conviene Node-RED y cuándo un servicio en código.

**Pregunta de entrevista.** *"¿Node-RED o código?"* Node-RED para integrar rápido y ajustar en terreno; código cuando necesitas pruebas, un buffer robusto, revisión y versionado. Muchas veces conviven: Node-RED en el borde y servicios en el centro.

**Cierre:** `feat(node-red): flujo Modbus a MQTT exportado` · tag `fase-10`.

---

## Fase 11 · SQL con volumen: millones de filas

**Objetivo:** cargar millones de lecturas, medir las consultas y optimizarlas con evidencia.
**Tiempo:** 3 horas.

**La idea.** Es la prueba con banco de carga de la base: no sabes si aguanta hasta que la cargas. Y, como con las consultas que reservaban 2 GB para usar 63 MB en SQL Server, primero se mide y después se corrige.

**Construyes:** `src/scripts/generar-volumen.js`, `practica/rendimiento.sql` y `docs/rendimiento.md`.

**Pasos**

1. Crea los motores MTR-04 a MTR-10, con SQL o con la API.
2. `generar-volumen.js`: genera 7 días de datos de 10 motores y 4 variables, una lectura cada 10 segundos, en total **2.419.200 filas**. Inserta en lotes de 5.000, con un solo `INSERT` por lote, y muestra el avance en filas por segundo.
3. Mide la línea base con `EXPLAIN ANALYZE` y anota los tiempos en `docs/rendimiento.md`:
   - A. la serie de rpm de un motor en 24 horas;
   - B. el promedio por hora de las rpm de todo el sitio norte en 7 días;
   - C. las últimas 50 lecturas fuera de rango del sitio norte.
4. Optimiza, y vuelve a medir después de cada cambio:
   - **Índice para C:** `(calidad, ts)`. Confirma en el plan que se usa.
   - **Agregados por hora:**
     - una tabla `lecturas_hora` (motor, variable, hora, promedio, mínimo, máximo y n, con PK de las tres primeras);
     - llénala con `INSERT ... SELECT ... GROUP BY ... ON DUPLICATE KEY UPDATE`; envuelve el SELECT en una subconsulta con alias para usar sus columnas en el UPDATE;
     - prográmala con un `EVENT` cada hora, creado como root;
     - reescribe la consulta B sobre esta tabla.
   - **Particiones por mes:**
     - `PARTITION BY RANGE COLUMNS (ts)`; funciona porque `ts` está en la PK, y por eso `lecturas` no tiene FK;
     - confirma con `EXPLAIN` que una consulta de un mes lee una sola partición;
     - compara el tiempo de un `DELETE` de un mes con el de `ALTER TABLE ... DROP PARTITION`.
   - **Paginación por clave** en la auditoría: `WHERE id < ? ORDER BY id DESC LIMIT 50` en vez de `OFFSET`. Mide la página 1.000 de cada forma.
5. Activa el *slow query log* con `long_query_time = 1` y revisa qué aparece.

**Verifica:** `docs/rendimiento.md` tiene una tabla de antes y después con milisegundos reales, y los planes muestran el índice, la tabla de agregados y la poda de particiones.

**La dominas si…**
- [ ] Lees un `EXPLAIN` (type, key, rows) y sabes qué es un *full scan*.
- [ ] Explicas cuándo conviene un agregado precalculado y cuándo una partición.

**Pregunta de entrevista.** *"Una consulta se puso lenta con millones de filas, ¿qué haces?"* Primero mido, con el slow query log y `EXPLAIN ANALYZE`. Después, un índice que calce con el `WHERE` y el `ORDER BY`, agregados precalculados para los dashboards, particiones para borrar datos viejos sin bloquear, y vuelvo a medir. Lo hice así en SQL Server, con consultas que reservaban 2 GB de memoria para usar 63 MB.

**Cierre:** `perf(db): índices, agregados por hora y particiones medidos` · tag `fase-11`.

---

## Fase 12 · Docker: todo con un comando

**Objetivo:** que todo el sistema se levante con un solo comando, igual en cualquier máquina.
**Tiempo:** 2 horas.

**La idea.** Un contenedor es un equipo que llega armado de fábrica con todo lo que necesita: lo conectas y funciona igual en cualquier sitio.

**Construyes:** `Dockerfile`, `.dockerignore` y el `docker-compose.yml` completo.

**Pasos**

1. `Dockerfile`, una sola imagen para la API, el gateway y el simulador:
   - base `node:26-trixie-slim`: Node 26 LTS sobre Debian 13, porque Debian 12 dejó el soporte regular en julio de 2026;
   - copia primero `package*.json` y ejecuta `npm ci --omit=dev`, para aprovechar la caché de capas;
   - después copia `src` y `public`;
   - crea `/app/datos` con dueño `node`, para el buffer del gateway;
   - corre como `USER node`, no como root;
   - `CMD ["node", "src/api/server.js"]`.
2. `.dockerignore`: `node_modules`, `.git`, `.env*`, `*.sqlite`, `docs` y `test`.
3. Compose completo, con un perfil `completo` para la API, el gateway y el simulador (reemplaza el simulador temporal de la Fase 10):
   - `depends_on` con `condition: service_healthy` para MySQL;
   - `restart: unless-stopped`;
   - un volumen para el buffer del gateway;
   - dentro de Docker, cada servicio se llama por su nombre (`mysql`, `mosquitto`, `simulador`), no por `127.0.0.1`.
4. Levanta todo con `docker compose --profile completo up -d --build`, y revisa con `docker compose ps` y `docker compose logs -f api`.
5. Experimentos:
   - `docker compose restart api`: no se pierde nada, gracias a la sesión persistente;
   - detén `mosquitto` 30 segundos: el buffer del gateway retiene y después drena;
   - con `docker images`, compara el tamaño de la imagen con base `node:26` y con la `slim`.

**Verifica:** el dashboard funciona en http://localhost:3000 con todo en contenedores, y `docker compose ps` muestra todos los servicios arriba.

**La dominas si…**
- [ ] Explicas qué son una imagen, un contenedor, un volumen, una red y un perfil.
- [ ] Explicas por qué los secretos no van en la imagen.

**Pregunta de entrevista.** *"¿Por qué usarías Docker?"* Para tener el mismo entorno en desarrollo y en producción, con versiones fijas, y para levantar las dependencias en segundos. Los secretos entran por variables de entorno y los datos viven en volúmenes, nunca dentro de la imagen.

**Cierre:** `build(docker): imagen y compose completo` · tag `fase-12`.

---

## Fase 13 · Linux: despliegue como servicio

**Objetivo:** desplegar la API y el gateway como servicios de Linux, con nginx adelante, respaldos y vuelta atrás.
**Tiempo:** 3 horas.

**Dónde:** en un Ubuntu 24.04 en WSL 2, que es gratis, o en una EC2 con Ubuntu 24.04, como en Duoc. La EC2 te deja practicar además el Security Group y el firewall de verdad. En los dos casos, MySQL y Mosquitto siguen en Docker y la API y el gateway corren como servicios.

**Prepara el Ubuntu de WSL**, si eliges esa opción. Tu Ubuntu-22.04 actual corre en WSL 1, que no tiene systemd.
1. En PowerShell: `wsl --install -d Ubuntu-24.04`. Queda en WSL 2, porque es tu versión predeterminada. Crea tu usuario de Linux.
2. En Ubuntu, `ps -p 1 -o comm=` debe decir `systemd`. Si no, agrega `[boot]` y `systemd=true` a `/etc/wsl.conf`, ejecuta `wsl --shutdown` en PowerShell y vuelve a abrir Ubuntu.
3. `sudo apt update && sudo apt install -y git curl jq mysql-client mosquitto-clients`.
4. Docker Desktop → *Settings* → *Resources* → *WSL integration* → activa Ubuntu-24.04, para usar `docker` desde Ubuntu.
5. Trabaja en `~/` y no en `/mnt/f`: el sistema de archivos de Linux es mucho más rápido.

**La idea.** Es instalar un equipo en terreno: lo llevas, lo conectas, lo dejas con rearme automático (systemd) y le pones una sola entrada controlada (nginx y el firewall).

**Construyes:** `deploy/telemetria-api.service`, `deploy/telemetria-gateway.service`, `deploy/nginx-telemetria.conf`, `deploy/respaldo.sh` y `deploy/desplegar.sh`.

**Pasos**

1. Instala Node para todo el sistema, porque el de nvm vive en tu carpeta personal y systemd no lo ve:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_26.x | sudo -E bash -
   sudo apt install -y nodejs nginx
   ```
2. Crea el usuario y las carpetas:
   ```bash
   sudo useradd --system --no-create-home --shell /usr/sbin/nologin telemetria
   sudo mkdir -p /opt/telemetria/releases /var/lib/telemetria /etc/telemetria
   sudo chown telemetria:telemetria /var/lib/telemetria
   ```
3. Guarda los secretos en `/etc/telemetria/api.env` y `/etc/telemetria/gateway.env`, con `chmod 600` y dueño root.
4. `desplegar.sh <tag>`:
   - clona ese tag de `https://github.com/Huamagod1/Proyecto_backend.git` en `/opt/telemetria/releases/<tag>` y ejecuta `npm ci --omit=dev`. Como el repositorio es público, no necesita llave; una *deploy key* de solo lectura hace falta solo si lo vuelves privado;
   - apunta el enlace `/opt/telemetria/actual` a esa carpeta;
   - reinicia los servicios y comprueba `/api/salud`;
   - si algo falla, vuelve el enlace a la versión anterior y reinicia. Eso es la vuelta atrás.
5. Las unidades de systemd:
   - `User=telemetria`, `WorkingDirectory=/opt/telemetria/actual` y `EnvironmentFile=/etc/telemetria/api.env`;
   - `ExecStart=/usr/bin/node src/api/server.js`, `Restart=always` y `RestartSec=5`;
   - endurecimiento: `NoNewPrivileges=true`, `ProtectSystem=strict`, `ProtectHome=true` y `PrivateTmp=true`;
   - solo para el gateway, `ReadWritePaths=/var/lib/telemetria`, donde vive su buffer.

   Actívalas con `sudo systemctl daemon-reload && sudo systemctl enable --now telemetria-api telemetria-gateway`.
6. nginx:
   - `location /` hacia `127.0.0.1:3000`;
   - `location /ws` con `proxy_http_version 1.1` y los encabezados `Upgrade` y `Connection "upgrade"`;
   - antes de recargar, siempre `sudo nginx -t`.
7. El firewall, en la EC2 (en WSL es opcional): primero `sudo ufw allow OpenSSH`, para no quedarte afuera; después `sudo ufw allow 'Nginx Full'` y `sudo ufw enable`.
8. `respaldo.sh`:
   - un `mysqldump --single-transaction` comprimido con gzip, con la fecha en el nombre;
   - borra los respaldos de más de 7 días;
   - prográmalo con `crontab -e` a las 03:00 (si hace falta, `sudo systemctl enable --now cron`).

   **Prueba la restauración** en una base `telemetria_restore`: un respaldo que nunca se restauró no es un respaldo.
9. Prueba el rearme: `sudo systemctl kill -s KILL telemetria-api`. A los 5 segundos, `systemctl status` debe mostrarlo activo otra vez.

**Verifica**
- `curl -s localhost/api/salud` responde.
- `systemctl is-active telemetria-api telemetria-gateway` dice `active` dos veces.
- `journalctl -u telemetria-api -n 50` muestra los logs.
- El dashboard funciona por el puerto 80, y también el tiempo real; eso prueba la configuración de WebSocket en nginx.

**La dominas si…**
- [ ] Diagnosticas con `systemctl status`, `journalctl`, `ss -tulpn`, `df -h` y `nginx -t`.
- [ ] Explicas cómo vuelves a la versión anterior si un despliegue falla.

**Pregunta de entrevista.** *"¿Cómo desplegarías y operarías este servicio en Linux?"*
- systemd, con un usuario sin privilegios y rearme automático;
- los secretos, en un archivo que solo lee root;
- nginx adelante, con TLS, y el firewall abierto solo en SSH, 80 y 443;
- los logs, en journald, y respaldos programados y probados;
- cada despliegue en su propia carpeta, para volver atrás cambiando un enlace.

**Cierre:** `ops: servicios systemd, nginx, respaldos y despliegue con vuelta atrás` · tag `fase-13`.

---

## Fase 14 · Operación e integración con SCADA/EMS

**Objetivo:** dejar la plataforma lista para operar e integrarse con otros sistemas.
**Tiempo:** 2 horas.

**La idea.** Un sistema en producción es como un grupo electrógeno en faena: no basta con que funcione. Necesitas instrumentos para saber cómo está y un procedimiento escrito para cuando falla.

**Construyes:** `src/comun/log.js` (si aún no lo tienes), las rutas de operación, `src/api/rutas/integracion.js`, `docs/RUNBOOK.md` y `docs/decisiones.md`.

**Pasos**

1. Logs estructurados: una línea JSON por evento, con `ts`, `nivel`, `evento` y los datos. Así, journald y cualquier herramienta los pueden filtrar.
2. Salud y disponibilidad son preguntas distintas:
   - `GET /api/salud`: el proceso está vivo;
   - `GET /api/listo`: la base y MQTT están conectados (si no, 503).

   Un orquestador reinicia lo que no está vivo, y deja de mandar tráfico a lo que no está listo.
3. `GET /api/metricas` (solo admin): los mensajes recibidos, las lecturas aceptadas, los rechazos por motivo, los pendientes del loteador, los clientes WebSocket y el tiempo encendido.
4. **Detector de silencio:** cada minuto busca los motores sin datos en los últimos 5 minutos. Cuando encuentra uno:
   - escribe una alerta en el log;
   - la publica retenida en `motores/{sitio}/alertas`;
   - la muestra en el dashboard.
5. **Integración con SCADA y EMS:**
   - una tabla `claves_api` (nombre, hash de la clave, rol `integracion`, sitio, activa y último uso) y un middleware que acepta `X-API-Key`. Las claves de API son largas y aleatorias, así que basta guardar su SHA-256; las contraseñas, en cambio, necesitan bcrypt;
   - `GET /api/integracion/estado?sitio=norte` entrega el último valor de cada motor en un formato plano y estable, pensado para otro sistema;
   - en `docs/decisiones.md`, explica cómo se conectaría un EMS por MQTT: con su propia credencial y una ACL de solo lectura sobre `motores/norte/#`.
6. `docs/RUNBOOK.md`: cuatro procedimientos de 5 a 8 pasos cada uno. Prueba al menos uno de verdad.
   - un sitio dejó de enviar datos;
   - la API no responde;
   - la base está lenta;
   - restaurar un respaldo.
7. `docs/decisiones.md`: las seis decisiones de diseño más importantes, cada una con su motivo:
   - la PK compuesta;
   - QoS 1 más idempotencia;
   - store-and-forward en el gateway;
   - el JWT de vida corta;
   - los agregados por hora;
   - las particiones.

**Verifica**
- Detén el simulador: en menos de 6 minutos aparece la alerta de silencio.
- `curl -H "X-API-Key: <clave>" "localhost:3000/api/integracion/estado?sitio=norte"` responde; con una clave de otro sitio, responde 403.

**La dominas si…**
- [ ] Explicas la diferencia entre salud y disponibilidad.
- [ ] Presentas el proyecto completo en 3 minutos, con el diagrama y tus decisiones.

**Pregunta de entrevista.** *"¿Cómo te enteras de que algo falla antes que el cliente?"* Con salud y disponibilidad, métricas, un detector de silencio que alerta cuando un sitio deja de enviar datos, logs estructurados y un runbook para actuar rápido.

**Cierre:** `feat(ops): métricas, detector de silencio, API de integración y runbook` · tag `v1.0.0`.

---

## Ejercicios a mano

Son para cuando tengas tiempo. Cada uno toma de 10 a 20 minutos y se hace sin mirar el código; después lo comparas con el del repositorio. El agente también los incluye en el apunte de cada fase.

| Fase | Ejercicio 1 | Ejercicio 2 |
|---|---|---|
| 1 | Crea una rama, haz un commit convencional, ábrelo como PR y ponle un tag | Deshaz un commit ya subido con `git revert` y explica por qué no se usa `reset` |
| 2 | Escribe de memoria el `CREATE TABLE` de `lecturas`, con su PK | Escribe la consulta de motores sin datos en los últimos 5 minutos |
| 3 | Escribe de memoria el middleware de errores | Agrega `GET /api/sitios` con su prueba |
| 4 | Escribe de memoria `autorizar(...roles)` | Agrega el rol `supervisor`, que solo lee, y prueba su 403 |
| 5 | Escribe de memoria `evaluarLectura` | Agrega el motivo `exceso_por_motor`: más de 100 lecturas de un mismo motor en un lote |
| 6 | Escribe de memoria el loteador, solo con el disparo por tamaño | Publica un mensaje retenido y explica qué recibe un suscriptor que llega después |
| 7 | Escribe de memoria `aInt16` y `registrosAFloat` | Agrega la variable `frecuencia` (registro 8, uint16, 0,01 Hz) de punta a punta |
| 8 | Arma en papel una trama EEC1 de 1800 rpm (bytes 4 y 5: `40 38`) | Escribe de memoria `desarmarId` |
| 9 | Escribe de memoria la verificación del token en el `upgrade` | Marca en rojo en el dashboard un motor con más de 1 minuto sin datos |
| 10 | Agrega al flujo un nodo que descarte los registros `0x7FFF` | Explica por escrito la diferencia entre un nodo inject y un bucle con `setTimeout` |
| 11 | Escribe de memoria el promedio por hora sobre `lecturas_hora` | Crea un índice para "las últimas lecturas de un sitio" y mide antes y después |
| 12 | Escribe de memoria un Dockerfile mínimo | Explica qué pasa con los datos con `docker compose down` y con `docker compose down -v` |
| 13 | Escribe de memoria una unidad de systemd mínima | Simula un despliegue fallido y vuelve atrás con el enlace |
| 14 | Escribe sin mirar el procedimiento "un sitio dejó de enviar datos" | Agrega a `/api/metricas` el tiempo promedio de escritura del loteador |

## Dónde mirar en la solución de referencia

Hoy no la tienes. Si la consigues, déjala en `F:\1. Proyectos personales\Developer Apis\lab-telemetria-motores\`.

| Fase | Archivos en `../lab-telemetria-motores/` |
|---|---|
| 2 | `sql/001_esquema.sql`, `sql/002_datos_iniciales.sql`, `sql/003_usuario_app.sql`, `practica/consultas.sql` |
| 3 | `src/api/app.js`, `src/api/server.js`, `src/api/db.js`, `src/api/rutas/motores.js`, `src/comun/errores.js` |
| 4 | `src/api/auth.js`, `src/api/auditoria.js`, `src/api/rutas/auth.js`, `src/api/rutas/auditoria.js`, `src/scripts/sembrar-usuarios.js` |
| 5 | `src/api/catalogo.js`, `src/api/repositorio.js`, `src/comun/validacion.js`, `src/api/rutas/lecturas.js` |
| 6 | `mosquitto/mosquitto.conf`, `src/api/loteador.js`, `src/api/ingesta-mqtt.js` |
| 7 | `src/comun/decodificacion.js`, `src/simulador/motor-modbus.js`, `src/gateway/` |
| 9 | `src/api/tiempo-real.js`, `public/` |
| 10 | el apartado de Node-RED del `README.md` |
| 11 | `practica/particiones.sql` |
| 12 | `Dockerfile`, `docker-compose.yml` |
| 13 | `deploy/` |

Las fases 8 y 14, y parte de la 11, no tienen referencia: revisa con más calma lo que genere el agente en esas fases.

## Problemas comunes

| Síntoma | Causa probable | Solución |
|---|---|---|
| `failed to connect to the docker API at npipe:...` | Docker Desktop está cerrado | Ábrelo y espera *Engine running* |
| Un comando de docker falla con una ruta `C:/Program Files/Git/...` | Git Bash convirtió una ruta de Linux en una de Windows | `export MSYS_NO_PATHCONV=1` (Fase 0, paso 4) |
| `$'\r': command not found` o `bad interpreter` al correr un `.sh` | El archivo tiene saltos de línea de Windows (CRLF) | `.gitattributes` con `eol=lf`, `git add --renormalize .` y *Files: Eol* = `\n` en VS Code |
| `curl` pide parámetros raros en PowerShell | En PowerShell 5.1, `curl` es `Invoke-WebRequest` | Usa Git Bash, o `curl.exe` |
| `git push` dice `Permission denied (publickey)` | Tu llave SSH no está en la cuenta Huamagod1 | Fase 0, paso 7 |
| Cambiaste `sql/` y no pasa nada | Esos archivos corren solo al crear el volumen | `docker compose down -v` (borra los datos) y `docker compose up -d` |
| En el cliente `mysql` del contenedor, `°C` se ve `�C` | Sin locale, el cliente usa `latin1` | `LANG: C.UTF-8` en el servicio `mysql` (ya está en el Compose), o `--default-character-set=utf8mb4` |
| `ER_ACCESS_DENIED_ERROR` | Cambiaste `DB_CLAVE` después de crear la base: `003_usuario_app.sh` corre solo al crearla | Recrea el volumen, o cambia la clave como root con `ALTER USER` |
| El puerto 3306 está ocupado | Arrancó tu servicio `MySQL93` de Windows | Detenlo (`Stop-Service MySQL93` en PowerShell como administrador), o usa `3307:3306` y `DB_PUERTO=3307` |
| Aviso `ExperimentalWarning` de SQLite | Tu Node es la 24.4 o anterior: ahí `node:sqlite` todavía avisa | `--disable-warning=ExperimentalWarning` en el script, o Node 26 |
| Mosquitto rechaza conexiones | Falta el `listener`, o activaste la seguridad sin credenciales | Revisa `mosquitto.conf` y el usuario |
| Mosquitto no arranca: `Unable to open pwfile` | `passwd` lo creó root con permisos 0600 y el broker corre como `mosquitto` (uid 1883) | `bash src/scripts/claves-mqtt.sh`: lo crea con `--user 1883:1883` |
| Mosquitto avisa que el dueño del `acl` o del `passwd` no es `mosquitto` | El archivo es de root o lo pueden leer otros | `claves-mqtt.sh` hace `chown 1883` y `chmod 0600` desde un contenedor; Docker Desktop lo respeta aunque el archivo esté en Windows |
| El simulador no reacciona a las teclas | La terminal no es una TTY (Git Bash fuera de VS Code) | Córrelo en la terminal de VS Code |
| El WebSocket no conecta detrás de nginx | Faltan los encabezados `Upgrade` y `Connection` | Revisa el `location /ws` (Fase 13, paso 6) |
| `systemctl` dice que no hay systemd | Ubuntu en WSL 1, o falta `systemd=true` | Fase 13, "Prepara el Ubuntu de WSL" |
| Una lectura sale rechazada por la hora | El ejemplo tiene una hora vieja o futura | Usa la hora actual: `date -u +%Y-%m-%dT%H:%M:%SZ` |
