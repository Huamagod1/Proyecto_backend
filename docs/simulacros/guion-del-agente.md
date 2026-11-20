# Guion de simulacros · solo para el agente

> **Fernando: no abras este archivo.** Trae las causas y las respuestas de cada simulacro. Si lo lees, pierdes la práctica.

Instrucciones para el agente cuando Fernando escribe `simulacro` (protocolo completo en `AGENTS.md`). Todas las fallas son de laboratorio, reversibles y sin borrar datos. Se aplican sobre la plataforma completa en contenedores (`docker compose --profile completo`).

## 1. Reglas

1. **Antes de aplicar:** comprueba el estado sano (sección 2). Si algo ya está mal, díselo y no sigas: un simulacro sobre un sistema enfermo no enseña nada.
2. **Elige** un escenario que no esté en la tabla de `docs/simulacros/README.md`, o el que lleve más tiempo sin repetirse. Respeta las precondiciones de cada uno.
3. **Pide una sola confirmación,** sin revelar cuál: "Voy a aplicar una falla reversible del catálogo de nivel 1. ¿Confirmas?".
4. **Respalda** lo que vayas a tocar y anota la hora UTC de cada acción. La necesitas para la ficha.
5. **Entrega solo el reporte,** como lo diría quien llama, con la hora local de Chile. Nada de la causa.
6. **Mientras investiga:**
   - responde preguntas de sintaxis ("¿cómo veo los logs de X?") sin orientar hacia la causa;
   - `pista` entrega la siguiente pista de la lista, hasta tres;
   - `me rindo` entrega la explicación completa.
7. **Cuando diga `resuelto: <causa>`,** evalúa tres cosas: la causa, la evidencia que la prueba y qué pasó con los datos. Si falta una, pregúntala.
8. **Al terminar:** revierte, vuelve a comprobar el estado sano y prepara la ficha con la cronología real. Él escribe el diagnóstico y las lecciones.
9. **Si al revertir algo no vuelve a estar sano,** detente y avisa. Nunca uses `docker compose down -v`, `DROP TABLE` ni `rm -rf`.
10. **Nunca muestres en el chat el valor de una clave.** Edita `.env` con `sed` y usa las claves dentro de los contenedores, como hacen los scripts del repositorio.

## 2. Ayudas y estado sano

```bash
# MySQL como root, dentro del contenedor: la clave nunca pasa por el chat.
# Uso: echo "SELECT 1;" | sql_root
sql_root() { docker compose exec -T mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -t telemetria' 2>&1 | grep -v 'Using a password'; }

# Respaldo de los archivos que tocan los simulacros (datos/ está en .gitignore).
respaldar() { mkdir -p datos/simulacro && cp .env datos/simulacro/env.antes; }
```

**Estado sano,** todo lo siguiente a la vez:
- `docker compose --profile completo ps`: mysql *healthy*, api *healthy*, mosquitto, gateway y simulador *running*;
- `curl -s localhost:3000/api/listo` → `{"estado":"listo",...}`;
- `echo "SELECT motor_id, COUNT(*) FROM lecturas WHERE ts > UTC_TIMESTAMP() - INTERVAL 1 MINUTE GROUP BY motor_id;" | sql_root` → filas para los motores 1 y 2;
- `git status --short mosquitto/ src/ sql/` → vacío.

OJO: MTR-03 solo recibe datos cuando alguien corre `npm run can`. Que esté en silencio es lo normal en el laboratorio, y debería figurar así en `linea-base.md`.

## 3. Escenarios de nivel 1

Formato de cada uno: reporte · precondición · aplicar · evidencia · datos · pistas · revertir · lección.

### 1. MySQL detenido

- **Reporte:** "El dashboard dejó de actualizarse hace un rato. La página carga, pero los números no se mueven."
- **Aplicar:** `docker compose stop mysql`.
- **Evidencia:**
  - `/api/salud` responde 200, y `/api/listo` responde 503 con `db: "error"`;
  - el log de la API repite `loteador_escritura_fallida` cada segundo, y aparece `detector_silencio_fallido`;
  - el login falla, así que `/api/metricas` no está disponible: hay que diagnosticar con los logs.
