# Dockerfile · una sola imagen para la API, el gateway y el simulador (Fase 12).
# Cada servicio de docker-compose.yml usa esta imagen y cambia solo el comando (CMD).
# Construir: docker compose --profile completo build   (o docker build -t telemetria-app .)

# Imagen base como argumento: así se puede comparar el tamaño con otra base (--build-arg IMAGEN_BASE=node:26).
ARG IMAGEN_BASE=node:26-trixie-slim
# node:26-trixie-slim: Node 26 LTS sobre Debian 13 sin compiladores ni documentación (~4 veces más chica).
FROM ${IMAGEN_BASE}

# NODE_ENV=production: las librerías (Express, entre otras) desactivan ayudas de desarrollo.
ENV NODE_ENV=production

# Todo lo que sigue ocurre en /app dentro de la imagen.
WORKDIR /app

# POR QUÉ copiar primero solo package*.json: Docker guarda cada paso como una capa en caché. Si el
# código cambia pero las dependencias no, el `npm ci` de abajo se reutiliza y el build tarda segundos.
COPY package.json package-lock.json ./

# npm ci: instala exactamente lo de package-lock.json. --omit=dev: sin supertest (solo pruebas).
# npm cache clean: borra la caché de descargas en la misma capa, para que no pese en la imagen.
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# El código va después, en su propia capa.
COPY src ./src
COPY public ./public

# Carpeta del buffer SQLite del gateway, del usuario node (uid 1000, ya existe en la imagen oficial).
# OJO: un volumen con nombre montado aquí hereda este dueño la primera vez.
RUN mkdir -p /app/datos && chown node:node /app/datos

# SEGURIDAD: el proceso no corre como root. Si alguien explota la app, queda limitado a este usuario.
USER node

# Documenta el puerto de la API; publicarlo lo decide docker-compose.yml.
EXPOSE 3000

# Forma "exec" (arreglo): node es el proceso 1 y recibe el SIGTERM de `docker stop` directamente.
# OJO: con la forma de texto ("node src/..."), un sh intermedio se queda con la señal y la API muere
# sin apagado ordenado tras los 10 s de gracia.
CMD ["node", "src/api/server.js"]
