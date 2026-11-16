# Fase 8 · CAN y J1939: decodificar tramas del motor

## Mapa
- `practica/candump-ejemplo.log`: 11 tramas de MTR-03 en formato `candump -L` (EEC1, ET1 y un CCVS).
- `parsearLineaCandump` separa hora, interfaz, id y datos; `desarmarId` saca prioridad, PGN, destino y origen.
- `decodificarTrama` elige por PGN: EEC1 → rpm (SPN 190) y ET1 → temperatura (SPN 110).
- `can-a-mqtt.js` agrupa por segundo y publica en `motores/sur/MTR-03/telemetria` como `gw-sur`; la API lo ingiere igual que lo de Modbus.

## Conceptos
- **CAN:** bus donde todos transmiten sin que nadie pregunte; el id más bajo gana el arbitraje.
- **Id de 29 bits:** prioridad (3) · EDP y DP (2) · PF (8) · PS (8) · origen (8).
- **PDU1 y PDU2:** con PF < 240, PS es el destino; con PF ≥ 240, PS es parte del PGN.
- **PGN:** qué mensaje es (EEC1 = 61444). **SPN:** qué variable va dentro (190 = rpm).
- **Little-endian:** el byte bajo primero: `E0 2E` → `0x2EE0`.
- **No disponible y error:** `0xFF`/`0xFFxx` y `0xFE`/`0xFExx`; se omiten, no se inventan.

## Decisiones
- Agrupar por segundo → EEC1 y ET1 llegan con milisegundos de diferencia y forman un instante.
- Publicar con la hora actual, conservando el espaciado del log → la ingesta rechaza horas de más de 30 días.
- Usuario `gw-sur` con escritura solo en `motores/sur/#` → el publicador CAN no puede inyectar datos en norte.
- `readline` línea por línea → un candump real pesa gigabytes y no cabe en memoria.
- `docs/j1939.md` lo escribió el agente → el plan pide reescribirlo con tus palabras (buen ejercicio de estudio).

## Comandos para saber de memoria
```bash
npm run can                                   # log de ejemplo → MQTT → MySQL
node --test test/j1939.test.js
# En Linux con can-utils:
sudo modprobe vcan && sudo ip link add dev vcan0 type vcan && sudo ip link set up vcan0
candump -L vcan0 > captura.log                # grabar
canplayer -I practica/candump-ejemplo.log vcan0=can0   # reproducir
```

## Preguntas de entrevista
- **¿Cómo leerías las rpm de un motor por CAN?** Escuchando el PGN 61444 (EEC1): las rpm son el SPN 190, en los bytes 4 y 5, little-endian, a 0,125 rpm por bit; `0xFFFF` significa no disponible. En terreno lo hace un gateway con interfaz CAN, que en Linux se maneja con SocketCAN.
- **¿En qué se diferencia CAN de Modbus?** En Modbus el maestro pregunta y el esclavo responde; en CAN cada ECU transmite sola y con prioridad por id. Por eso en CAN se escucha y se filtra por PGN.

## Ejercicios a mano
1. Arma en papel una trama EEC1 de 1800 rpm (bytes 4 y 5: `40 38`).
2. Escribe de memoria `desarmarId`.