- **Datos:** no se pierden mientras la API siga viva. El loteador guarda en memoria hasta 50.000 filas (unas 5 horas con dos motores) y reintenta cada segundo. **Si alguien reinicia la API ahora, se pierde todo lo pendiente**, porque esos mensajes ya se confirmaron al broker.
- **Pistas:** (1) Compara `/api/salud` con `/api/listo`. (2) ¿Qué dependencia marca `/api/listo` como caída? (3) `docker compose ps mysql`.
- **Revertir:** `docker compose start mysql` y espera *healthy*. El loteador escribe lo pendiente solo.
- **Lección:** vivo no es lo mismo que listo, y "reiniciar por si acaso" habría perdido datos. Lo mejora la Fase 26 (diario local antes de confirmar).

### 2. Credencial del broker cambiada

- **Reporte:** "Desde el despliegue de hoy, `/api/listo` responde 503."
- **Aplicar:** `respaldar`, después `sed -i 's/^MQTT_CLAVE=.*/&x/' .env` y `docker compose --profile completo up -d api`.
- **Evidencia:**
  - `/api/listo` → `mqtt: "error"`;
  - el log de la API repite `mqtt_error` con *Not authorized* cada 2 s;
  - el log del broker rechaza a `api-ingesta`;
  - `mosquitto_sub` con la clave del `.env` también falla. Es una pista fuerte.
- **Datos:** no se pierden. La sesión persistente de `api-ingesta` (con `clean: false`) acumula los mensajes en el broker, hasta 100.000, y los entrega al volver.
- **Pistas:** (1) ¿Qué dependencia falla en `/api/listo`? (2) Lee el error exacto en el log de la API. (3) ¿Qué cambió en la configuración hoy?
- **Revertir:** `cp datos/simulacro/env.antes .env` y `docker compose --profile completo up -d api`.
- **Lección:** el error de arranque está en los logs, y la sesión persistente evitó la pérdida. Lo mejoran la Fase 23 (alerta) y la Fase 27 (certificados).

### 3. Permiso de lectura revocado

- **Reporte:** "La API devuelve error al pedir las series de MTR-01. ¿Perdimos datos?"
- **Aplicar:** `echo "REVOKE SELECT ON telemetria.lecturas FROM 'telemetria_app'@'%';" | sql_root`
- **Evidencia:**
  - la serie responde 500, y el log muestra `error_no_controlado` con *SELECT command denied ... for table 'lecturas'*;
  - `loteador_escritura_fallida` muestra *SELECT command denied ... for column 'valor'*: el `ON DUPLICATE KEY UPDATE valor = valor` lee la columna;
  - **`/api/listo` responde 200**, porque `SELECT 1` no toca tablas.
- **Datos:** igual que en el escenario 1. Están en la memoria del loteador, y se pierden si se reinicia la API.
- **Pistas:** (1) ¿Qué dice el log de la API al pedir la serie? (2) ¿La ingesta está escribiendo? (3) `SHOW GRANTS FOR 'telemetria_app'@'%';`
- **Revertir:** `echo "GRANT SELECT ON telemetria.lecturas TO 'telemetria_app'@'%';" | sql_root`. El loteador escribe lo pendiente.
- **Lección:** una prueba de disponibilidad no cubre todo, y nadie sabe quién cambió el permiso. Lo mejoran la Fase 16 (paridad de permisos y migraciones) y la Fase 23 (sonda de punta a punta).

### 4. Motor dado de baja por fuera de la aplicación

- **Reporte:** "MTR-02 desapareció del dashboard. El gateway dice que sigue enviando."
- **Aplicar:** `echo "UPDATE motores SET activo = FALSE WHERE codigo = 'MTR-02';" | sql_root`. Espera hasta 60 s: el catálogo se refresca solo.
- **Evidencia:**
  - `/api/metricas` → `mqtt.rechazos.motor_desconocido` crece;
  - el broker sí recibe los mensajes de MTR-02 (`mosquitto_sub`);
  - `SELECT codigo, activo FROM motores` → `MTR-02` con 0;
  - **no hay alerta de silencio:** el detector solo mira motores activos;
  - `GET /api/auditoria` no tiene ningún `DELETE /api/motores/MTR-02`: el cambio se hizo directo en la base.
