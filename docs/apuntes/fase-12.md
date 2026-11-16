# Fase 12 · Docker: todo con un comando

## Mapa
- `Dockerfile`: una sola imagen (`node:26-trixie-slim`) para la API, el gateway y el simulador; corre como el usuario `node`.
- `docker-compose.yml`: la base (MySQL y Mosquitto) más el perfil `completo` (API, gateway y simulador) y el perfil `nodered`.
- `docker compose --profile completo up -d --build` levanta todo; dentro de Docker, cada servicio se llama por su nombre (`mysql`, `mosquitto`, `simulador`).
- Cada servicio recibe solo sus variables; el buffer del gateway vive en el volumen `datos-gateway`.

## Conceptos
- **Imagen:** la plantilla de solo lectura (sistema, Node, dependencias y código), en capas.
- **Contenedor:** una imagen en ejecución, con su propia capa de escritura que se pierde al borrarlo.
- **Volumen:** disco que sobrevive al contenedor; ahí van los datos (MySQL, el buffer, Node-RED).
- **Red de Compose:** un DNS interno donde cada servicio es un nombre.
- **Perfil:** un grupo de servicios que solo se levanta si se pide (`--profile completo`).
- **Caché de capas:** si `package*.json` no cambia, `npm ci` no se repite.
- **PID 1 y forma exec:** `CMD ["node", ...]` hace que node reciba el SIGTERM de `docker stop`.

## Decisiones
- Base `-slim` → 82 MB comprimida frente a 424 MB de `node:26`: menos que descargar y menos superficie de ataque.
- `USER node` → si alguien explota la app, no es root dentro del contenedor.
- Variables explícitas por servicio y no `env_file` → la API no recibe la clave de root de MySQL.
- `depends_on` con `service_healthy` para MySQL y `service_started` para Mosquitto → la imagen 2.1 de Mosquitto no trae healthcheck, y los clientes reconectan solos.
- Healthcheck de la API con el `fetch` de Node → la imagen slim no trae curl.
- `.dockerignore` sin `.env*` ni `node_modules` → ni secretos ni binarios de Windows dentro de la imagen.

## Resultados reales
- `docker compose restart api`: "SIGTERM recibido: apagado ordenado" → "Apagado completo" → "sesión recuperada", sin huecos en las lecturas.
- Los procesos corren como `node`, con PID 1.
- El único hueco de datos fue el cambio del gateway local al contenedor (42 s sin ningún gateway leyendo): el buffer protege de un corte del enlace, no de un gateway apagado.

## Comandos para saber de memoria
```bash
docker compose --profile completo up -d --build
docker compose ps
docker compose logs -f api
docker compose restart api
docker compose exec api sh          # entrar al contenedor
docker images · docker history telemetria-app
docker compose down                 # borra contenedores; los volúmenes quedan
```

## Preguntas de entrevista
- **¿Por qué usarías Docker?** Para tener el mismo entorno en desarrollo y en producción, con versiones fijas, y para levantar las dependencias en segundos. Los secretos entran por variables de entorno y los datos viven en volúmenes, nunca dentro de la imagen.
- **¿Qué pasa con `docker compose down` y con `down -v`?** `down` borra contenedores y redes; los volúmenes (los datos) quedan. `down -v` también borra los volúmenes: se pierde la base.

## Ejercicios a mano
1. Escribe de memoria un Dockerfile mínimo.
2. Explica qué pasa con los datos con `docker compose down` y con `docker compose down -v`.
