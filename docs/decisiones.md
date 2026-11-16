# Decisiones de diseño

Cada decisión con su motivo y lo que se descartó. Las seis primeras son las que más pesan y las que
conviene saber contar en una entrevista.

## 1. PK compuesta `(motor_id, variable_id, ts)` en `lecturas`
- **Por qué:** en InnoDB la PK es el orden físico. Las consultas siempre preguntan "este motor, esta variable, este rango de tiempo", y ese rango queda contiguo en disco (la serie de 24 h lee 8.839 filas en 3,5 ms entre 2,4 millones).
- **Además:** la misma PK es la idempotencia: una lectura repetida choca y `ON DUPLICATE KEY UPDATE` la ignora.
- **Descartado:** un `id` autoincremental como PK, que obligaría a un índice secundario más y dejaría pasar duplicados.

## 2. QoS 1 más idempotencia en la base
- **Por qué:** QoS 1 garantiza "al menos una vez" con dos viajes; los duplicados (reenvíos del broker o del buffer) los absorbe la PK.
- **Descartado:** QoS 2 ("exactamente una vez") cuesta cuatro viajes y solo protege hasta el broker; QoS 0 pierde mensajes.
- **Límite conocido:** mqtt.js confirma al recibir; si la API muere de golpe se pierde lo que el loteador tenía en memoria (hasta 1 s). La mejora: confirmar después de escribir (`handleMessage`).

## 3. Store-and-forward en el gateway
- **Por qué:** cada mensaje se guarda en SQLite **antes** de publicarse y se borra solo con el PUBACK. Un corte del enlace no pierde nada: probado con cortes de 30 y 61 s, sin huecos, y con mensajes que llegaron 10,5 horas después con su hora original.
- **Límite:** protege del corte del enlace, no de un gateway apagado (si nadie lee los equipos, no hay datos que guardar).

## 4. JWT de vida corta (15 minutos)
- **Por qué:** un JWT no se puede revocar sin guardar estado; si lo roban, sirve poco tiempo. HS256 con `algorithms` explícito (rechaza `alg: none`) y el WebSocket se cierra cuando el token vence.
- **Siguiente paso:** un refresh token revocable para sesiones largas.

## 5. Agregados por hora (`lecturas_hora`)
- **Por qué:** un dashboard de 7 días no necesita 60.000 puntos por motor. El promedio por hora del sitio bajó de 268 ms a 1,2 ms. Un `EVENT` recalcula cada hora las dos últimas (por los datos atrasados de un buffer).
- **Ojo:** se combina ponderando por `n`; el promedio de promedios engaña.

## 6. Particiones por mes
- **Por qué:** borrar un mes viejo soltando su partición no depende del número de filas (28,4 s de `DELETE` contra 3,9 s de `DROP PARTITION` en Docker Desktop), y una consulta de un mes solo abre su partición.
- **Precio:** `lecturas` no puede tener FK (por eso la validación vive en la API con el catálogo) y hay que crear la partición de cada mes (`REORGANIZE PARTITION p_futuro`).

## Cómo se conectaría un EMS por MQTT (Fase 14)
- Con su **propia credencial** en el broker (usuario `ems`, clave en `mosquitto/passwd` vía `claves-mqtt.sh`) y una **ACL de solo lectura** sobre su sitio: `user ems` + `topic read motores/norte/#` (ejemplo comentado en `mosquitto/acl`).
- Recibe en vivo la telemetría, el estado retenido de los gateways y el resumen retenido de motores sin datos (`motores/norte/alertas`): al suscribirse, el broker le entrega de inmediato el último estado.
- **Por qué MQTT y no solo REST:** el EMS no tiene que preguntar cada pocos segundos; y como no puede publicar, aunque roben su clave no puede inyectar datos.
- Para SCADA que solo hablan HTTP: `GET /api/integracion/estado?sitio=norte` con `X-API-Key` (clave por sistema, guardada como SHA-256, revocable y auditada).

## El token del WebSocket viaja en la URL (Fase 9)

- **Decisión:** el dashboard abre `ws://host/ws?token=<JWT>` y el servidor verifica el token en el `upgrade`, antes de aceptar la conexión.
- **Por qué:** la API `WebSocket` del navegador no permite agregar encabezados (no hay `Authorization`). La URL es lo más simple para practicar.
- **El costo:** la URL completa puede quedar en los logs de nginx o de un proxy, y con ella el token, válido hasta 15 minutos.
- **Mitigaciones que ya están:** el token dura 15 minutos y el servidor cierra la conexión con el código 4001 cuando vence; la auditoría de la API no registra el `/ws`.
- **La mejora:** un *ticket* de un solo uso. El dashboard pide `POST /api/ws-ticket` con su JWT en el encabezado; el servidor devuelve un número aleatorio que vale 30 segundos y una sola vez, y el WebSocket se abre con `?ticket=...`. Si ese ticket queda en un log, ya no sirve.
- **Otras opciones:** mandar el token en el primer mensaje después de conectar (hay que aceptar sockets sin autenticar por un instante) o usar una cookie `HttpOnly` (exige protección CSRF y que API y dashboard compartan dominio).

## Node-RED o un servicio en código (Fase 10)

- **Rapidez:** Node-RED arma un Modbus → MQTT en minutos y se ajusta en terreno sin compilar; el gateway en código tomó horas.
- **Visibilidad:** en Node-RED el flujo se ve completo y cada nodo muestra su estado; en código hay que leer logs.
- **Pruebas:** el código tiene pruebas automáticas (`npm test`); en Node-RED se prueba a mano, inyectando mensajes. El inject sin payload que el getter descartaba en silencio es un ejemplo: en código, una prueba lo habría atrapado.
- **Buffer:** el gateway en código guarda en SQLite antes de publicar y no pierde nada en un corte; el flujo de Node-RED publica directo y lo que se lee durante un corte se pierde (habría que agregar un nodo de cola persistente).
- **Versionado:** el código se revisa línea a línea en un PR; el flujo es un JSON grande y difícil de revisar en un diff. Lo exporto a `flows/gateway-modbus.json` y la lógica del nodo function vive aparte en `flows/funcion-decodificar.js`.
- **Conclusión:** Node-RED en el borde para integrar rápido y ajustar en terreno; servicios en código en el centro, donde importan las pruebas, el buffer y la revisión. Muchas veces conviven.

## Varias instancias de la API (Fase 9)

- Hoy cada dashboard recibe lo que escribe **su** instancia de la API. Con dos instancias detrás de un balanceador, un cliente conectado a la instancia A no vería lo que ingiere la B.
- La solución es un bus compartido entre instancias: el propio MQTT (cada instancia publica lo que confirmó en un tópico interno y todas lo reenvían a sus clientes) o Redis Pub/Sub.