- **Datos:** **se pierden.** Se rechazaron y solo quedó el contador.
- **Pistas:** (1) ¿Llegan los mensajes de MTR-02 al broker? (2) Mira los rechazos en `/api/metricas`. (3) ¿Qué dice la base sobre MTR-02?
- **Revertir:** `echo "UPDATE motores SET activo = TRUE WHERE codigo = 'MTR-02';" | sql_root` y espera hasta 60 s.
- **Lección:** un rechazo sin contenido no se puede recuperar, y un cambio hecho por fuera de la aplicación no deja rastro. Lo mejoran la Fase 19 (cuarentena con reproceso) y la Fase 25 (cambios con procedimiento).

### 5. Permiso de tópico mal escrito

- **Reporte:** "El gateway de norte aparece conectado, pero no llega nada del sitio."
- **Precondición:** el `acl` original tiene la línea `topic write motores/norte/#` bajo `user gw-norte`.
- **Aplicar:** `sed -i 's|^topic write motores/norte/#$|topic write motores/nrte/#|' mosquitto/acl` y `docker compose restart mosquitto`. Confirma con `git diff mosquitto/acl` que cambió una sola línea.
- **Evidencia:**
  - el estado retenido del gateway dice `online`;
  - el log del gateway no muestra errores, y su buffer está en 0;
  - un suscriptor con la credencial `api` no recibe telemetría de norte;
  - **ningún log registra la denegación** con el nivel del proyecto (`error`, `warning`, `notice` e `information`). `Denied PUBLISH from gateway-gw-norte` aparece solo si se agrega `log_type debug` y se reinicia el broker;
  - la alerta de silencio aparece a los 5 o 6 minutos para MTR-01 y MTR-02.
- **Datos:** **se pierden todos los del corte.** El gateway habla MQTT 3.1.1: el broker confirma igual un mensaje denegado, y el gateway lo borra del buffer.
- **Pistas:** (1) ¿El buffer del gateway está creciendo? Si no crece, el broker está confirmando. (2) ¿Qué hace el broker con un mensaje que no se tiene permiso de publicar? Sube su nivel de log un momento. (3) `git diff mosquitto/`.
- **Revertir:** `git checkout mosquitto/acl mosquitto/mosquitto.conf` (por si subió el nivel de log) y `docker compose restart mosquitto`.
- **Lección:** "conectado" no es "autorizado", y con MQTT 3.1.1 la pérdida es silenciosa, incluso en los logs. Lo mejoran la Fase 18 (MQTT 5 con códigos de motivo) y la Fase 27.

### 6. Unit ID equivocado

- **Reporte:** "Hay alerta de silencio solo en MTR-01. MTR-02 está bien."
- **Aplicar:** `respaldar`, después `sed -i 's/^GATEWAY_EQUIPOS=.*/GATEWAY_EQUIPOS=3:MTR-01,2:MTR-02/' .env` y `docker compose --profile completo up -d gateway`.
- **Evidencia:** el log del gateway repite `equipo_sin_respuesta` con `motor: MTR-01`, `unitId: 3` y la excepción Modbus 11 (el equipo detrás del gateway no responde).
- **Datos:** **hueco real e irrecuperable.** Nadie leyó el equipo. El buffer protege el enlace, no la lectura.
- **Pistas:** (1) ¿El problema está antes o después del gateway? (2) Lee el log del gateway filtrando por MTR-01. (3) ¿Qué significa la excepción 11 y a qué Unit ID se le pregunta?
- **Revertir:** `cp datos/simulacro/env.antes .env` y `docker compose --profile completo up -d gateway`.
- **Lección:** seguir el dato hasta el equipo, y leer el código de excepción Modbus. Lo mejoran la Fase 18 (estado de comunicación por equipo) y la Fase 29 (punto a punto).

### 7. Horas en UTC: falsa alarma

