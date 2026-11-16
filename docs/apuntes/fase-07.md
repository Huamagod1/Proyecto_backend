# Fase 7 · Terreno: simulador Modbus y gateway con buffer

## Mapa
- El simulador es un `ServerTCP` en el puerto 5020: Unit 1 = MTR-01 y Unit 2 = MTR-02, con 8 holding registers que cambian cada segundo.
- El gateway lee cada equipo con la función 03, decodifica (int16, escalas, float32 CDAB, 0x7FFF) y arma el JSON de `docs/topicos.md`.
- Cada mensaje se guarda en SQLite **antes** de publicarse; `drenar()` lo publica con QoS 1 y lo borra solo con el PUBACK.
- El Last Will retenido es `offline`: si el gateway muere sin avisar, el broker lo publica por él.

## Conceptos
- **Holding register:** registro de 16 bits sin signo, de lectura y escritura; la dirección 0 es el "40001" del manual.
- **Unit ID:** el número de cada equipo en el bus o detrás de un gateway Modbus TCP.
- **Función 03:** Read Holding Registers. El maestro pregunta y el esclavo responde.
- **Complemento a dos:** de 0x8000 en adelante, el registro es negativo (65 486 → −50).
- **Orden de palabras (ABCD o CDAB):** cómo se reparte un float32 en dos registros; con el orden equivocado sale basura sin error.
- **Store-and-forward:** guardar en disco y reenviar después; el corte no borra nada.
- **Last Will:** el mensaje que el broker publica si el cliente se cae sin DISCONNECT.

## Decisiones
- Guardar antes de publicar → si el enlace o el proceso caen después, el dato ya está en disco.
- Borrar al recibir el PUBACK → si el gateway muere a medio envío, se reenvía y la PK absorbe el duplicado.
- `drenar()` sin `await` en el ciclo → un drenaje largo no detiene las lecturas (no abre huecos).
- `setTimeout` encadenado y compensado → los ciclos no se montan y la cadencia queda en 5 s exactos.
- `synchronous = FULL` en SQLite → cada commit va a disco; con un mensaje cada pocos segundos no se nota.
- La hora la pone el gateway al leer → lo que espera horas en el buffer conserva su hora real.

## Resultados reales
- Corte de 61 s: 24 mensajes acumulados y drenados, sin huecos (intervalos de 5,03 a 5,05 s).
- Corte de anoche: 6 mensajes quedaron en el buffer y llegaron a MySQL 10,5 h después, con su hora original.
- `Stop-Process -Force` al gateway (un `kill -9`): el estado retenido pasó a `offline`.

## Comandos para saber de memoria
```bash
npm run simulador        # en la terminal de VS Code: teclas t, f, d
npm run gateway
docker compose stop mosquitto && docker compose start mosquitto
taskkill /F /PID <pid>   # kill -9 en Windows (con MSYS_NO_PATHCONV=1)
docker compose exec mosquitto mosquitto_sub -u api -P "$MQTT_CLAVE" -t 'motores/+/gateways/+/estado' -v
```

## Preguntas de entrevista
- **¿Qué pasa si se cae internet en la faena?** El gateway guarda cada lectura en SQLite antes de publicarla, la borra solo cuando el broker confirma y, al volver el enlace, drena en orden. Las lecturas llevan la hora del equipo, la clave única absorbe los reenvíos y el Last Will avisa que el gateway quedó desconectado.
- **¿Cuál es el bug del orden de palabras?** Un float32 ocupa dos registros, y cada fabricante decide cuál va primero. Si lees CDAB como ABCD obtienes un número absurdo sin ningún error; por eso se valida con un valor conocido.
- **¿Qué es un Unit ID?** El número de cada esclavo; en Modbus TCP identifica al equipo detrás de un gateway o de una misma IP.

## Ejercicios a mano
1. Escribe de memoria `aInt16` y `registrosAFloat`.
2. Agrega la variable `frecuencia` (registro 8, uint16, 0,01 Hz) de punta a punta.
