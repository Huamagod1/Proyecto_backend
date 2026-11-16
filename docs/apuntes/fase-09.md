# Fase 9 · Tiempo real: WebSocket y dashboard

## Mapa
- `tiempo-real.js` atiende el `upgrade` en `/ws`, verifica el JWT de la URL y recién entonces acepta el socket.
- El loteador avisa **después** del commit (`alEscribir`) → `lecturasAMensajes` arma un mensaje por motor → `difundir` filtra por sitio.
- La ingesta MQTT avisa cada cambio de estado de un gateway; al conectarse, cada dashboard recibe la foto actual.
- `public/` (HTML, JS y CSS sin frameworks) hace el login, pide la foto inicial por REST y se actualiza por WebSocket.

## Conceptos
- **WebSocket:** una conexión abierta en la que el servidor habla cuando tiene algo nuevo.
- **Upgrade:** la petición HTTP que pide cambiar de protocolo; se puede rechazar antes de aceptar.
- **Ping/pong:** latido que detecta conexiones muertas que TCP todavía cree abiertas.
- **Códigos de cierre:** 1001 = el servidor se va; 4000-4999 = de la aplicación (4001: token vencido).
- **CSP:** la política que dice qué scripts y conexiones acepta la página; bloquea el JavaScript en línea.
- **`textContent` y no `innerHTML`:** el texto que llega de afuera se pinta como texto, nunca como HTML (evita XSS).

## Decisiones
- Autenticar en el `upgrade` → no hay sockets abiertos de desconocidos consumiendo memoria.
- Avisar después del commit → el dashboard nunca muestra un dato que no quedó guardado.
- La conexión se cierra cuando vence el token → no sobrevive a la sesión.
- Sin `upgrade-insecure-requests` en la CSP → en `http://localhost` el navegador pediría todo por HTTPS y no cargaría.
- Estáticos antes de la auditoría → los `.js` y `.css` no llenan la tabla.
- Reconexión con espera creciente (1, 2, 4... 30 s) → no satura al servidor si está caído.

## Comandos para saber de memoria
```bash
npx wscat -c "ws://localhost:3000/ws?token=$TOKEN"     # cliente WebSocket de terminal
node --env-file=.env.test --test test/tiempo-real.test.js
```
En el navegador: F12 → Network → WS, para ver los mensajes.

## Preguntas de entrevista
- **¿Cuándo usarías WebSocket y cuándo REST?** WebSocket para empujar datos en vivo a un dashboard; REST para consultar la historia y hacer cambios. En WebSocket se autentica al abrir la conexión, se filtra cada mensaje por permisos y se detectan las conexiones muertas con ping.
- **¿Por qué autenticas en el upgrade?** Porque aceptar primero deja a cualquiera mantener sockets abiertos. Rechazar con un 401 antes del cambio de protocolo no cuesta nada.
- **¿Qué cambia con dos instancias de la API?** Hace falta un bus compartido (MQTT o Redis) para que cada instancia reenvíe lo que escribieron las demás.

## Ejercicios a mano
1. Escribe de memoria la verificación del token en el `upgrade`.
2. Marca en rojo en el dashboard un motor con más de 1 minuto sin datos (ya está hecho: compáralo con tu versión).