- **Reporte:** "Consulté MySQL y las lecturas llegan con 3 horas de adelanto. Hay que corregir la hora del gateway."
- **Aplicar:** nada. El sistema está sano.
- **Respuesta esperada:**
  - comprueba con evidencia antes de cambiar algo: `SELECT UTC_TIMESTAMP(), NOW(), MAX(ts) FROM lecturas`;
  - la base guarda UTC por diseño, y Chile está en UTC−3 (en horario de verano). La conversión le corresponde a quien muestra el dato;
  - no se corrige nada, y se explica a quien reportó.
- **Pistas:** (1) ¿En qué zona horaria guarda la base? (2) ¿Qué hora muestra el dashboard para el mismo dato?
- **Lección:** verificar antes de arreglar. "Corregir" la hora habría dañado datos buenos. Lo trata la Fase 22 (horas en UTC, el front convierte).

### 8. Clave de API revocada

- **Reporte:** "El SCADA del cliente norte recibe 401 desde hace unos minutos. Ayer funcionaba."
- **Aplicar:**
  1. Crea una clave con nombre único y guárdala sin mostrarla:
     ```bash
     mkdir -p datos/simulacro
     NOMBRE="scada-sim-$(date -u +%Y%m%d%H%M)"
     npm run --silent clave-api -- "$NOMBRE" norte > datos/simulacro/clave.txt
     ```
  2. Haz tres llamadas con 20 s entre una y otra, como el SCADA: `curl -s -o /dev/null -w '%{http_code}\n' -H "X-API-Key: $(cat datos/simulacro/clave.txt)" "localhost:3000/api/integracion/estado?sitio=norte"`. Deben dar 200.
  3. Revoca: `echo "UPDATE claves_api SET activa = FALSE WHERE nombre = '$NOMBRE';" | sql_root`.
  4. Haz una llamada más. Debe dar 401.
- **Evidencia:**
  - `GET /api/auditoria`: los 200 de `/api/integracion/estado` tienen como usuario el nombre de la clave; el 401 aparece con usuario vacío;
  - `SELECT nombre, activa, ultimo_uso FROM claves_api` → inactiva, y `ultimo_uso` se detuvo;
  - nadie sabe quién la revocó: la tabla no guarda ese cambio.
- **Datos:** ninguno se pierde; el SCADA dejó de leer.
- **Pistas:** (1) Busca esas peticiones en la auditoría. (2) ¿Cambió la clave o cambió su estado? (3) `claves_api`.
- **Revertir:** la clave se deja revocada, porque ningún sistema real la usa. Anota su nombre en la ficha. En la vida real, se reactiva o se emite una nueva después de confirmar con el cliente.
- **Lección:** la auditoría sirve para reconstruir la historia, y los cambios administrativos también deben auditarse. Lo mejoran las fases 25 y 27.

### 9. Secreto de los tokens rotado

- **Precondición:** pídele que deje el dashboard abierto con su sesión iniciada. No le digas por qué.
- **Reporte:** "Todos los usuarios quedaron fuera a la vez, y nadie puede seguir sin volver a entrar."
- **Aplicar:** `respaldar`, después `sed -i "s/^JWT_SECRETO=.*/JWT_SECRETO=$(openssl rand -hex 32)/" .env` y `docker compose --profile completo up -d api`.
- **Evidencia:**
  - la auditoría muestra 401 para todos los usuarios desde una misma hora;
  - el log `api_iniciada` es de esa hora: hubo un reinicio con un cambio de configuración;
  - un login nuevo funciona.
- **Datos:** ninguno se pierde. La ingesta no usa los tokens.
- **Pistas:** (1) ¿Desde qué hora exacta, y qué pasó a esa hora? (2) ¿Qué invalida a la vez todos los tokens firmados?
- **Revertir:** `cp datos/simulacro/env.antes .env` y `docker compose --profile completo up -d api`.
- **Lección:** rotar el secreto cierra todas las sesiones. A veces se hace a propósito, en un incidente, pero debe ser una decisión y no un efecto lateral de un despliegue.

### 10. Configuración inválida

