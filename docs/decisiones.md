# Decisiones de diseño

Cada decisión con su motivo y lo que se descartó. Las fases 10 y 14 agregan las suyas.

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
