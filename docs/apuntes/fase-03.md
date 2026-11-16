# Fase 3 · API base con Express

## Mapa
- `config.js` valida el entorno con zod al arrancar → `db.js` abre un pool de 10 conexiones.
- `app.js` arma la cadena: JSON → `/api/salud` → `/api/motores` → 404 → middleware de errores.
- `server.js` escucha el puerto y hace el apagado ordenado; `rutas/motores.js` es el CRUD con SQL parametrizado.
- Las pruebas usan `crearApp()` con supertest contra la base `telemetria_test`.

## Conceptos
- **Middleware:** función `(req, res, next)` por la que pasa cada petición, en el orden en que se registra.
- **Middleware de errores:** tiene cuatro parámetros `(err, req, res, next)` y va al final.
- **Express 5 y async:** un error dentro de una ruta `async` llega solo al middleware de errores.
- **Sentencia preparada:** el SQL va con `?` y los valores aparte; MySQL nunca ejecuta un valor como SQL.
- **Pool:** conexiones abiertas que se reutilizan; ahorra la conexión y la autenticación de cada consulta.
- **Fallar rápido:** si falta una variable obligatoria, el proceso no arranca.
- **Apagado ordenado:** dejar de aceptar conexiones, terminar las peticiones en curso y cerrar el pool.

## Decisiones
- `crearApp()` separado de `listen()` → las pruebas no abren puertos y pueden crear apps nuevas.
- 409 desde la restricción UNIQUE (`ER_DUP_ENTRY`) → un SELECT previo falla con peticiones simultáneas.
- El PUT relee el motor en vez de mirar `affectedRows` → con `-FOUND_ROWS` (Fase 5), "sin cambios" daría 0.
- `src/comun/zod.js` → zod en español en todos los módulos (desvío del plan: archivo extra).
- `validar()` en `validacion.js` desde esta fase → la Fase 5 suma ahí las reglas de lecturas.
- `.env.test` lo genera `preparar-db-test.sh` → mismo `.env`, con `DB_NOMBRE=telemetria_test`.

## Comandos para saber de memoria
```bash
npm run api:dev                                   # API con reinicio al guardar
curl -si localhost:3000/api/salud                 # -i muestra el estado y los encabezados
curl -si -X POST localhost:3000/api/motores -H 'Content-Type: application/json' -d '{"codigo":"MTR-10","modelo":"12V4000","sitio_id":1}'
bash src/scripts/preparar-db-test.sh && npm test
node --env-file=.env.test --test --test-name-pattern="409"   # una sola prueba
```

## Preguntas de entrevista
- **¿Cómo manejas los errores en una API?** Con un middleware central. Los esperados salen con su estado y un mensaje claro; los inesperados, como 500 sin detalles internos y con todo el detalle en el log. La validación va en cada ruta, con zod.
- **¿Por qué separas la app del servidor?** Para probar la app sin red: supertest le habla directo, y cada prueba puede crear una app limpia.
- **¿Cómo evitas la inyección SQL?** Nunca concateno valores en el SQL: uso parámetros `?`, con sentencias preparadas (`execute`) o con el escape del driver (`query`).

## Ejercicios a mano
1. Escribe de memoria el middleware de errores.
2. Agrega `GET /api/sitios` con su prueba.