- **Reporte:** "La API se reinicia en bucle desde el cambio de hoy."
- **Aplicar:** `respaldar`, después `sed -i 's/^JWT_SECRETO=.*/JWT_SECRETO=corta/' .env` y `docker compose --profile completo up -d api`.
- **Evidencia:** `docker compose ps` muestra la API reiniciándose, y su log dice *Configuración inválida (revisa tu .env): JWT_SECRETO: debe tener 32 caracteres o más*.
- **Datos:** no se pierden. La sesión persistente acumula en el broker.
- **Pistas:** (1) `docker compose ps`. (2) Las primeras líneas del log de la API después de cada arranque.
- **Revertir:** `cp datos/simulacro/env.antes .env` y `docker compose --profile completo up -d api`.
- **Lección:** fallar rápido al arrancar, con un mensaje claro, ahorra el diagnóstico.

### 11. Índice eliminado

- **Precondición:** existe `ix_lecturas_calidad_ts` (`SHOW INDEX FROM lecturas`) y la tabla tiene el volumen de la Fase 11.
- **Reporte:** "La consulta de las últimas lecturas fuera de rango (`practica/rendimiento.sql`, consulta C) tardaba menos de un milisegundo y ahora tarda cientos."
- **Aplicar:** pide permiso explícito, porque es DDL. Después: `echo "DROP INDEX ix_lecturas_calidad_ts ON lecturas;" | sql_root`.
- **Evidencia:** `EXPLAIN ANALYZE` de la consulta C ya no usa el índice, y `SHOW INDEX FROM lecturas` no lo muestra. El *slow log* no la registra: con unos 330 ms queda bajo `long_query_time = 1`.
- **Datos:** ninguno se pierde.
- **Pistas:** (1) Mira el plan, no el reloj. (2) Compara los índices actuales con `sql/004_rendimiento.sql`.
- **Revertir:** `echo "CREATE INDEX ix_lecturas_calidad_ts ON lecturas (calidad, ts);" | sql_root`. Tarda unos segundos.
- **Lección:** la deriva del esquema. Lo mejora la Fase 16, con migraciones y un esquema comparable entre bases.

### 12. Dos lectores sobre el mismo equipo

- **Precondición:** existe el volumen `telemetria_datos-nodered` con el flujo de la Fase 10 (`docker volume ls`), y `GATEWAY_EQUIPOS` incluye `2:MTR-02`.
- **Reporte:** "MTR-02 tiene más del triple de lecturas que MTR-01 en la última hora. ¿Está bien?"
- **Aplicar:** `docker compose --profile nodered up -d nodered`. El gateway sigue leyendo MTR-02.
- **Evidencia:**
  - el conteo por minuto da unas 12 por variable para MTR-01 y unas 42 para MTR-02;
  - `mosquitto_sub` muestra mensajes de MTR-02 con `"gateway":"gw-norte"` y con `"gateway":"node-red"`;
  - `lecturas` no guarda el gateway, así que en la base no se ve el origen.
- **Datos:** no se pierden. Hay de más: dos series intercaladas con horas distintas, que la PK no puede deduplicar.
- **Pistas:** (1) ¿Cada cuánto llegan las lecturas de MTR-02? (2) Escucha el tópico de MTR-02 y mira el campo `gateway`.
- **Revertir:** `docker compose stop nodered`.
- **Lección:** un solo lector por equipo. En RS485, dos maestros además se pisan y leen basura. Lo mejoran la Fase 18 (`perfil` y `seq` en el mensaje) y la Fase 20.

### 13. Cola del broker demasiado chica

- **Reporte:** "La API estuvo detenida 5 minutos por mantenimiento y ahora falta una parte de ese tramo. ¿No era que el broker guardaba todo?"
- **Aplicar:**
  1. `sed -i 's/^max_queued_messages .*/max_queued_messages 20/' mosquitto/mosquitto.conf` y `docker compose restart mosquitto`.
  2. `docker compose stop api`, espera 5 minutos y `docker compose start api`.
- **Evidencia:**
  - en `lecturas`, el tramo de la parada tiene datos solo al comienzo (20 mensajes, cerca de un minuto con dos motores) y después un hueco;
  - el log del broker dice `Outgoing messages are being dropped for client api-ingesta.`;
  - `git diff mosquitto/` muestra el cambio.
