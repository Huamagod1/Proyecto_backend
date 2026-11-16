# Runbook · qué hacer cuando algo falla

Procedimientos cortos para operar la plataforma. Los comandos asumen el despliegue con Docker
(`docker compose --profile completo`); con systemd (Fase 13), cambia `docker compose logs api` por
`journalctl -u telemetria-api` y `restart api` por `systemctl restart telemetria-api`.
Los logs son JSON: `docker compose logs api --no-log-prefix | jq 'select(.nivel != "info")'`.

## 1. Un sitio dejó de enviar datos (alerta `motor_en_silencio`) · probado el 2026-11-16

1. **Confirma el alcance:** `GET /api/metricas` (admin) → `motoresSinDatos`. ¿Un motor o todo el sitio?
2. **¿Llega algo al broker?** `docker compose exec mosquitto mosquitto_sub -u api -P "$MQTT_CLAVE" -t 'motores/norte/#' -v -W 15`.
3. **Estado del gateway:** el retenido `motores/norte/gateways/gw-norte/estado`. `offline` = el gateway se cayó o perdió el enlace (Last Will).
4. **Si el gateway está vivo:** `docker compose logs gateway --since 10m`. `modbus_sin_conexion` o `equipo_sin_respuesta` = el problema está entre el gateway y los equipos (red de la faena, controlador apagado). `mqtt_sin_enlace` = el problema es el enlace hacia el broker: el buffer está guardando y drenará al volver.
5. **Si el problema es del gateway:** `docker compose restart gateway`. El buffer SQLite está en un volumen: no se pierde nada.
6. **Si llegan mensajes al broker pero no a MySQL:** revisa `mqtt.rechazos` en `/api/metricas` (por ejemplo, `motor_desconocido`) y los logs de la API.
7. **Cierre:** espera el evento `motor_recuperado` y confirma en el dashboard que el motor ya no está en rojo. Anota la causa.

## 2. La API no responde

1. `curl -s localhost:3000/api/salud` → si no responde, el proceso está caído o colgado.
2. `docker compose ps api` (o `systemctl status telemetria-api`): ¿reiniciando en bucle?
3. `docker compose logs api --since 10m | jq 'select(.nivel=="error")'`: busca `api_puerto_ocupado` o un error al arrancar (por ejemplo, `Configuración inválida` = falta una variable en `.env`).
4. Si `/api/salud` responde pero `/api/listo` da 503, mira el campo que falla: `db` (paso 5) o `mqtt` (paso 6).
5. **Base:** `docker compose ps mysql` y `docker compose logs mysql --since 10m`.
6. **Broker:** `docker compose ps mosquitto`; un `Not authorized` en los logs de la API = la clave de `.env` no calza con `mosquitto/passwd` (corre `bash src/scripts/claves-mqtt.sh`).
7. Reinicia solo lo que falló: `docker compose restart api`. La sesión MQTT persistente evita perder mensajes.

## 3. La base está lenta

1. **Mide antes de tocar:** `docker compose exec mysql sh -c 'tail -n 40 /var/lib/mysql/*-slow.log'`: qué consulta, cuánto (`Query_time`) y cuántas filas examinó.
2. `SHOW PROCESSLIST;` como root: ¿consultas largas en curso o bloqueadas (`Waiting for ... lock`)?
3. `EXPLAIN ANALYZE <la consulta>`: busca `Table scan` o muchas `rows` examinadas.
4. ¿Falta un índice que calce con el `WHERE` y el `ORDER BY`? Créalo y vuelve a medir (ver `docs/rendimiento.md`).
5. ¿Es un dashboard que agrega días de datos crudos? Debe leer `lecturas_hora`. ¿Corre el evento? `SHOW EVENTS;`.
6. ¿La partición actual existe? `SELECT PARTITION_NAME, TABLE_ROWS FROM information_schema.PARTITIONS WHERE TABLE_NAME='lecturas';`. Sin la del mes, todo cae en `p_futuro`.
7. Anota la consulta, el antes y el después.

## 4. Restaurar un respaldo · probado el 2026-11-16

1. Elige el respaldo: `ls -lt /var/backups/telemetria/` (en desarrollo, `datos/respaldos/`).
2. **Restaura primero en una base aparte**, nunca encima de la buena:
   `docker exec -i telemetria-mysql-1 sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "CREATE DATABASE telemetria_restore"'`
3. `gunzip -c <respaldo>.sql.gz | docker exec -i telemetria-mysql-1 sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" telemetria_restore'`
4. Compara conteos con la original (motores, usuarios, lecturas hasta la hora del respaldo, `lecturas_hora`) y revisa que esté el evento (`SHOW EVENTS FROM telemetria_restore`).
5. Si hay que reemplazar la base: detén la ingesta (`docker compose stop api gateway`) para no escribir durante el cambio.
6. Restaura sobre `telemetria` (o renombra las tablas) y levanta la ingesta: `docker compose start api gateway`. Los gateways drenan lo que guardaron mientras tanto.
7. Borra `telemetria_restore` y anota qué se perdió (desde la hora del respaldo hasta el corte).

Prueba real (2026-11-16): 8,7 MB comprimidos, restaurados en 27 s, 2.426.101 lecturas idénticas a las originales.
