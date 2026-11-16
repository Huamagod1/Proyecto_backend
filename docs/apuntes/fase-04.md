# Fase 4 · Seguridad: login, roles, permiso por sitio y auditoría

## Mapa
- `npm run sembrar` crea cuatro usuarios con su clave en bcrypt (costo 12); las claves salen de `.env`.
- `POST /api/auth/login` compara con bcrypt y entrega un JWT HS256 de 15 minutos con `sub`, `rol` y `sitio`.
- `autenticar` → `autorizar(...roles)` → filtro de sitio dentro de cada SQL de motores.
- `registrarAcceso` anota cada petición en `auditoria_accesos` al terminar la respuesta; `GET /api/auditoria` la consulta (solo admin).

## Conceptos
- **Autenticar, autorizar y permiso por recurso:** quién eres, qué puede hacer tu rol y sobre qué objetos.
- **JWT:** encabezado, contenido y firma; el contenido se lee, no está cifrado. La firma impide cambiarlo.
- **HS256 y `algorithms`:** un secreto firma y verifica; la lista explícita rechaza `alg: none`.
- **bcrypt:** hash lento y con sal propia; dos claves iguales dan hashes distintos.
- **BOLA:** el primer riesgo del OWASP API Top 10: acceder a objetos ajenos con un rol válido.
- **Rate limiting:** tope de intentos por IP en una ventana de tiempo; responde 429.
- **Auditoría solo inserción:** la base no deja a la API modificar ni borrar el registro.

## Decisiones
- Filtro de sitio dentro del SQL (`filtroSitio`) → la autorización no depende de un chequeo aparte que se olvide.
- Motor de otro sitio responde 404 → un 403 confirmaría que existe.
- Mismo 401 para usuario inexistente o clave mala, y hash señuelo → ni el mensaje ni el tiempo revelan usuarios.
- `skipSuccessfulRequests` → solo los fallos gastan intentos.
- Limitador creado dentro de `crearApp()` → cada app de prueba parte en cero.
- `/api/salud` fuera de la auditoría → los monitores no llenan la tabla de ruido.
- `pool.query` para `LIMIT ? OFFSET ?` → con `execute`, mysql2 manda DOUBLE y MySQL 8 lo rechaza.
- `npm test` corre solo `test/*.test.js` → `test/ayudas.js` comparte utilidades sin ejecutarse como prueba.

## Comandos para saber de memoria
```bash
openssl rand -hex 32                                  # un secreto de 256 bits
npm run sembrar
TOKEN=$(curl -s -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"usuario":"ing-norte","clave":"<tu-clave>"}' | jq -r .token)
curl -s localhost:3000/api/motores -H "Authorization: Bearer $TOKEN" | jq
```
En MySQL: `SELECT usuario, metodo, recurso, estado_http FROM auditoria_accesos ORDER BY id DESC LIMIT 5;`

## Preguntas de entrevista
- **¿Cómo implementarías roles y permisos?** JWT de vida corta y contraseñas en bcrypt; autorización por rol en un middleware; y permiso por recurso, el sitio, dentro de cada consulta, que es lo que más se olvida. Además, una auditoría de cada acceso en una tabla donde la aplicación solo puede insertar.
- **¿Por qué bcrypt y no SHA-256?** SHA-256 es rápido a propósito: una GPU prueba miles de millones por segundo. bcrypt es lento y con sal propia, así que robar la tabla no basta para obtener las claves.
- **¿Por qué el JWT dura 15 minutos?** Un JWT no se puede revocar sin guardar estado; si lo roban, sirve poco tiempo. Para sesiones largas se usa un refresh token revocable.

## Ejercicios a mano
1. Escribe de memoria `autorizar(...roles)`.
2. Agrega el rol `supervisor`, que solo lee, y prueba su 403.