- **Datos:** **se pierde el resto del tramo.** El broker guardó los 20 primeros mensajes y descartó los siguientes.
- **Pistas:** (1) ¿Dónde estaban los mensajes mientras la API estaba detenida? (2) ¿Cuántos guarda el broker por cliente? (3) `git diff mosquitto/`.
- **Revertir:** `git checkout mosquitto/mosquitto.conf` y `docker compose restart mosquitto`.
- **Lección:** cada cola tiene un tope que hay que dimensionar para la caída esperada. Lo trata la Fase 26 (contrapresión de punta a punta).

### 14. Disco que crece

- **Reporte:** "El volumen de MySQL ocupa varios GB y sigue creciendo. ¿Qué es, y qué podemos borrar?"
- **Aplicar:** nada. Es una investigación.
- **Respuesta esperada:**
  - mide antes de opinar: `docker system df -v`; dentro del contenedor, `du -sh /var/lib/mysql/*`, `SHOW BINARY LOGS` e `information_schema.TABLES`;
  - una parte grande suelen ser los binlogs de las cargas de volumen, del `DELETE` de un mes y de la restauración de prueba. MySQL 8.4 los conserva 30 días (`binlog_expire_logs_seconds`);
  - **no se borran a mano.** Se usa `PURGE BINARY LOGS BEFORE ...`, y solo después de decidir cuánta recuperación a un punto en el tiempo se necesita (Fase 24).
- **Pistas:** (1) ¿Qué archivos son los más grandes? (2) ¿Qué guardan los `binlog.0000NN`?
- **Lección:** medir el disco por componente, y nunca borrar archivos del motor de base de datos con `rm`. Lo tratan las fases 24 y 26.

### 15. Caída abrupta del broker

- **Reporte:** "Anoche se cortó la luz del servidor del broker. La API estaba detenida por mantenimiento. Al volver todo, falta el tramo en que la API estuvo abajo, aunque el broker debía guardarlo."
- **Aplicar:**
  1. `docker compose stop api` y espera 3 minutos: los mensajes se acumulan en la sesión de `api-ingesta`.
  2. `docker compose kill mosquitto` (SIGKILL: el broker no alcanza a guardar) y `docker compose start mosquitto`.
  3. `docker compose start api`.
- **Evidencia:**
  - un hueco en `lecturas` de norte que coincide con la parada de la API;
  - al reconectar, `mqtt_conectado` dice `recuperada` si la sesión estaba en el último guardado, o `nueva` si no. En los dos casos, los mensajes acumulados después de ese guardado no llegan;
  - `docker compose ps` muestra que el broker se reinició hace poco, y su log no muestra descartes por cola llena;
  - `mosquitto.conf` no define `autosave_interval`, así que vale 1.800 s.
- **OJO:** si justo hubo un guardado automático durante la parada, llega una parte del tramo. Es raro (cerca de una vez en diez con 3 minutos de parada); si pasa, explícalo en el cierre.
- **Datos:** **se pierde el tramo completo.** El broker los había confirmado (el gateway los borró de su buffer) y no alcanzó a guardarlos en disco.
- **Pistas:** (1) ¿Dónde estaban esos mensajes mientras la API estaba detenida? (2) ¿Cómo se apagó el broker, y cuándo escribe su cola en disco?
- **Revertir:** nada que revertir; el sistema queda sano. El hueco queda como evidencia en la ficha.
- **Lección:** una garantía de entrega vale lo que vale su persistencia. Un servicio con datos en cola se reinicia en orden, nunca con `kill`. Lo mejora la Fase 26, paso 9.

## 4. La ficha

Crea `docs/simulacros/AAAA-MM-DD-<nombre-corto>.md` con:
- el reporte;
- las horas reales de aplicación y de reversión;
- las pistas usadas;
- el tiempo hasta el diagnóstico.

Deja para él las secciones de diagnóstico, evidencia, qué pasó con los datos, prevención y "lo que le faltó al sistema". Agrega una fila a la tabla de `docs/simulacros/README.md`.
