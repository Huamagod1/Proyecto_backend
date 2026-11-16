# Progreso

| Fecha | Fase | Qué se hizo | Dudas abiertas |
|---|---|---|---|
| 2026-11-15 | 0 | Entorno revisado: Windows 11 con Git Bash, Node 24.4.1, Docker Desktop y Git. Plan adaptado a Windows y a `Proyecto_backend`. | Pendientes tuyos: llave SSH en Huamagod1, Node 26 LTS, `jq` y `MSYS_NO_PATHCONV=1` en `~/.bashrc`. La referencia `../lab-telemetria-motores/` no está. |
| 2026-11-15 | 1 | Esqueleto: `package.json` como ES module, carpetas, `.gitignore`, `.gitattributes`, `.env.example`, `README.md`. | Practicar a mano el flujo de ramas y PR: las fases se hicieron directo en `main`. |
| 2026-11-15 | 2 | MySQL 8.4 en Docker: esquema, datos iniciales, `telemetria_app` con permisos mínimos (clave desde `.env`), cinco consultas y `EXPLAIN` con `range` sobre la PK. | Por qué la consulta con JOIN por código hace `filesort` y la con id no. |
| 2026-11-15 | 3 | API Express 5: config con zod, pool, salud, CRUD de motores con 201/404/409/422/400, apagado ordenado y 11 pruebas con supertest. | El apagado con SIGTERM no se puede probar en Windows: queda para la Fase 12. |
| 2026-11-15 | 4 | Login con bcrypt y JWT HS256 de 15 min, roles, permiso por sitio dentro del SQL, límite de 5 intentos, auditoría solo inserción, helmet; 24 pruebas. | Revocar tokens antes de que venzan (lista negra o refresh token). |
| 2026-11-15 | 5 | Ingesta HTTP: catálogo en memoria, `evaluarLectura` pura, lote idempotente en una transacción, series y estado; 34 pruebas. Lote de ejemplo enviado dos veces: `nuevas` 5 y luego 0. | Qué pasa con 1000 lecturas por lote y 100 gateways a la vez (lo mide la Fase 11). |
| 2026-11-15 | 6 | Mosquitto 2.1 con persistencia, usuarios y ACL por plugins; ingesta MQTT con sesión persistente; loteador con 6 pruebas (40 en total). Resiliencia: 20 mensajes con la API caída, llegaron 20. `gw-norte` no puede publicar en sur (código 135). | Confirmar el QoS 1 después de escribir en MySQL (handleMessage) para no perder el segundo en memoria. |
