# Fase 2 · MySQL: modelo de datos y consultas

## Mapa
- `.env` → `docker-compose.yml` → contenedor `mysql:8.4` con un volumen con nombre y la zona horaria en UTC.
- Con el volumen vacío, MySQL ejecuta `sql/001` (tablas), `002` (sitios, motores y variables) y `003` (usuario de la API).
- `telemetria_app` solo puede leer catálogos, escribir sin borrar y agregar auditoría.
- `practica/consultas.sql` inserta lecturas de prueba y responde las cinco preguntas típicas del dashboard.

## Conceptos
- **Índice agrupado:** en InnoDB, la PK es el orden físico de la tabla; un rango de la PK son filas contiguas.
- **Idempotencia por PK:** la misma lectura (motor, variable, ts) no se puede guardar dos veces.
- **Upsert:** `INSERT ... ON DUPLICATE KEY UPDATE`; con `AS nuevo` se lee la fila entrante (reemplaza a `VALUES()`).
- **Mínimo privilegio:** cada usuario tiene solo los permisos que su trabajo exige.
- **`docker-entrypoint-initdb.d`:** los `.sql` y `.sh` de esa carpeta corren una vez, en orden alfabético, al crear la base.
- **Healthcheck:** el comando con que Docker decide si el servicio está sano; `--wait` espera a que lo esté.
- **EXPLAIN:** `type` (cómo lee: const, ref, range, ALL), `key` (qué índice) y `rows` (cuántas filas estima).

## Decisiones
- PK `(motor_id, variable_id, ts)` → calza con el orden de las consultas y da la idempotencia.
- `lecturas` sin FK → millones de inserciones sin revisar otras tablas, y particiones posibles (Fase 11).
- `estado_actual` aparte → el dashboard lee pocas filas en vez de buscar el máximo en el historial.
- `003_usuario_app.sh` con `DB_CLAVE` → la clave no queda en el repositorio público.
- Consultas en `practica/` → todo lo que está en `sql/` se ejecuta al crear la base.
- `LANG: C.UTF-8` en el contenedor → el cliente `mysql` muestra bien las tildes y el `°`.

## Comandos para saber de memoria
```bash
docker compose up -d --wait            # levanta y espera a "healthy"
docker compose ps                      # estado de los servicios
docker compose logs -f mysql           # logs (Ctrl+C para salir)
docker compose exec mysql mysql -u telemetria_app -p telemetria
docker compose exec -T mysql sh -c 'mysql -t -u telemetria_app -p"$DB_CLAVE" telemetria' < practica/consultas.sql
```
En SQL: `SHOW GRANTS FOR 'telemetria_app'@'%';` · `EXPLAIN SELECT ...;` · `SHOW CREATE TABLE lecturas;`

## Preguntas de entrevista
- **¿Cómo modelarías datos de sensores en MySQL?** Una tabla angosta con PK compuesta (motor, variable, tiempo) y fechas en UTC; una tabla chica con el último valor para el dashboard; el rango válido de cada variable en un catálogo; y, cuando crece, particiones por mes.
- **¿Por qué todo en UTC?** UTC no tiene horario de verano: no hay horas repetidas ni faltantes. Se convierte a la hora local solo al mostrar.
- **¿Qué permisos le das al usuario de la aplicación?** Los mínimos: lectura en catálogos, sin `DELETE` en ninguna tabla e inserción sola en la auditoría. Si roban esas credenciales, el daño queda acotado.

## Ejercicios a mano
1. Escribe de memoria el `CREATE TABLE` de `lecturas`, con su PK.
2. Escribe la consulta de motores sin datos en los últimos 5 minutos.
