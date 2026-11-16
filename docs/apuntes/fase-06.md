# Fase 6 · MQTT: broker, tópicos y loteador

## Mapa
- Mosquitto 2.1 en Compose, con persistencia, usuarios (`passwd`) y permisos (`acl`) cargados por plugins.
- La API se conecta como `api-ingesta` con `clean: false` y se suscribe con QoS 1 a `motores/+/+/telemetria` y `motores/+/gateways/+/estado`.
- Cada mensaje: JSON → forma (zod) → motor del tópico → `evaluarLectura` por variable → loteador.
- El loteador escribe con `guardarLote` cada 500 filas o cada 1 s, una escritura a la vez, y reintenta si la base falla.

## Conceptos
- **Publicar/suscribir:** el gateway no conoce a la API; los une el broker por tópico.
- **QoS 0, 1 y 2:** a lo más una vez, al menos una vez, exactamente una vez (hasta el broker).
- **Sesión persistente:** `clientId` fijo y `clean: false`; el broker guarda los QoS 1 mientras estás desconectado.
- **Mensaje retenido:** el broker guarda el último de un tópico y se lo da a cada suscriptor nuevo.
- **Last Will:** el mensaje que el broker publica por ti si te desconectas sin avisar (Fase 7).
- **Loteo:** muchas filas en un solo INSERT; el costo fijo de cada viaje a la base se reparte.
- **ACL:** lista blanca de tópicos por usuario; publicar fuera de ella se descarta (MQTT 5: código 135).

## Decisiones
- QoS 1 + PK idempotente → mismo efecto que QoS 2 con la mitad de viajes.
- El lote sale de la cola antes de escribir y vuelve al frente si falla → orden y sin pérdidas.
- Tope de 50 000 filas en memoria, descartando las más antiguas → la API no muere por falta de memoria si la base cae mucho rato.
- `max_queued_messages 100000` en el broker → el valor por defecto (1000) perdería datos con la API caída unos minutos.
- Plugins `mosquitto_password_file` y `mosquitto_acl_file` → `password_file` y `acl_file` están obsoletos en 2.1.
- Imagen `eclipse-mosquitto:2.1-alpine` → la 2.1 no existe sin el sufijo (desvío del plan, ya corregido ahí).
- `claves-mqtt.sh` crea `passwd` como uid 1883 y ajusta el dueño del `acl` → el broker corre como `mosquitto` y con root no podía leerlo.
- Ack al recibir (por defecto en mqtt.js) → si la API muere de golpe, se pierde hasta 1 s en memoria; la alternativa es confirmar después de escribir.

## Comandos para saber de memoria
```bash
docker compose exec mosquitto mosquitto_sub -u api -P "$MQTT_CLAVE" -t 'motores/#' -v
docker compose exec mosquitto mosquitto_pub -u gw-norte -P "$GATEWAY_MQTT_CLAVE" -q 1 -t motores/norte/MTR-01/telemetria -m '{...}'
bash src/scripts/claves-mqtt.sh          # recrea usuarios y reinicia el broker
docker compose logs -f mosquitto
```

## Preguntas de entrevista
- **¿QoS 0, 1 o 2 para telemetría?** QoS 1, que asegura que el mensaje llegue al menos una vez; los duplicados los absorbe la clave única de la base. QoS 2 cuesta más viajes y no protege nada más allá del broker.
- **¿Qué pasa si la API se reinicia?** La sesión persistente guarda los mensajes QoS 1 en el broker y los entrega al reconectar. Lo probé: 20 mensajes publicados con la API apagada llegaron los 20.
- **¿Por qué escribir en lotes?** Cada INSERT tiene un costo fijo de red, parseo y commit; mil filas en un INSERT cuestan casi lo mismo que una. Si la base cae, el loteador conserva y reintenta en orden.

## Ejercicios a mano
1. Escribe de memoria el loteador, solo con el disparo por tamaño.
2. Publica un mensaje retenido y explica qué recibe un suscriptor que llega después.
