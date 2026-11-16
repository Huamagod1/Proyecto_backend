# Tópicos MQTT

El broker es Mosquitto 2.1 (`mosquitto:1883`). Los tópicos parten por el sitio, así la ACL puede dar
permisos por faena con un comodín: `motores/norte/#`.

| Tópico | Publica | Lee | QoS | Retenido | Contenido |
|---|---|---|---|---|---|
| `motores/{sitio}/{motor}/telemetria` | gateway del sitio, Node-RED, CAN | API (`api-ingesta`) | 1 | no | lecturas de un motor en un instante |
| `motores/{sitio}/gateways/{id}/estado` | gateway (y su Last Will) | API, dashboard | 1 | sí | `online` u `offline` |
| `motores/{sitio}/alertas` | API (Fase 14) | dashboard, EMS | 1 | sí | la última alerta de silencio del sitio |

## Mensaje de telemetría

```json
{ "motor": "MTR-01", "gateway": "gw-norte", "ts": "2026-11-15T10:00:00.000Z",
  "lecturas": { "rpm": 1500, "temp_refrigerante": 85.2 } }
```

- `ts`: la hora del equipo que midió, en ISO 8601 y UTC. Todas las lecturas del mensaje comparten esa hora.
- `lecturas`: un objeto variable → valor numérico; la API lo convierte en una fila por variable.
- El `motor` del mensaje debe coincidir con el del tópico; si no, la API lo rechaza (`topico_no_coincide`).

## Comodines

- `+` reemplaza un nivel: `motores/+/+/telemetria` = la telemetría de todos los motores de todos los sitios.
- `#` reemplaza el resto, y va al final: `motores/norte/#` = todo lo del sitio norte.

## Por qué QoS 1

QoS 0 puede perder mensajes; QoS 2 garantiza "exactamente una vez" con cuatro viajes por mensaje y
solo hasta el broker. QoS 1 asegura "al menos una vez", y los duplicados los absorbe la PK de
`lecturas` (motor, variable, ts): mismo resultado que QoS 2, con la mitad de viajes.

## Usuarios y permisos (archivo `mosquitto/acl`)

| Usuario | Puede |
|---|---|
| `api` | leer `motores/#` |
| `gw-norte` | escribir `motores/norte/#` |
| `gw-sur` | escribir `motores/sur/#` (publicador CAN de MTR-03, Fase 8) |

Las fases 10 y 14 suman `nodered` y `ems`.
