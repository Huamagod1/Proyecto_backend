# Fase 10 · Node-RED: el gateway en bloques

## Mapa
- Perfil `nodered` de Compose: el simulador en un contenedor (`simulador:5020`) y Node-RED 5.0 (`127.0.0.1:1880`).
- Flujo: **inject cada 2 s → Modbus Getter (Unit 2, FC3, 0-7) → function (decodificar) → mqtt out** (`motores/norte/MTR-02/telemetria`, QoS 1).
- `npm run nodered:desplegar` sube `flows/gateway-modbus.json` por la Admin API, con el código de `flows/funcion-decodificar.js` y las credenciales MQTT de `.env`.
- El gateway en código lee solo MTR-01 (`GATEWAY_EQUIPOS=1:MTR-01`) para no duplicar MTR-02.

## Conceptos
- **Flujo:** nodos conectados por cables; cada mensaje (`msg`) viaja de un nodo al siguiente.
- **Nodo de configuración:** lo comparten varios nodos (el cliente Modbus, el broker MQTT); no aparece en el lienzo.
- **Modbus Read y Modbus Getter:** el Read sondea solo cada cierto tiempo; el Getter lee cuando le llega un mensaje.
- **Nodo function:** JavaScript propio dentro del flujo; recibe `msg` y devuelve el `msg` que sigue (o `null` para cortar).
- **Admin API:** `GET /flows` exporta y `POST /flows` despliega; es lo que hace el editor por debajo.
- **Paleta:** los nodos extra (como `node-red-contrib-modbus`) se instalan en `/data` con npm.

## Decisiones
- Puertos en `127.0.0.1` → el editor no tiene contraseña y un nodo function ejecuta código.
- Credenciales inyectadas al desplegar → Node-RED no reemplaza `${VARIABLES}` dentro de las credenciales (lo verifiqué en su código: las borra antes de la sustitución).
- Usuario MQTT `nodered` con escritura en un solo tópico → mínimo privilegio.
- Modbus Getter en vez de Read → el plan pedía un inject, y el Read no acepta entradas (desvío corregido en el plan).
- El inject manda la hora como payload → el Getter descartaba en silencio los mensajes sin payload.
- Volumen anónimo en `/app/node_modules` → el contenedor instala sus propios módulos para Linux.

## Comandos para saber de memoria
```bash
docker compose --profile nodered up -d
docker compose exec -w /data nodered npm install node-red-contrib-modbus   # = Manage palette
npm run nodered:desplegar
curl -s http://127.0.0.1:1880/flows       # exportar el flujo (sin credenciales)
docker compose logs -f nodered
```

## Preguntas de entrevista
- **¿Node-RED o código?** Node-RED para integrar rápido y ajustar en terreno; código cuando necesitas pruebas, un buffer robusto, revisión y versionado. Muchas veces conviven: Node-RED en el borde y servicios en el centro.
- **¿Cómo versionas un flujo de Node-RED?** Lo exporto a JSON en el repositorio, sin credenciales, saco la lógica de los nodos function a archivos `.js` y lo despliego con un script por la Admin API.

## Ejercicios a mano
1. Agrega al flujo un nodo que descarte los registros `0x7FFF`.
2. Explica por escrito la diferencia entre un nodo inject y un bucle con `setTimeout`.
