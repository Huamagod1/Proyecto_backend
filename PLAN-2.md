# Plan de práctica · Parte 2: de laboratorio a producción

La Parte 1 (`PLAN.md`, fases 0 a 14) construyó la plataforma y quedó en `v1.0.0`. Esta parte la lleva a cómo se trabaja de verdad en un ambiente industrial:

- operar el sistema y diagnosticar fallas;
- cambiar una base que ya tiene datos, sin detenerla;
- modelar grupos electrógenos de cualquier fabricante con las mismas variables y unidades;
- limpiar datos sin destruirlos;
- entregar al front un contrato estable;
- trabajar con las reglas de OT/TI: zonas, certificados, comandos seguros y puesta en servicio.

Lo acompañan cuatro documentos:
- `docs/README.md`: el índice de toda la documentación;
- `docs/COMO-ABORDAR.md`: cómo leer y estudiar un proyecto de este tamaño, con sus cinco mapas y las ideas clave;
- `docs/CRITERIO.md`: cómo decidir rápido, con principios, tablas y 26 casos reales;
- `docs/OT-TI.md`: qué hacer y qué no en un ambiente industrial, el grupo electrógeno en una página y el glosario.

## Qué cambia respecto de la Parte 1

1. **Partes de un sistema que ya existe.** Hay datos, pruebas y un tag publicado. Todo cambio de esquema es una migración y todo cambio de formato debe convivir con lo anterior.
2. **Cada fase trae *Definiciones* y *Hacer y no hacer*.** Las definiciones van antes del código; el agente las amplía en el apunte de la fase.
3. **Practicas diagnosticar, no solo leer.** La palabra clave `simulacro` hace que el agente rompa algo en el laboratorio y tú lo encuentres (Fase 15). Es la práctica que más se parece a mantener un sistema.
4. **El flujo de Git ahora es completo:** una rama por fase, PR, revisión y, desde la Fase 25, pruebas automáticas en cada PR. En la Parte 1 todo fue directo a `main`.
5. **Los tiempos son los tuyos:** leer, ejecutar y practicar. El agente escribe el código.
6. **Entrenas el criterio, no solo el conocimiento.** La palabra clave `caso` te pone una situación real para decidir en 2 minutos, y el agente evalúa tu decisión con los principios de `docs/CRITERIO.md`. Hazlo junto con los simulacros, una o dos veces por semana.
7. **La documentación crece con cada fase.** Al cerrar una fase, el agente actualiza lo que cambió, según la tabla de `docs/README.md`.

El ciclo de cada paso sigue igual (ver `AGENTS.md`): leer, ejecutar la verificación, preguntar, responder la pregunta de entrevista y cerrar con el apunte.

**Tu caso.** Windows 11 con Git Bash, Docker Desktop y Node 26 LTS, el mínimo que pide `package.json`; repositorio público `Huamagod1/Proyecto_backend`. Como es público, las llaves, los certificados y los respaldos nunca se suben: van en `datos/`, que Git ya ignora, o en `tls/`, que entra a `.gitignore` en la Fase 27.

## Punto de partida: lo que el repositorio ya tiene y lo que le falta

Esta tabla sale de leer tu código, no de una lista genérica.

| Tema | Hoy (`v1.0.0`) | Lo que falta | Fase |
|---|---|---|---|
| Operar | Cuatro procedimientos en `RUNBOOK.md`, dos de ellos probados | Práctica de diagnóstico con el reloj corriendo | 15 |
| Cambios en la base | `sql/` corre solo al crear la base; `004` y `005` "se aplican una vez como root"; tu base está particionada y una nueva no | Migraciones versionadas, y que todas las bases queden iguales | 16 |
| Permisos de prueba | `telemetria_test` da permisos sobre toda la base; producción los da por tabla | Los mismos permisos en pruebas que en producción | 16 |
| Modelo | Un "motor" con 7 variables y un mapa fijo de 8 registros en `decodificacion.js`; el gateway lee `readHoldingRegisters(0, 8)` | Catálogo de unas 36 variables de grupo electrógeno y un perfil por modelo de controlador | 17, 18 |
| Calidad | `calidad` vale 0 o 1 según un solo rango; `0x7FFF` se descarta con un log; los rechazos son contadores en memoria | Banderas de calidad, registro de sensores en falla y cuarentena con reproceso | 19 |
| Agregados | `lecturas_hora` promedia también las lecturas fuera de rango | Reglas en lote, contadores, coherencia e indicadores por equipo | 20 |
| Alarmas | Una palabra de 16 bits guardada como número; el cambio queda en el log del gateway | Alarmas como eventos con ciclo de vida, arranques y mantenimiento por horas | 21 |
| Front | Rutas sin contrato ni versión; la serie entrega puntos crudos (hasta unos 121.000 por variable en 7 días, a una lectura cada 5 s); token de 15 minutos sin renovación; el token del WebSocket viaja en la URL | Contrato OpenAPI, `/api/v1`, series con resolución, renovación de sesión y ticket | 22 |
| Vigilancia | `/api/metricas` es una foto en JSON, sin historia ni alertas; el detector de silencio vive dentro de la API: si la API cae, nadie avisa | Métricas con historia, alertas con procedimiento, vigilante externo y sonda de punta a punta | 23 |
| Respaldos | Volcado diario probado; entre dos respaldos se puede perder hasta un día | Binlog y recuperación a un punto en el tiempo | 24 |
| Cambios | Sin PR ni CI; el despliegue en Ubuntu (Fase 13) está pendiente | Entornos, CI, plantillas de cambio y de postmortem | 25 |
| Capacidad | 2,4 millones de filas probadas; particiones a mano; sin retención; la API confirma el mensaje MQTT antes de escribirlo | Cálculo, retención, archivo, prueba de carga y confirmación después de guardar | 26 |
| Seguridad OT | Una sola red de Docker: la API alcanza al simulador Modbus; MQTT sin TLS, con usuario y clave viajando en claro; puertos de MySQL y del broker abiertos en todas las interfaces | Zonas, TLS y un certificado por equipo | 27 |
| Comandos | No existe camino de escritura hacia terreno | Comandos con enclavamientos, caducidad y auditoría (opcional) | 28 |
| Sitios nuevos | Se crean a mano con SQL | Procedimiento de puesta en servicio con acta | 29 |
| Traspaso | Guía y apuntes de la Parte 1 | Calendario de operación, responsables y lista de producción | 30 |

## Lo que te preocupa y dónde se practica

| Responsabilidad | Fases |
|---|---|
| Mantener los sistemas y que no se caigan | 15, 23, 24, 25, 26 |
| Limpieza y calidad de datos | 19, 20 y 29 |
| Cualquier grupo electrógeno, con todas sus variables | 17, 18, 21 |
| Que el encargado del front pueda construir su visual | 22 (se apoya en 17, 20 y 21) |
| Buenas prácticas OT/TI | 27, 28, 29 y `docs/OT-TI.md` |
| Cambiar un sistema vivo sin romperlo | 16, 25 |

## Avance

- [ ] Fase 15 · Simulacros con lo que ya tienes (3 h, y después siempre)
- [ ] Fase 16 · Migraciones: cambiar la base sin detener el sistema (2–3 h)
- [ ] Fase 17 · Catálogo canónico y perfiles de equipo (3 h)
- [ ] Fase 18 · Flota simulada y gateway por perfiles (3–4 h)
- [ ] Fase 19 · Calidad de datos I: en la entrada (3 h)
- [ ] Fase 20 · Calidad de datos II: en lote (3–4 h)
- [ ] Fase 21 · Estados, arranques y alarmas (3–4 h)
- [ ] Fase 22 · El contrato con el front (3 h)
- [ ] Fase 23 · Observabilidad: métricas, alertas y objetivos (3 h)
- [ ] Fase 24 · Respaldo y recuperación a un punto en el tiempo (2 h)
- [ ] Fase 25 · Entornos, CI y gestión de cambios (2–3 h)
- [ ] Fase 26 · Capacidad y ciclo de vida del dato (2–3 h)
- [ ] Fase 27 · Zonas y conductos, TLS y un certificado por equipo (3 h)
- [ ] Fase 28 · Escribir hacia terreno: comandos seguros (2 h, opcional)
- [ ] Fase 29 · Puesta en servicio de un sitio (2 h)
- [ ] Fase 30 · Traspaso: que otra persona pueda operarlo (2 h)

Total: unas 45 horas de estudio.

**Ruta corta, de unas 21 horas:** 15 → 16 → 17 → 18 → 19 → 23 → 22. Cubre operar, cambiar la base, el modelo del grupo electrógeno, la adquisición de cualquier controlador, la calidad en la entrada, la vigilancia y el contrato con el front. Las demás fases se toman cuando el trabajo las pida.

**Antes de empezar:** conviene haber hecho la ruta de siete días de `docs/GUIA.md` (sección 12). Los simulacros suponen que sabes por dónde viaja un dato.

## Carpetas nuevas

```
Proyecto_backend/
├── PLAN-2.md             este plan
├── migraciones/          cambios de esquema numerados (Fase 16)
├── perfiles/             un JSON por modelo de controlador (Fase 17)
├── observabilidad/       Prometheus, Alertmanager y Grafana como código (Fase 23)
├── tls/                  CA y certificados del laboratorio; Git lo ignora (Fase 27)
├── .github/              CI y actualizaciones automáticas (Fase 25)
└── docs/
    ├── README.md         el índice de toda la documentación
    ├── COMO-ABORDAR.md   cómo leer el proyecto: niveles, cinco mapas e ideas clave
    ├── CRITERIO.md       cómo decidir rápido: principios, tablas y casos
    ├── casos.md          tus decisiones en cada `caso`, con su evaluación
    ├── OT-TI.md          principios, qué hacer y qué no, el grupo electrógeno y el glosario
    ├── catalogo.md       diccionario de datos, generado desde la base (Fase 17)
    ├── calidad.md        política de calidad de datos (Fase 19)
    ├── simulacros/       guion del agente, línea base y una ficha por simulacro (Fase 15)
    ├── api/              openapi.json, el contrato del tiempo real y las reglas de cambio (Fase 22)
    ├── operacion/        objetivos, continuidad, capacidad, calendario y responsables
    ├── plantillas/       cambio y postmortem (Fase 25)
    ├── seguridad/        zonas, modelo de amenazas y endurecimiento (Fase 27)
    ├── procedimientos/   puesta en servicio y baja de equipo (Fase 29)
    ├── actas/            una por sitio puesto en servicio (Fase 29)
    └── lista-de-produccion.md   la auditoría final (Fase 30)
```

---

## Fase 15 · Simulacros con lo que ya tienes

**Objetivo:** diagnosticar y recuperar fallas reales de la plataforma `v1.0.0`, con método y sin construir nada nuevo.
**Tu tiempo:** 3 horas para los cinco primeros; después, uno por semana.
**Depende de:** nada. Se hace con el sistema tal como está.

**La idea.** Un grupo de emergencia se arranca todas las semanas para que el día del corte no sea la primera vez. Con la plataforma pasa lo mismo: la primera caída no puede ser en producción y con un cliente esperando.

**Definiciones**
- **Síntoma, causa y causa raíz:** el síntoma es lo que alguien ve ("no hay datos"); la causa, lo que falló (el broker rechaza al gateway); la causa raíz, por qué pudo fallar (se rotó una clave sin actualizar el gateway).
- **Mitigar y resolver:** mitigar devuelve el servicio (reiniciar, volver a la versión anterior); resolver elimina la causa. Primero se mitiga.
- **Línea base:** cómo se ve el sistema sano. Sin ella no se reconoce lo anormal.
- **MTTD y MTTR:** tiempo medio hasta detectar una falla y hasta recuperarse de ella.
- **Radio de impacto:** a cuántos sitios, equipos o usuarios afecta una falla.
- **Postmortem sin culpables:** el análisis escrito de un incidente, que busca qué permitió la falla y no quién la cometió.

**Construyes:** `docs/simulacros/README.md` (reglas y tabla de resultados), `docs/simulacros/linea-base.md`, una ficha por simulacro y las mejoras que salgan para `docs/RUNBOOK.md`.

**Pasos**

1. **Línea base.** Con todo sano (`docker compose --profile completo up -d`), guarda en `linea-base.md` la salida de:
   - `docker compose ps`;
   - `/api/listo` y `/api/metricas`;
   - cuántos mensajes por minuto llegan al broker;
   - cuántas filas por minuto entran a `lecturas`;
   - el tamaño de cada tabla;
   - los últimos eventos de nivel `aviso` o `error` del log.
2. **Aprende el método,** siempre en este orden:
   1. ¿Qué ve exactamente quien reporta, y desde cuándo? Anota la hora.
   2. ¿Cuál es el alcance: un equipo, un sitio o todo?
   3. ¿Qué cambió? Un despliegue, una clave, una configuración o un corte.
   4. Sigue el dato por su camino: equipo → gateway → broker → ingesta → base → API → pantalla. Parte por la mitad (¿llega al broker?) y descarta una mitad cada vez.
   5. Una hipótesis a la vez, y cada una se confirma con una evidencia: un log, una consulta o un contador.
   6. Mitiga, comprueba que volvió y recién entonces busca la causa raíz.
3. **Catálogo de nivel 1.** Son 15 escenarios que el sistema actual ya permite. El agente elige uno sin decirte cuál y te entrega solo el reporte, como lo diría quien llama. Cómo se arma y se revierte cada uno está en `docs/simulacros/guion-del-agente.md`: ese archivo trae las respuestas, así que no lo abras.

   Entre todos practicas:
   - salud contra disponibilidad;
   - credenciales, permisos y secretos;
   - el loteador, la sesión persistente y los topes de cada cola;
   - los rechazos de la ingesta;
   - seguir el dato hasta el equipo;
   - verificar antes de arreglar: no todo reporte es una falla;
   - la auditoría como fuente de la historia;
   - los índices y la deriva del esquema;
   - el uso del disco.

   En varios escenarios no se pierde nada, y en otros sí. Parte de cada diagnóstico es decir cuál de los dos casos es.

4. **Protocolo.** Escribe `simulacro` en el chat del agente (detalle en `AGENTS.md`):
   - el agente comprueba que el sistema está sano, aplica la falla y te da el reporte;
   - tú ejecutas los comandos de diagnóstico en otra terminal;
   - `pista` entrega una ayuda, de menor a mayor, y `me rindo`, la solución.
5. **Ficha.** Cada simulacro deja `docs/simulacros/AAAA-MM-DD-nombre.md` con:
   - el reporte;
   - la cronología con horas;
   - la evidencia que confirmó cada paso;
   - la causa, la mitigación y cómo se prevendría;
   - lo que le faltó al sistema para que fuera más fácil encontrarlo.
6. **Mejora.** Si no existía un procedimiento para ese caso, se agrega a `RUNBOOK.md`. Lo que "le faltó al sistema" es la lista de deseos de la Fase 23.
7. Repite hasta completar cinco y anota en la tabla de `README.md` el tiempo hasta el diagnóstico y las pistas usadas.

**Verifica**
- Hay cinco fichas con su cronología, y al menos una es de un escenario donde se perdieron datos.
- `RUNBOOK.md` tiene al menos dos procedimientos nuevos.
- La tabla de resultados muestra que el tiempo baja.

**Hacer y no hacer**

| Hacer | No hacer | Por qué |
|---|---|---|
| Anotar la hora de cada observación y de cada acción | Reconstruir la cronología de memoria al día siguiente | La secuencia exacta suele ser la que explica la causa |
| Mirar antes de tocar: logs, contadores y estado | Reiniciar todo "por si acaso" | Reiniciar borra la evidencia y, si vuelve a fallar, no sabes por qué |
| Cambiar una sola cosa y volver a medir | Cambiar tres cosas a la vez | No sabrás cuál lo arregló ni cuál lo empeoró |
| Decir "todavía no sé" y qué vas a revisar | Dar una causa sin evidencia | Un diagnóstico falso manda a todos en la dirección equivocada |

**La dominas si…**
- [ ] Explicas el método de seis pasos con un ejemplo tuyo.
- [ ] Resuelves tres simulacros seguidos sin pistas, en menos de 15 minutos cada uno.
- [ ] Dices qué datos se perdieron, o no, en cada uno, y por qué.

**Pregunta de entrevista.** *"Te llaman: no llegan datos del sitio norte. ¿Qué haces primero?"* Confirmo el alcance y la hora: un equipo o el sitio, y desde cuándo. Después sigo el dato desde la mitad: si llega al broker, el problema está de la ingesta hacia adentro; si no llega, miro el estado retenido del gateway y sus logs. Mitigo, compruebo que volvió y dejo la causa raíz por escrito.

**Cierre:** `docs(simulacros): línea base y primeros cinco simulacros` · tag `fase-15`.

---

## Fase 16 · Migraciones: cambiar la base sin detener el sistema

**Objetivo:** que cualquier base (la tuya, una nueva o la de pruebas) llegue al mismo esquema con un comando, y que cada cambio quede registrado.
**Tu tiempo:** 2 a 3 horas.
**Depende de:** nada.

**La idea.** La base es una instalación en servicio. Nadie cablea por su cuenta: cada modificación tiene una orden de trabajo numerada y termina con el plano *as built* actualizado. Las migraciones son esas órdenes, y la tabla `migraciones`, el registro de cuáles ya se ejecutaron.

**Definiciones**
- **Migración:** un cambio de esquema escrito en un archivo numerado, que se aplica una sola vez y en orden.
- **Línea base:** el esquema desde el que se empieza a contar. Aquí es `sql/001` a `sql/005`, la versión 5.
- **Deriva:** dos bases que deberían ser iguales y no lo son, porque alguien cambió una a mano. Tu base particionada y una nueva sin particiones son un caso.
- **Expandir y contraer:** cambiar en dos tiempos. Primero se agrega lo nuevo sin quitar lo viejo; cuando ningún código usa lo viejo, se elimina en otra migración.
- **Compatibilidad hacia atrás:** el esquema nuevo sigue funcionando con la versión anterior del código. Es lo que permite volver atrás un despliegue.
- **DDL en línea:** `ALTER TABLE` que no bloquea la tabla (`ALGORITHM=INSTANT` o `INPLACE`). En MySQL, además, cada DDL hace commit por su cuenta: una migración fallida puede quedar a medias.

**Construyes:** la carpeta `migraciones/`, `src/scripts/migrar.js`, `src/scripts/mantener-particiones.js`, `src/tareas/programador.js` con su servicio `tareas` en `docker-compose.yml`, `test/migraciones.test.js`, `test/programador.test.js` y cambios en `preparar-db-test.sh`, `deploy/desplegar.sh` y el README.

**Pasos**

1. **Línea base.** `sql/` queda congelado: representa las versiones 1 a 5. Todo cambio nuevo es un archivo `migraciones/NNNN_nombre.sql` o `.js`, desde la `0006`.
2. **`migrar.js`:**
   - se conecta con una credencial de administración (`DB_ADMIN_USUARIO` y `DB_ADMIN_CLAVE`; en el laboratorio, root), distinta de la de la API;
   - toma un candado con `GET_LOCK('telemetria_migraciones', 10)`, para que dos ejecuciones no se pisen;
   - crea la tabla `migraciones` (versión, nombre, checksum SHA-256 del archivo, fecha y duración). Si la base ya tiene las tablas de la línea base, registra las versiones 1 a 5 sin ejecutarlas;
   - compara el checksum de cada migración aplicada con su archivo y, si alguien lo editó, se detiene;
   - aplica las pendientes en orden y registra cada una al terminar;
   - acepta `--estado` (lista), `--simular` (dice qué haría) y `--hasta N`.

   Un `.sql` puede traer varias sentencias; un `.js` exporta `subir(conexion)` para los cambios que necesitan lógica.
3. **Sin "bajar".** No hay migraciones de vuelta atrás: deshacer un `DROP COLUMN` no devuelve los datos. Un error se corrige con otra migración hacia adelante o restaurando el respaldo. Escribe la regla en `docs/decisiones.md`.
4. **`0006_particiones.js`: termina con la deriva.** El particionado que tiene hoy tu base salió de `practica/rendimiento.sql` (Fase 11): el `ALTER TABLE lecturas PARTITION BY RANGE COLUMNS (ts)` creó los meses y `p_futuro`, y el `REORGANIZE PARTITION` comentado muestra cómo abrir el mes siguiente. La migración convierte ese trabajo a mano en un paso repetible y registrado:
   - Consulta `information_schema.PARTITIONS`.
   - Si `lecturas` no está particionada, la particiona por mes, desde el mes del dato más antiguo hasta dos meses adelante, más `p_futuro`.
   - Si ya lo está, solo se asegura de que existan los dos meses siguientes.
5. **`mantener-particiones.js`** (`npm run particiones`):
   - mantiene tres meses abiertos por delante, partiendo `p_futuro` con `REORGANIZE PARTITION`;
   - avisa si `p_futuro` tiene filas: señal de que corrió tarde;
   - termina con código distinto de 0 si falla.

   Se registra en el servicio `tareas` (paso 6) para correr una vez al mes. La alternativa (un `EVENT` con un procedimiento) funciona, pero falla en silencio; el script deja log y código de salida, y en la Fase 23 tendrá su alerta.
6. **Servicio `tareas`** (`src/tareas/programador.js`): corre las tareas periódicas del sistema. Es un servicio más de Compose, con la misma imagen que la API y el gateway, en el perfil `completo`.
   - Cada tarea se registra con su nombre, cuándo corre (cada N minutos, o un día y una hora UTC) y qué ejecuta.
   - No superpone ejecuciones: si la corrida anterior de una tarea sigue en curso, la nueva no parte y queda anotada en el log.
   - Cada corrida deja una línea de log JSON con `src/comun/log.js`: la tarea, el inicio, la duración y el resultado, con el error si falló. Una tarea que falla no detiene a las demás.
   - La primera tarea es `mantener-particiones.js`. Las fases 20, 23 y 24 registran aquí las suyas.

   POR QUÉ: en Windows no hay cron, y el laboratorio corre en Docker Desktop. Un servicio de Compose corre igual en Windows y en Linux, vive en Git junto al código y deja su log junto al de la API. En el Ubuntu de la Fase 13, el mismo programa puede correr como una unidad de systemd más, igual que la API y el gateway.
7. **Paridad de permisos.** `preparar-db-test.sh` debe dar a `telemetria_app` los mismos permisos por tabla que producción, no `telemetria_test.*`. Cada migración que crea una tabla trae su `GRANT`. Así, una migración sin su permiso hace fallar una prueba y no la producción.
8. **Expandir y contraer con un caso real.** `variables.minimo` y `maximo` pasan a llamarse `min_operacion` y `max_operacion`, porque la Fase 19 agrega el rango físico:
   - `0007_rango_operacion_expandir.sql` agrega las columnas nuevas con `ALGORITHM=INSTANT` y copia los valores;
   - el código (`catalogo.js`, `validacion.js` y `generar-volumen.js`) pasa a leer las nuevas;
   - las viejas se eliminan en otra migración, recién al cerrar la Fase 19.

   Entre un paso y el otro, las dos versiones del código funcionan.
9. **Integración:**
   - `preparar-db-test.sh` corre las migraciones sobre `telemetria_test`;
   - `desplegar.sh` respalda, migra y recién después cambia el enlace `actual`;
   - regla del despliegue: el esquema de la versión N debe servirle al código N−1.
10. **Pruebas:**
    - una base en línea base queda al día, y una segunda corrida no aplica nada;
    - un archivo aplicado y luego editado detiene todo;
    - una migración que falla no queda registrada;
    - dos ejecuciones simultáneas no se pisan;
    - en `tareas`, una tarea que sigue en curso no se lanza otra vez, y una que falla no detiene a las demás.

**Verifica**
- `npm run migrar -- --estado` muestra lo mismo en tu base `telemetria` y en `telemetria_test`, que `preparar-db-test.sh` crea desde cero con la línea base y las migraciones.
- `SHOW CREATE TABLE lecturas` es igual en las dos, particiones incluidas.
- `npm test` pasa con los permisos por tabla.
- `docker compose logs tareas` muestra una línea JSON por corrida, con su duración y su resultado.

**Hacer y no hacer**

| Hacer | No hacer | Por qué |
|---|---|---|
| Un cambio lógico por migración | Editar una migración ya aplicada | Las bases que ya la corrieron quedan distintas de las nuevas |
| Probar la migración en una copia con volumen real y medir cuánto tarda | Estrenar un `ALTER` en producción | En una tabla de 200 GB, un `ALTER` que copia la tabla puede tardar horas |
| Escribir `ALGORITHM=INSTANT` o `INPLACE, LOCK=NONE` | Dejar que MySQL elija el algoritmo | Si no puede hacerlo en línea, falla de inmediato en vez de bloquear la ingesta |
| Borrar columnas o tablas en una migración posterior | Agregar y borrar en el mismo despliegue | El código anterior deja de funcionar y ya no puedes volver atrás |
| Respaldar antes de migrar | Cambiar a mano "solo esta vez" | Así nace la deriva |

**La dominas si…**
- [ ] Explicas por qué tu base y una nueva eran distintas y cómo quedaron iguales.
- [ ] Explicas expandir y contraer con el cambio de `minimo` a `min_operacion`.
- [ ] Explicas por qué no hay migraciones de vuelta atrás.

**Pregunta de entrevista.** *"¿Cómo cambias una tabla de millones de filas sin detener la ingesta?"* Con una migración versionada y en dos tiempos: primero agrego lo nuevo con un `ALTER` en línea, que pruebo y mido en una copia; el código convive con las dos formas, y lo viejo lo elimino en un despliegue posterior. Antes respaldo, y el esquema nuevo siempre le sirve a la versión anterior del código.

**Simulacros que habilita:** una migración a medio aplicar, alguien que cambió una columna a mano y una partición que no se abrió a tiempo.

**Cierre:** `feat(db): migraciones versionadas y particiones uniformes` · tag `fase-16`.

---

## Fase 17 · Catálogo canónico y perfiles de equipo

**Objetivo:** que sumar un controlador nuevo sea agregar datos (un perfil) y no programar, y que todas las marcas terminen hablando el mismo idioma: las mismas variables y las mismas unidades.
**Tu tiempo:** 3 horas.
**Depende de:** 16.

**La idea.** Es la lista de señales de un proyecto de control, que ya conoces: cada señal con su tag, su rango, su unidad y su dirección. El **catálogo** es el estándar de nombres de la empresa, como una plantilla de PI AF. El **perfil** es la lista de señales de un modelo de controlador: dónde está cada dato y cómo se traduce al estándar.

**Definiciones**
- **Grupo electrógeno:** un motor, un alternador y un controlador que los gobierna y protege. Muchas veces suma un tablero de transferencia que conmuta entre la red y el grupo.
- **Variable canónica:** el nombre y la unidad únicos con que la plataforma conoce una magnitud, venga del fabricante que venga.
- **Perfil de equipo:** la descripción, como datos, de cómo leer un modelo de controlador: direcciones, tipos, escalas, unidades, centinelas y alarmas.
- **Punto:** una entrada del perfil, es decir, una variable con su dirección.
- **Centinela:** un valor reservado que significa "aquí no hay medición". No es un número: es un código.
- **Valores nominales:** los de la placa del equipo (potencia, voltaje, frecuencia). Son la referencia de los rangos.
- **Régimen:** para qué se dimensionó el grupo según ISO 8528: emergencia, servicio principal o continuo.

**Construyes:** dos migraciones (`catalogo_canonico` y `perfiles`), `perfiles/ctrl-v1.json`, `ctrl-a.json`, `ctrl-b.json` y `ecu-j1939.json`, `src/comun/unidades.js`, `src/comun/perfiles.js`, `src/scripts/cargar-perfiles.js`, `src/scripts/diccionario.js`, `docs/catalogo.md` y sus pruebas.

**Pasos**

1. **El catálogo.** La migración agrega 29 variables a las 7 que ya existen (36 en total) y nuevas columnas a `variables`.

   | Grupo | Variables | Unidad |
   |---|---|---|
   | Motor | `rpm`, `carga` | rpm, % |
   | | `temp_refrigerante`, `temp_aceite` | °C |
   | | `presion_aceite` | kPa |
   | | `voltaje_bateria`, `voltaje_alternador_carga` | V |
   | | `horas_motor`, `arranques` (contadores) | h, veces |
   | Combustible | `nivel_combustible`, `consumo_combustible` | %, L/h |
   | | `combustible_total` (contador) | L |
   | Generador | `gen_frecuencia` | Hz |
   | | `gen_voltaje_l1n`, `_l2n`, `_l3n`, `_l1l2`, `_l2l3`, `_l3l1` | V |
   | | `gen_corriente_l1`, `_l2`, `_l3` | A |
   | | `gen_potencia_activa`, `gen_potencia_aparente`, `gen_potencia_reactiva` | kW, kVA, kVAr |
   | | `gen_factor_potencia` | sin unidad (−1 a 1) |
   | | `gen_energia_activa` (contador) | kWh |
   | Red | `red_voltaje_l1l2`, `red_frecuencia`, `red_disponible` | V, Hz, estado |
   | Sistema | `modo`, `estado`, `interruptor_gen`, `interruptor_red`, `remoto_habilitado` | estado |
   | | `alarmas` | bits |

   Columnas nuevas de `variables`:
   - `grupo`;
   - `tipo` (`analogica`, `contador`, `estado` o `bits`);
   - `min_fisico` y `max_fisico`: fuera de ellos, el valor es imposible;
   - `relativo_a`: si el rango de operación es un porcentaje de un valor nominal del equipo;
   - `enumeracion` (JSON): el significado de cada código de un estado. Para `estado`: 0 detenido, 1 arrancando, 2 en marcha, 3 con carga, 4 enfriando y 5 falla. Para `modo`: 0 apagado, 1 manual, 2 automático y 3 prueba.

   Reglas de nombres: español, minúsculas con guion bajo, prefijo de subsistema (`gen_`, `red_`) y sin la unidad en el nombre. Un código nunca se reutiliza para otra cosa.

   Los dos rangos, con valores de partida para el laboratorio. Los reales salen de la hoja de datos del equipo y de los ajustes de alarma de su controlador:

   | Variable | Operación | Físico |
   |---|---|---|
   | `temp_refrigerante` | −10 a 105 °C | −40 a 200 °C |
   | `presion_aceite` | 0 a 700 kPa | 0 a 1000 kPa |
   | `voltaje_bateria` (sistema de 24 V) | 22 a 30 V | 0 a 36 V |
   | `gen_frecuencia` | 0 a 52,5 Hz | 0 a 70 Hz |
   | `gen_potencia_activa` | 0 a 110 % de la nominal | −20 a 150 % de la nominal |
2. **Los equipos.** `motores` gana `perfil_id` (por ahora admite `NULL`) y los datos de placa:
   - `potencia_nominal_kw`;
   - `voltaje_nominal_v` (380);
   - `frecuencia_nominal_hz` (50);
   - `polos` (4);
   - `voltaje_bateria_nominal` (12 o 24);
   - `regimen`.
3. **El formato del perfil.** Es un JSON validado con zod, con estos campos:
   - `codigo`, `version`, `fabricante` y `protocolo`;
   - `centinelas`: por tipo de dato, valor → motivo;
   - `puntos`, cada uno con:
     - `variable`, `tabla` (`holding` o `input`) y `direccion`;
     - `tipo` (`uint16`, `int16`, `uint32`, `int32`, `float32` o `bits`) y `orden` (`ABCD` o `CDAB`);
     - `escala`, `desplazamiento` y `unidad`;
     - `clase`, `banda_muerta` y `latido_seg`, que usa la Fase 18;
     - `mapa`, opcional: traduce los códigos de estado del fabricante a los del catálogo;
   - `alarmas`: bit o código del fabricante → código canónico y severidad.
4. **Cuatro perfiles, cuatro dialectos:**

   | Perfil | Imita | Lo que te obliga a resolver |
   |---|---|---|
   | `ctrl-v1` | El mapa de 8 registros de la Parte 1 | Compatibilidad: MTR-01 y MTR-02 siguen funcionando igual |
   | `ctrl-a` | Un mapa por páginas (dirección = página × 256 + desplazamiento), con enteros de 16 y 32 bits | Centinelas por tipo (`0xFFFF` no implementado, `0xFFFE` sobre rango, `0xFFFC` falla del transductor), valores de 32 bits en dos registros y escalas de 0,1 |
   | `ctrl-b` | Un controlador con floats y unidades anglosajonas | float32 en orden CDAB, *input registers* (función 04) y conversión de psi, °F y gal/h |
   | `ecu-j1939` | La ECU del motor por CAN | PGN y SPN, *little-endian* y `0xFF` como "no disponible" |

   Los tres primeros son inventados para practicar. El mapa de un equipo real sale siempre del manual del fabricante, para esa versión de firmware. La forma de `ctrl-a` (páginas y centinelas) es la que usa, por ejemplo, la norma GenComm de Deep Sea Electronics.
5. **`unidades.js`:** `convertir(valor, de, a)`, con una tabla de factores: kPa, bar y psi; °C y °F; L y gal; kW y W. Una unidad desconocida lanza un error; nunca devuelve el valor sin convertir.
6. **`perfiles.js`,** con funciones puras:
   - `validarPerfil(json)`: rechaza una variable que no está en el catálogo, direcciones solapadas o una unidad sin conversión;
   - `bloquesDeLectura(perfil, clase)`: junta los puntos contiguos en bloques de hasta 125 registros, sin cruzar zonas no documentadas;
   - `decodificar(perfil, bloques)` → `{ lecturas, sinDato, alarmas }`, con los valores ya en unidad canónica y `sinDato` como `{ variable: motivo }`.
7. **`cargar-perfiles.js`** valida todos los JSON y los sube a la tabla `perfiles` con su checksum. Un perfil ya cargado no se edita: se sube la versión, igual que con las migraciones.
8. **Regresión.** `decodificarRegistros()` de la Parte 1 pasa a usar el perfil `ctrl-v1`, y una prueba demuestra que da lo mismo que antes para registros al azar.
9. **Diccionario de datos.** `npm run diccionario` genera `docs/catalogo.md` desde la base: cada variable con su descripción, unidad, tipo, rangos y los perfiles que la traen. Es lo que le entregas al front y a un cliente.

**Verifica**
- Conversión de unidades: 60 psi → 413,69 kPa; 185 °F → 85 °C; 4,2 bar → 420 kPa; 16,5 gal/h → 62,46 L/h.
- float32 CDAB: los registros `[0x0000, 0x4270]` dan 60,0. Leídos con el orden equivocado dan 2,38e-41, sin ningún error.
- uint32 con escala 0,1: `[0x0000, 0x0ED8]` → 3800 → 380,0 V.
- Centinelas: `0xFFFC` en un uint16 → sin dato, motivo `falla_transductor`; `0x7FFF` en un int16 → `no_implementado`.
- Las pruebas de la Parte 1 siguen pasando.

**Hacer y no hacer**

| Hacer | No hacer | Por qué |
|---|---|---|
| Guardar la unidad y el significado en el catálogo | Dejar que cada equipo mande "su" presión | Sin estándar, cada gráfico y cada regla se escriben una vez por marca |
| Convertir a la unidad canónica al decodificar | Guardar psi y kPa en la misma variable | Un promedio que mezcla unidades no significa nada y nadie lo nota |
| Tratar el centinela como "sin dato, con motivo" | Guardar 65535 o 0 como si fuera una medición | Contamina promedios, máximos y alarmas |
| Versionar los perfiles y anotar el firmware | Corregir un perfil en el mismo lugar | Pierdes la posibilidad de saber con qué mapa se leyó cada dato |
| Sacar el mapa del manual y confirmarlo en la puesta en servicio | Deducir escalas "porque el número se ve razonable" | Un factor 10 o un orden de palabras mal puesto no dan error |

**La dominas si…**
- [ ] Explicas la diferencia entre catálogo y perfil con la lista de señales de un proyecto.
- [ ] Agregas una variable a un perfil sin tocar código.
- [ ] Explicas los tres errores que no dan error: escala, orden de palabras y unidad.

**Pregunta de entrevista.** *"Mañana llega un grupo con un controlador que no conocemos. ¿Qué haces?"* Pido el mapa Modbus o la lista J1939 del fabricante para esa versión de firmware y escribo su perfil: cada punto apuntando a una variable del catálogo, con tipo, escala, unidad y centinelas. Lo pruebo contra un simulador o el equipo en banco, y en la puesta en servicio comparo cada señal con la pantalla del controlador. El resto de la plataforma no cambia.

**Simulacros que habilita:** un perfil con el orden de palabras invertido y una unidad mal declarada.

**Cierre:** `feat(dominio): catálogo canónico de grupos electrógenos y perfiles de equipo` · tag `fase-17`.

---

## Fase 18 · Flota simulada y gateway por perfiles

**Objetivo:** un simulador de grupos electrógenos completos, con fallas a pedido, y un gateway que lee cualquier perfil como se lee en terreno.
**Tu tiempo:** 3 a 4 horas.
**Depende de:** 17.

**La idea.** Es la prueba en fábrica (FAT) de un tablero: antes de ir a terreno se le inyectan señales simuladas y se provoca cada falla a propósito. El simulador es tu banco de pruebas, y también el que arma los simulacros de datos.

**Definiciones**
- **Clase de muestreo:** cada cuánto se lee un grupo de variables. Es lo mismo que las *scan classes* de una interfaz de PI.
- **Banda muerta e informe por excepción:** se publica un valor solo si cambió más que un umbral. En PI es la compresión por excepción.
- **Latido:** se publica igual cada cierto tiempo aunque nada cambie, para distinguir "sin cambios" de "sin comunicación".
- **Retroceso exponencial:** tras cada fallo se espera el doble antes de reintentar, hasta un tope.
- **Número de secuencia:** un contador por equipo que crece con cada mensaje. Un salto delata mensajes perdidos; una repetición, un duplicado.

**Construyes:** `src/simulador/grupo.js`, `src/simulador/flota.js`, `src/simulador/libretos/`, `src/gateway/sondeo.js`, `src/gateway/excepcion.js`, `src/scripts/sembrar-flota.js`, `src/scripts/generar-candump.js`, cambios en `gateway.js`, `buffer-local.js`, `j1939.js`, `ingesta-mqtt.js` y `docs/topicos.md`, y sus pruebas.

**Pasos**

1. **`grupo.js`: el modelo, con funciones puras.**
   - Una máquina de estados: detenido → arrancando → en marcha → con carga → enfriando → detenido, y falla desde cualquiera.
   - Magnitudes coherentes entre sí:
     - frecuencia = rpm × polos / 120;
     - potencia activa = carga × potencia nominal;
     - potencia aparente = activa / factor de potencia;
     - corriente = potencia activa × 1000 / (√3 × voltaje × factor de potencia);
     - la energía, las horas y el combustible total se acumulan.
   - Caso de control: 500 kVA, 380 V y factor 0,8 dan 400 kW nominales. Al 75 % son 300 kW, 375 kVA, 225 kVAr y 569,8 A; 1500 rpm dan 50 Hz.
2. **`flota.js`: un servidor Modbus TCP con varios equipos.**
   - Cada Unit ID es un grupo con su perfil: los registros se arman con el camino inverso de `decodificar`.
   - Un puerto de control HTTP, publicado solo en `127.0.0.1` de tu equipo, con `POST /control`:
     - operación: `arrancar`, `detener`, `cargar` y `corte_de_red`;
     - fallas de dato: `sensor_cortado`, `pegar`, `pico`, `unidad_mal` y `reiniciar_contador`;
     - fallas de equipo: `sin_respuesta`, `sobretemperatura` y `baja_presion`.
   - Libretos: secuencias con tiempo, como un grupo de emergencia que hace su prueba semanal.
3. **`sembrar-flota.js`:** crea MTR-11 (`ctrl-a`), MTR-12 (`ctrl-b`) y MTR-13 (`ecu-j1939`), con sus datos de placa. MTR-01 y MTR-02 quedan en `ctrl-v1`.
4. **`sondeo.js`: leer como en terreno.**
   - Tres clases: rápida (2 s: estado, potencia y frecuencia), normal (10 s: analógicas) y lenta (60 s: contadores).
   - Lecturas por bloques del perfil, nunca registro a registro.
   - Un equipo que no responde no frena a los demás: tiene su propio timeout y su retroceso (2, 4, 8… hasta 60 s).
   - Tras tres fallos, publica `sin_respuesta`, retenido, en `motores/{sitio}/{motor}/comunicacion`. Al volver, publica `ok`.
   - El gateway solo lee: no incluye ninguna función de escritura Modbus.
5. **`excepcion.js`:** `debePublicar(punto, valor, ahora)` aplica la banda muerta y el latido.
   - Los estados y las alarmas salen de inmediato al cambiar.
   - Los contadores salen con el latido.
   - Con el motor detenido solo viajan latidos.
6. **Mensaje versión 2,** compatible con el anterior: los campos nuevos son opcionales.
   - `perfil`: con qué mapa se decodificó (`"ctrl-a@1"`).
   - `seq`: el número de secuencia. Se guarda en el buffer SQLite para que sobreviva a los reinicios.
   - `sin_dato`: `{ variable: motivo }`.
   - `edad_ms`: cuánto esperó el mensaje en el gateway. Se calcula al publicar.

   La ingesta acepta los dos formatos, y cuenta los saltos y las repeticiones de `seq`.
7. **MQTT 5 en el gateway** (`protocolVersion: 5`).
   - Hoy habla 3.1.1: si la ACL le niega un tópico, el broker igual confirma el mensaje y el gateway lo borra del buffer. El dato se pierde en silencio, y con el nivel de log del proyecto el broker ni siquiera lo registra: la denegación es de nivel `debug`.
   - Con MQTT 5, la confirmación trae el código 135 ("no autorizado"), `publishAsync` falla y el mensaje se queda en el buffer.
   - Agrega una prueba de ese caso.
8. **J1939 completo para un grupo.** `j1939.js` suma estos mensajes:
   - EFL/P1 (PGN 65263): presión de aceite, byte 4, 4 kPa por bit;
   - VEP1 (65271): batería, bytes 5 y 6, 0,05 V por bit;
   - HOURS (65253): horas, bytes 1 a 4, 0,05 h por bit;
   - LFE (65266): consumo, bytes 1 y 2, 0,05 L/h por bit;
   - DD (65276): nivel de combustible, byte 2, 0,4 % por bit;
   - GAAC (65030): promedios del generador (voltaje entre líneas, voltaje a neutro, frecuencia a 1/128 Hz por bit y corriente);
   - DM1 (65226): fallas activas, de una sola trama.

   Confirma cada resolución en el manual del controlador. Un DM1 con más de una falla usa el protocolo de transporte, que queda fuera de este plan.

   `src/scripts/generar-candump.js` escribe un log candump desde el modelo de `grupo.js`, y `can-a-mqtt.js` lo publica como MTR-13 con el perfil `ecu-j1939`.

**Verifica**
- Cinco equipos de cuatro perfiles llegan a MySQL con las mismas variables y unidades.
- `sin_respuesta` en MTR-11: los demás mantienen su cadencia, y el tópico `comunicacion` de MTR-11 cambia.
- Con el motor detenido, la tasa de mensajes baja a los latidos.
- Vectores J1939:
  - aceite: byte 4 = `69` → 420 kPa;
  - batería: bytes `18 02` → 26,8 V;
  - horas: `80 C4 03 00` → 12.345,6 h;
  - consumo: `E2 04` → 62,5 L/h;
  - GAAC: `7C 01 DC 00 00 19 3A 02` → 380 V, 220 V, 50 Hz y 570 A;
  - DM1: `04 FF 6E 00 00 01 FF FF` → lámpara ámbar, SPN 110 (temperatura del refrigerante), FMI 0, una ocurrencia.
- Con un permiso mal puesto en la ACL, el buffer conserva los mensajes.

**Hacer y no hacer**

| Hacer | No hacer | Por qué |
|---|---|---|
| Elegir el período por la dinámica de la variable y por lo que soporta el bus | Leer todo cada segundo "por si acaso" | A 9600 baudios, 60 registros toman unos 150 ms: diez equipos son 1,5 s por vuelta, antes de contar silencios |
| Leer bloques documentados | Barrer direcciones para "descubrir" el mapa en un equipo en servicio | Algunos controladores responden con excepción, y otros se degradan |
| Un solo maestro por bus serie | Conectar un segundo lector al mismo RS485 | Las respuestas se cruzan y los dos leen basura |
| Poner la hora al leer | Poner la hora al enviar o al recibir | Tras un corte, todos los datos quedarían con la hora de la reconexión |
| Señales distintas para gateway caído, equipo sin respuesta y sensor en falla | Un solo "sin datos" | Cada causa la atiende una persona distinta y de una manera distinta |
| Un gateway de monitoreo sin código de escritura | Dejar funciones de escritura "por si se necesitan" | Lo que no existe no se puede usar por error ni por un atacante |

**La dominas si…**
- [ ] Explicas las tres formas de "no hay dato" y qué señal deja cada una.
- [ ] Calculas el tiempo de una vuelta de sondeo para un bus RS485 dado.
- [ ] Explicas por qué la banda muerta necesita un latido.

**Pregunta de entrevista.** *"¿Cada cuánto hay que leer un equipo?"* Depende de la variable y del uso. Estados y potencia, cada pocos segundos; temperaturas, cada diez; contadores, cada minuto. Con informe por excepción, un equipo detenido casi no transmite, y el latido confirma que sigue vivo. El límite lo ponen el bus y el controlador: en RS485 calculo el tiempo de la vuelta antes de prometer un período.

**Simulacros que habilita:** todas las fallas de `POST /control`, un equipo que deja de responder y un permiso mal puesto en la ACL.

**Cierre:** `feat(terreno): flota simulada y gateway por perfiles con informe por excepción` · tag `fase-18`.

---

## Fase 19 · Calidad de datos I: en la entrada

**Objetivo:** que cada dato quede guardado con una calificación, que cada rechazo quede guardado con su motivo, y que nada se pierda ni se "arregle" en silencio.
**Tu tiempo:** 3 horas.
**Depende de:** 16, 17 y 18.

**La idea.** Es el control de calidad en la recepción de una planta: nada se bota. Lo que cumple, entra. Lo dudoso entra con una etiqueta. Lo que no se puede recibir se aparta con su motivo, para decidir después. PI hace lo mismo: guarda el valor con su estado ("Bad Input", "I/O Timeout") y con la marca de cuestionable.

**Definiciones**
- **Dato crudo:** lo que midió el equipo, tal como llegó. No se modifica ni se borra.
- **Calidad:** la calificación del dato. **Buena:** se usa. **Dudosa:** se usa con aviso, porque puede ser una falla real del equipo. **Mala:** no entra en promedios ni en indicadores.
- **Rango físico y rango de operación:** fuera del físico, el valor es imposible (un refrigerante a 400 °C); fuera del de operación es posible, pero anormal (112 °C), y suele ser justo lo que hay que ver.
- **Cuarentena:** el lugar donde se guarda lo rechazado, con su motivo, para revisarlo y reprocesarlo.
- **Desfase de reloj:** la diferencia entre la hora del equipo que midió y la hora real.
- **Las seis dimensiones de la calidad:** completitud, validez, exactitud, consistencia, puntualidad y unicidad.

**Construyes:** `src/comun/calidad.js`, la migración `calidad_entrada` (tablas `lecturas_sin_valor` y `cuarentena`), cambios en `validacion.js`, `ingesta-mqtt.js`, `rutas/lecturas.js` y `repositorio.js`, `src/api/rutas/calidad.js`, `docs/calidad.md` y sus pruebas.

**Pasos**

1. **`calidad` pasa a ser un conjunto de banderas** (un bit por problema). No hace falta tocar la tabla: el 1 que ya existe sigue significando lo mismo.

   | Bit | Valor | Bandera | La pone | Nivel |
   |---|---|---|---|---|
   | 0 | 1 | Fuera del rango de operación | Ingesta | Dudosa |
   | 1 | 2 | Fuera del rango físico | Ingesta | Mala |
   | 2 | 4 | Pico aislado | Lote (Fase 20) | Mala |
   | 3 | 8 | Valor pegado | Lote | Mala |
   | 4 | 16 | Incoherente con otras variables | Lote | Dudosa |
   | 5 | 32 | Hora dudosa | Ingesta | Dudosa |
   | 6 | 64 | Contador que retrocede | Lote | Dudosa |
   | 7 | 128 | Reservada | — | — |

   `calidad.js` define las constantes, las máscaras `MALA` (14) y `DUDOSA` (113) y `nivelDeCalidad(bits)`.
2. **`evaluarLectura` distingue los dos rangos:**
   - fuera del físico → bit 1, y ya no se evalúa el de operación;
   - dentro del físico y fuera del de operación → bit 0;
   - si la variable es relativa al nominal (potencia, voltaje o frecuencia), el rango se calcula con la placa de ese equipo;
   - un `estado` con un código que no está en su enumeración → bit 1.
3. **Sensores en falla.** Lo que llega en `sin_dato` se guarda en `lecturas_sin_valor` (motor, variable, hora y motivo), no en `lecturas`. `estado_actual` gana `sin_valor_motivo`: la pantalla puede mostrar "sensor en falla desde las 14:02" en vez de un número viejo.
4. **La hora.** Con `edad_ms`, la API estima el desfase del reloj del gateway: `desfase = ts − (hora de llegada − edad_ms)`. Positivo, el reloj del gateway va adelantado; negativo, atrasado.
   - Funciona porque `edad_ms` se mide con el reloj del propio gateway (hora de publicar menos `ts`), y su error se cancela. La latencia de la red queda como margen de error.
   - Si supera 30 s en cualquier sentido, la lectura lleva el bit 5 y el desfase se expone por gateway.
   - No se corrige la hora: se marca.
   - Siguen los rechazos de la Parte 1: más de 5 minutos en el futuro o más de 30 días de antigüedad.
   - Para probarlo, `GATEWAY_DESFASE_RELOJ_MS` corre el reloj del gateway. Es solo de laboratorio.
5. **Cuarentena.** Todo lo que hoy solo suma un contador (JSON inválido, forma inválida, motor desconocido, de otro sitio, variable desconocida, hora rechazada) se guarda en `cuarentena` con origen, remitente, tópico, motivo, contenido (hasta 4 KB) y estado. Lleva un tope por remitente y motivo, de 100 por minuto: lo que exceda solo se cuenta, para que una avalancha no llene la base.
6. **Revisar y reprocesar:**
   - `GET /api/calidad/cuarentena?motivo=&desde=&hasta=` (admin, o ingeniero de su sitio);
   - `POST /api/calidad/cuarentena/reprocesar` vuelve a pasar los mensajes por la misma validación, con su hora de llegada original. Como la escritura es idempotente, reprocesar dos veces no duplica.
7. **Un mensaje, muchas variables.** Una variable mala no descarta el mensaje completo: se rechaza o se marca solo esa.
8. **`docs/calidad.md`: la política.** Qué se marca, qué se rechaza, quién revisa la cuarentena, cada cuánto y cómo se reprocesa.
9. **Contraer.** Ya nadie lee `variables.minimo` ni `variables.maximo`: una migración los elimina.
   - El renombre es solo de la tabla `variables` y de su uso. OJO: `lecturas_hora` también tiene columnas `minimo` y `maximo`, el mínimo y el máximo de cada hora, y esas no cambian. Un buscar y reemplazar en todo el repositorio rompería los agregados.
   - Los lugares reales son cinco. `sql/001_esquema.sql` y `sql/002_datos_iniciales.sql` crean y llenan las columnas: son la línea base y no se editan, porque la base cambia con las migraciones. `src/api/catalogo.js`, `src/comun/validacion.js` y `src/scripts/generar-volumen.js` leen los rangos. Además, se actualiza el diagrama de la sección 6 de `docs/GUIA.md`.
   - `grep -rn -E "minimo|maximo" src sql test` muestra también `lecturas_hora` y variables locales con ese nombre (`src/comun/log.js` y `test/loteador.test.js`): esas no se tocan.

**Verifica**
- `sensor_cortado` en el simulador → una fila en `lecturas_sin_valor` con su motivo, y ninguna lectura inventada.
- Un refrigerante a 112 °C queda con calidad 1; uno a 400 °C, con calidad 2.
- Un gateway con el reloj 10 minutos atrasado: sus lecturas llevan el bit 5.
- Publica datos de un equipo que no existe: quedan en cuarentena. Regístralo y reprocesa: los datos aparecen con su hora original.
- `unidad_mal` (psi declarados como kPa): la presión baja de unos 420 a unos 60 kPa, y la entrada la da por buena. Un error de unidad dentro de un rango creíble no se detecta aquí: lo atrapan la coherencia (Fase 20) y la puesta en servicio (Fase 29).

**Hacer y no hacer**

| Hacer | No hacer | Por qué |
|---|---|---|
| Guardar y marcar | Rechazar lo que está fuera de rango | Un 112 °C puede ser la falla que había que ver |
| Guardar el motivo de cada rechazo | Contar rechazos y botar el contenido | Sin el contenido no hay cómo reprocesar ni cómo explicar |
| Registrar "sin dato" con su causa | Repetir el último valor bueno | El gráfico muestra una línea plana que parece una medición |
| Dejar el valor como llegó | Recortar al máximo del rango | Un 400 guardado como 150 es un dato falso que parece verdadero |
| Marcar la hora dudosa | Reemplazar la hora del equipo por la de llegada | Tras un corte, horas de datos quedarían amontonadas en un minuto |

**La dominas si…**
- [ ] Explicas la diferencia entre marcar, rechazar y apartar, con un ejemplo de cada caso.
- [ ] Explicas cómo se detecta un reloj desfasado sin confiar en ese reloj.
- [ ] Recuperas datos de la cuarentena sin duplicar.

**Pregunta de entrevista.** *"¿Qué haces con un dato fuera de rango?"* Depende de cuál rango. Si es imposible para la física, lo guardo como malo y no entra en los cálculos. Si es posible pero anormal, lo guardo como dudoso, porque puede ser una falla real del equipo. Nunca lo borro ni lo recorto: el crudo queda como llegó, con su bandera, y lo que no puedo recibir va a cuarentena con su motivo, para reprocesarlo.

**Simulacros que habilita:** un reloj desfasado, un equipo nuevo sin registrar y un sensor cortado.

**Cierre:** `feat(calidad): banderas de calidad, sensores en falla y cuarentena con reproceso` · tag `fase-19`.

---

## Fase 20 · Calidad de datos II: en lote

**Objetivo:** detectar lo que solo se ve mirando la serie completa, tratar bien los contadores, medir la calidad por equipo y corregir sin tocar el crudo.
**Tu tiempo:** 3 a 4 horas.
**Depende de:** 19.

**La idea.** Es el laboratorio de control de calidad: revisa la producción con calma, compara una muestra con las vecinas, y si cambia el método puede volver a analizar las contramuestras. Por eso el crudo no se toca: es la contramuestra.

**Definiciones**
- **Reproceso idempotente:** volver a aplicar las reglas a una ventana de tiempo da el mismo resultado, se corra una vez o diez.
- **Versión de reglas:** el número que identifica el conjunto de reglas con que se calificó un dato.
- **Pico aislado:** una muestra que se aleja de la anterior y de la siguiente más rápido de lo físicamente posible.
- **Valor pegado:** una señal que repite exactamente el mismo valor mientras el equipo funciona.
- **Contador, vuelta y reinicio:** un acumulado que solo crece (horas, kWh). Da la **vuelta** al llegar a su tope y se **reinicia** si cambian el controlador.
- **Coherencia cruzada:** las variables de un mismo instante deben cumplir entre sí las leyes de la física.
- **Corrección como capa:** el valor corregido se guarda aparte, con autor y motivo, y el crudo queda intacto.
- **Linaje:** poder decir de dónde salió cada número y qué se le hizo.

**Construyes:** `src/comun/reglas-calidad.js`, `src/scripts/calidad-lote.js`, la migración `calidad_lote`, rutas nuevas en `src/api/rutas/calidad.js`, `practica/calidad.sql` y sus pruebas.

**Pasos**

1. **`reglas-calidad.js`,** con funciones puras que se prueban con vectores:
   - `detectarPicos(serie, topePorSegundo)`: marca la muestra que se aleja de sus dos vecinas más rápido que el tope, en sentidos opuestos. No marca la muestra buena que viene después;
   - `detectarPegados(serie, segundosMinimos, enMarcha)`: tramos del mismo valor exacto que duran más que el mínimo, con el motor en marcha;
   - `deltaContador(anterior, actual, tope)` → `{ delta, evento }`. Si retrocede y el anterior estaba sobre el 90 % del tope, es una vuelta; si no, un reinicio;
   - `coherencia(muestra, nominales)`: la lista de reglas que no se cumplen.
2. **Reglas de coherencia iniciales:**

   | Regla | Se cumple si | Atrapa |
   |---|---|---|
   | Frecuencia y velocidad | La frecuencia difiere en menos de 1 Hz de rpm × polos / 120 | Una escala o un punto mal mapeado |
   | Potencia | La potencia activa difiere en menos de un 10 % (más 2 kW) de √3 × V × I × factor de potencia / 1000 | Una corriente con factor 10, o una unidad en W en vez de kW |
   | Motor detenido | Con menos de 50 rpm no hay potencia ni presión de aceite | Sensores pegados y relojes corridos |
   | Interruptor abierto | Con el interruptor abierto no hay corriente | Un estado invertido en el perfil |
   | Medición y alarma | Si la presión de aceite en marcha está bajo el ajuste de alarma, la alarma de baja presión está activa | Una unidad o una escala equivocada |

   Una regla que falla marca como dudosas (bit 4) todas las variables que participan: no se sabe cuál es la equivocada.
3. **`calidad-lote.js`** (`npm run calidad`):
   - revisa una ventana: por defecto, las dos últimas horas; con `--desde` y `--hasta`, cualquier otra;
   - para cada equipo carga la serie ordenada, calcula las banderas, **borra** los bits 2, 3, 4 y 6 de la ventana y los vuelve a poner. Por eso es idempotente;
   - registra cada corrida en `calidad_ejecuciones`: ventana, versión de reglas, filas revisadas y filas marcadas;
   - se registra en el servicio `tareas` (Fase 16) cada 15 minutos. Los datos atrasados de un buffer se califican en la corrida siguiente, si su `ts` cae dentro de la ventana.
   - OJO: una ventana fija de dos horas no ve lo que quedó fuera de ella. En tu base hay dos horas a medias con todas sus lecturas a tiempo: el evento las calculó a las HH:05, la ingesta se cortó minutos después y ninguna corrida las completó (2026-11-16 15:00 al 75,5 %, 2026-11-20 19:00 al 19 %). Con un buffer que drena tarde pasa lo mismo. Decide en esta fase si la ventana parte donde terminó la última corrida de `calidad_ejecuciones` y suma las horas de las lecturas con `recibido_en` posterior.
4. **Los contadores se restan, no se promedian.**
   - `lecturas_hora` gana `delta`, la suma de los incrementos de la hora: horas de marcha, kWh generados y litros consumidos.
   - Cada vuelta o reinicio queda en `contadores_eventos`, con el valor anterior y el nuevo.
5. **Agregados que respetan la calidad.**
   - `lecturas_hora` gana `n_buenas`.
   - El promedio, el mínimo y el máximo se calculan sin las lecturas malas, y quedan en `NULL` si no hay ninguna buena.
   - Después de cada corrida, el lote recalcula las horas que tocó. Si no, los agregados y las banderas se contradicen.
   - **`ev_lecturas_hora` pasa al servicio `tareas`.** El evento de la Fase 11 recalcula cada hora las dos últimas horas; el lote ya lo hace cada 15 minutos, y después de calificar. La migración `calidad_lote` borra el evento (`DROP EVENT IF EXISTS ev_lecturas_hora`), y `lecturas_hora` queda con un solo escritor. Al cerrar la fase, la decisión 5 de `docs/decisiones.md` se marca como reemplazada.
     - POR QUÉ: como con las particiones (Fase 16), un `EVENT` que falla solo deja una línea en el log de errores de MySQL; la tarea deja log, código de salida y su fila en `calidad_ejecuciones`.
     - ALTERNATIVA: una tarea aparte cada hora, copia del evento. Se descarta: repite el trabajo del lote y escribe las mismas filas, y un agregado calculado antes de las banderas podría guardarse después y contradecirlas.
6. **Indicadores por equipo y día,** en `calidad_diaria`:
   - completitud: mensajes recibidos sobre los esperados según el latido;
   - validez: porcentaje de lecturas que no son malas;
   - puntualidad: el percentil 95 del retraso de los mensajes en vivo;
   - duplicados absorbidos y rechazos por motivo.

   Se consultan con `GET /api/calidad/resumen?sitio=&desde=&hasta=`.
7. **Correcciones como capa.** Caso de práctica: MTR-12 estuvo dos días con la presión en psi.
   - `correcciones` guarda quién, cuándo, por qué, el equipo, la variable, la ventana y una transformación lineal (factor y desplazamiento).
   - Un usuario la propone y **otro** la aprueba.
   - Al aplicarla, los valores corregidos van a `lecturas_corregidas`. Las series devuelven el corregido, si existe, con la marca `corregido`; el crudo sigue disponible.
   - Revertir es borrar la capa.
8. **`practica/calidad.sql`:** las mismas detecciones escritas en SQL con funciones de ventana: los pegados con `LAG` e islas, los picos con `LAG` y `LEAD`, y los huecos.

**Verifica**
- Con `pico`, `pegar` y `reiniciar_contador` en el simulador, cada falla queda con su bandera, y dos corridas seguidas dejan lo mismo.
- Vectores de contador:
  - de 4.294.967.290 a 5, con tope 4.294.967.295: vuelta, delta 11;
  - de 65.530 a 4, con tope 65.535: vuelta, delta 10;
  - de 12.345,6 a 0,4: reinicio, delta 0,4.
- Coherencia: 380 V, 570 A y factor 0,8 dan 300,1 kW. Si la corriente llega con factor 0,1 (57 A), el cálculo da 30 kW contra 300 medidos: incoherente.
- El promedio de una hora con un pico cambia al excluirlo. En una prueba con 329 lecturas, un solo pico de 140 °C movió el promedio de 85,29 a 85,46 °C.
- La corrección de MTR-12 se aplica y se revierte, y el crudo nunca cambia.
- `SHOW EVENTS` ya no lista `ev_lecturas_hora`, y una lectura nueva entra al agregado de su hora, con su `n_buenas`, en la corrida siguiente del lote.

**Hacer y no hacer**

| Hacer | No hacer | Por qué |
|---|---|---|
| Restar contadores, con manejo de vuelta y reinicio | Promediar un contador o restar sin mirar | Un reinicio da una energía negativa, y una vuelta, una gigantesca |
| Recalcular ventanas recientes en cada corrida | Calificar cada dato una sola vez | Los datos que llegan tarde quedarían sin revisar |
| Versionar las reglas y registrar cada corrida | Cambiar una regla y dejar el historial mezclado | No podrías explicar por qué el mismo dato tiene calificaciones distintas |
| Informar la completitud junto al promedio | Mostrar un promedio sin decir con cuántos datos se hizo | Un promedio con el 20 % de los datos se ve igual que uno con el 100 % |
| Corregir en una capa, con autor, motivo y aprobación | `UPDATE lecturas SET valor = ...` | Se pierde el dato original y nadie puede auditar el cambio |
| Mostrar los huecos como huecos | Rellenar con interpolación sin marcarla | Un dato inventado termina en un informe como si fuera medido |

**La dominas si…**
- [ ] Explicas por qué el lote borra y vuelve a poner sus banderas.
- [ ] Calculas a mano el incremento de un contador que dio la vuelta.
- [ ] Explicas cómo corregirías dos días de datos con la unidad equivocada sin perder el original.

**Pregunta de entrevista.** *"¿Cómo sabes si los datos de un equipo son confiables?"* Lo mido: completitud contra lo esperado, porcentaje de lecturas válidas, retraso y rechazos, por equipo y por día. Detrás hay reglas en dos niveles: en la entrada, rangos y horas; en lote, picos, valores pegados, contadores y coherencia entre variables. El crudo nunca se modifica: se marca, y las correcciones van en una capa con autor y motivo.

**Simulacros que habilita:** "el informe mensual muestra energía negativa", "el promedio de temperatura subió sin motivo" y "dos días de presión imposible".

**Cierre:** `feat(calidad): reglas en lote, contadores, indicadores y correcciones como capa` · tag `fase-20`.

---

## Fase 21 · Estados, arranques y alarmas

**Objetivo:** convertir las mediciones en lo que el negocio pregunta: qué pasó, cuánto funcionó cada equipo, qué alarma está activa y a quién se le avisó.
**Tu tiempo:** 3 a 4 horas.
**Depende de:** 17 (la 18 y la 20 la enriquecen).

**La idea.** Es el libro de novedades de una sala de control. No anota cada lectura: anota lo que pasó. "14:02 arrancó. 14:03 tomó carga. 15:40 alarma de alta temperatura. 15:42 reconocida por J. Pérez. 15:55 normalizada."

**Definiciones**
- **Medición y evento:** la medición es un valor en un instante; el evento es un hecho con inicio y fin.
- **Clases de alarma:** **aviso** (el equipo sigue), **disparo eléctrico** (abre el interruptor y enfría el motor) y **parada** (detiene de inmediato).
- **Reconocer:** una persona declara que vio la alarma. No la apaga: la alarma termina cuando la condición se normaliza.
- **Alarma intermitente:** la que se activa y se normaliza muchas veces en pocos minutos.
- **Avalancha de alarmas:** tantas a la vez que nadie distingue la que importa.
- **Arranque:** el período entre que el motor parte y se detiene, con su resumen.
- **Factor de carga:** la energía generada dividida por la que habría generado a potencia nominal en las mismas horas.
- **Bandeja de salida (*outbox*):** el aviso se guarda en la base, en la misma transacción que el evento, y otro proceso lo envía y reintenta.

**Construyes:** la migración `eventos`, `src/api/alarmas.js`, `src/api/arranques.js`, `src/api/notificador.js`, `src/api/rutas/alarmas.js`, `src/api/rutas/indicadores.js`, las tablas de textos de DM1 en `src/comun/j1939.js` y sus pruebas.

**Pasos**

1. **Tablas:**

   | Tabla | Columnas | Claves |
   |---|---|---|
   | `eventos_alarma` | id, motor_id, codigo, severidad, origen (`controlador` o `plataforma`), inicio, fin (`NULL` = activa), reconocida_por, reconocida_en, intermitente, detalle | Única (motor_id, codigo, inicio); índice (motor_id, fin) |
   | `arranques` | id, motor_id, inicio, fin, motivo_fin, horas, energia_kwh, litros, carga_promedio, carga_maxima | Única (motor_id, inicio) |
   | `notificaciones` | id, evento_id, canal, destino, estado, intentos, proximo_intento, enviada_en | Única (evento_id, canal, destino) |
   | `planes_mantenimiento` | motor_id, tarea, cada_horas, ultima_en_horas | PK (motor_id, tarea) |

   Además, `motores.en_mantenimiento_hasta`.
2. **Tres orígenes de alarma, un solo formato:**
   - el controlador: los bits o códigos del perfil se traducen al código canónico y a su severidad;
   - la ECU: cada falla de DM1 es un par SPN y FMI (`spn110_fmi0`), con su texto;
   - la plataforma: `sin_comunicacion`, `bateria_baja`, `combustible_bajo`, `mantenimiento_vencido` y `no_en_automatico`. Esta última es la clásica: un grupo de emergencia fuera de automático no va a partir cuando se corte la red.
3. **`alarmas.js`.** Las transiciones se calculan comparando con el valor anterior **por la hora del dato**, no por el orden de llegada.
   - Un bit que pasa de 0 a 1 abre un evento; uno que pasa de 1 a 0 lo cierra.
   - La clave única hace idempotente la apertura: un mensaje reenviado no abre dos eventos.
   - Una alarma que ocurrió durante un corte del enlace llega tarde, y el evento queda con su hora real.
4. **Contra el ruido:**
   - cinco activaciones del mismo código en 10 minutos lo marcan como intermitente, y se avisa una sola vez;
   - con el equipo en mantenimiento, el evento se registra y no se notifica.
5. **Reconocer:** `POST /api/alarmas/:id/reconocer` guarda quién y cuándo, y queda en la auditoría. Nunca se reconoce de forma automática.
6. **`arranques.js`.** Abre un arranque cuando `estado` pasa a "en marcha" (o cuando las rpm superan 500, en un perfil sin estado) y lo cierra al detenerse.
   - Su resumen sale de los incrementos de los contadores: horas, energía y litros.
   - Si al detenerse hay una alarma de parada activa, `motivo_fin` es `falla`.
7. **`notificador.js`: la bandeja de salida.**
   - Al abrir un evento de disparo o de parada, se inserta la notificación en la misma transacción.
   - Un ciclo aparte la envía a un *webhook* (`NOTIFICACIONES_WEBHOOK`) y reintenta al minuto, a los 5 y a los 15.
   - Si el dato llegó atrasado, el mensaje lo dice: "ocurrió hace 40 minutos".
   - En el laboratorio, el receptor es un script que imprime lo que recibe.
8. **Indicadores y mantenimiento:**
   - `GET /api/motores/:codigo/indicadores?desde=&hasta=`: horas de marcha, arranques y arranques fallidos, energía, litros, consumo específico (L/kWh), factor de carga y disponibilidad;
   - `GET /api/motores/:codigo/mantenimiento`: las horas que faltan para cada tarea del plan. Al vencer, abre `mantenimiento_vencido`.

**Verifica**
- `sobretemperatura` en el simulador abre un evento. Al quitarla, se cierra con su duración.
- Corta el broker 10 minutos y provoca una alarma durante el corte: al volver, el evento tiene su inicio real y la notificación avisa del atraso.
- El mismo mensaje enviado dos veces no abre dos eventos.
- Con el *webhook* caído, la notificación queda pendiente y sale al volver, una sola vez.
- Vector DM1: `10 FF 64 00 01 03 FF FF` → lámpara roja, SPN 100 (presión de aceite), FMI 1 (bajo lo normal, grave), 3 ocurrencias.
- Indicadores: 1.800 kWh en 6 horas con 400 kW nominales dan un factor de carga del 75 %; 62,5 L/h a 300 kW dan 0,208 L/kWh.

**Hacer y no hacer**

| Hacer | No hacer | Por qué |
|---|---|---|
| Que cada alarma notificada tenga una acción y un responsable | Avisar todo a todos | La gente aprende a ignorar los avisos, incluido el que importa |
| Guardar las alarmas como eventos con inicio y fin | Dejarlas como un número de 16 bits en la serie | Nadie puede responder "cuántas veces y cuánto duró" |
| Registrar siempre y notificar según contexto | Borrar o no registrar alarmas "molestas" | El historial de una alarma intermitente es el diagnóstico de la falla |
| Dejar que el evento termine cuando la condición se normaliza | Cerrar el evento al reconocerlo | Reconocer es "lo vi", no "se arregló" |
| Guardar el aviso junto al evento y enviarlo aparte | Enviar el aviso dentro de la petición que lo detecta | Si el canal falla, el aviso se pierde o se bloquea la ingesta |

**La dominas si…**
- [ ] Explicas la diferencia entre aviso, disparo y parada, y entre reconocer y normalizar.
- [ ] Explicas por qué las transiciones se calculan con la hora del dato.
- [ ] Calculas el factor de carga y el consumo específico de un arranque.

**Pregunta de entrevista.** *"¿Qué diferencia hay entre una alarma del controlador y una alerta de la plataforma?"* La alarma del controlador protege al equipo: la decide el controlador en terreno, y yo solo la registro como un evento con inicio, fin y reconocimiento. La alerta de la plataforma avisa de lo que el controlador no puede ver: que el equipo dejó de comunicar, que no está en automático o que le toca mantenimiento. Las dos terminan en la misma tabla y en el mismo flujo de avisos.

**Simulacros que habilita:** "la alarma se activó y nadie recibió el aviso", "llegaron 200 avisos en una hora" y "el cliente dice que el grupo no partió en el corte".

**Cierre:** `feat(eventos): alarmas con ciclo de vida, arranques, indicadores y avisos` · tag `fase-21`.

---

## Fase 22 · El contrato con el front

**Objetivo:** que el encargado del front construya sus pantallas sin leer tu código ni tu base, y que tú puedas cambiar por dentro sin romperle nada.
**Tu tiempo:** 3 horas.
**Depende de:** 17 (la 20 y la 21 agregan rutas).

**La idea.** Es el plano de interconexión entre dos contratistas: borneras numeradas, con la señal, el rango y la unidad de cada una. Cada uno arma su tablero sin abrir el del otro. Si alguien cambia una bornera sin avisar, el otro lado deja de funcionar.

**Definiciones**
- **Contrato de API:** el documento que dice, para cada ruta, qué recibe, qué devuelve y con qué errores.
- **OpenAPI:** el formato estándar de ese contrato. De él se generan documentación, tipos y servidores de prueba.
- **Cambio incompatible:** quitar o renombrar un campo, o cambiar su tipo, su unidad o su significado. Agregar un campo opcional es compatible.
- **Reducción de puntos:** entregar una serie con menos puntos de los que se midieron, sin esconder los extremos.
- **Paginación por cursor:** pedir "los siguientes después de este", en vez de "la página 37".
- **CORS:** el permiso que el servidor le da al navegador para que una página de otro origen llame a la API.
- **Renovación de sesión:** un segundo token, de vida larga y revocable, que sirve solo para pedir tokens de acceso nuevos.

**Construyes:** `src/api/contrato/` (esquemas de respuesta y armado del documento), `docs/api/openapi.json`, `docs/api/tiempo-real.md`, las rutas bajo `/api/v1`, la migración `contrato` (`sitios.zona_horaria` y `sesiones`), `src/scripts/demo.js`, `test/contrato.test.js` y `docs/api/CAMBIOS.md`.

**Pasos**

1. **Versión.** Todo queda bajo `/api/v1`. Las rutas actuales siguen respondiendo en `/api`, marcadas como obsoletas, para no romper el dashboard ni las pruebas.
2. **Una sola fuente.** Cada respuesta tiene su esquema zod, y `z.toJSONSchema()` lo convierte al formato de OpenAPI 3.1. `npm run contrato` escribe `docs/api/openapi.json`, y `GET /api/v1/openapi.json` lo sirve.
   - Las fechas de las respuestas se declaran con `z.iso.datetime()`, no con `z.date()`: por el cable viajan como texto ISO 8601 con `Z` (paso 5), y `z.date()` no tiene equivalente en JSON Schema. Las pruebas de contrato validan el cuerpo ya convertido a JSON.
   - El contrato se genera con `z.toJSONSchema(esquema, { unrepresentable: 'any' })`: lo que no se puede representar queda como "cualquier valor", en vez de detener la generación. OJO: un `z.date()` olvidado saldría así, sin decir que es una fecha; revisa el JSON generado.
   - Los parámetros de consulta se describen con `io: 'input'`, es decir, como los manda el cliente: un parámetro con `.default()` es opcional para quien llama, aunque después de validar siempre exista.
3. **Lo que necesita un front de monitoreo:**

   | Ruta bajo `/api/v1` | Entrega |
   |---|---|
   | `GET /variables` | El catálogo: código, descripción, unidad, grupo, tipo, rangos y enumeraciones |
   | `GET /sitios` | Los sitios visibles, con su zona horaria |
   | `GET /flota?sitio=` | Una fila por equipo: estado, modo, potencia, alarmas activas, último dato, comunicación y calidad |
   | `GET /motores/:codigo` | La ficha: placa, régimen, perfil y versión |
   | `GET /motores/:codigo/estado` | El último valor de cada variable, con su calidad y `sin_valor_motivo` |
   | `GET /motores/:codigo/series` | Una o varias series, con resolución |
   | `GET /alarmas?activa=&sitio=&severidad=&cursor=` | Eventos de alarma, paginados por cursor |
   | `GET /motores/:codigo/arranques`, `/indicadores` y `/mantenimiento` | Lo de la Fase 21 |

   `/flota` existe para que la pantalla principal haga una sola llamada, y no una por equipo.
4. **Series con resolución:** `?variables=rpm,gen_potencia_activa&desde=&hasta=&resolucion=auto&max_puntos=1500`.
   - Resoluciones: `cruda`, `1m`, `15m`, `1h` y `1d`. Con `auto` se elige la más fina que no supere `max_puntos`.
   - Punto crudo: `{ t, v, c }`. Punto agregado: `{ t, prom, min, max, n, pct_buena }`.
   - El mínimo y el máximo viajan siempre: un promedio solo escondería los picos.
   - La respuesta dice qué resolución usó y la unidad de cada variable.
   - Tope de rango por resolución: cruda 6 horas, `1m` un día, `15m` 7 días, `1h` 90 días y `1d` 2 años.
   - Referencias: 7 días a `15m` son 672 puntos; 30 días a `1h`, 720.
5. **Horas.** La API entrega siempre UTC en ISO 8601 con `Z`; el front convierte a la zona del sitio. El "día" de `1d` y de los informes es el día local del sitio. Chile tiene más de una zona, y los días de cambio de hora duran 23 o 25 horas.
6. **Errores con un solo formato** (`application/problem+json`, RFC 9457): `type`, `title`, `status`, `detail` y, en una validación, los errores por campo. El front escribe un solo manejador de errores.
   - Cada error por campo lleva el `code` de zod (`too_small`, `invalid_type`) además del mensaje en español, que sale de `z.config(z.locales.es())` en `src/comun/zod.js`. POR QUÉ: el front decide con el `code`, que no cambia aunque cambie la redacción o el idioma; el mensaje es para mostrárselo a una persona.
   - OJO: `z.flattenError`, el que usa hoy `src/comun/validacion.js`, guarda solo los mensajes. Para conservar el `code`, se le pasa una función como segundo argumento: `z.flattenError(error, (i) => ({ code: i.code, mensaje: i.message }))`.
7. **Sesión para una aplicación web:**
   - `POST /auth/renovar`: un token de renovación rotatorio, en una cookie `HttpOnly`, `Secure` y `SameSite`. Su hash se guarda en `sesiones`. Si un token ya usado se presenta otra vez, se revoca toda la cadena;
   - `POST /ws-ticket`: un ticket de un solo uso y 30 segundos para abrir el WebSocket. Es la mejora que dejaste anotada en `docs/decisiones.md`;
   - CORS con lista blanca (`CORS_ORIGENES`), nunca `*` junto con credenciales.
8. **El tiempo real también es contrato.** `docs/api/tiempo-real.md` describe cada tipo de mensaje del WebSocket (`lecturas`, `gateway`, `alerta`, `alarma` y `comunicacion`) con su versión.
9. **Para que el front no dependa de ti:**
   - `npm run demo` carga una semana de datos creíbles de cinco equipos: arranques, alarmas, un corte y un sensor en falla;
   - con `openapi.json`, el front puede generar sus tipos y levantar un servidor simulado.
10. **Pruebas de contrato:**
    - cada ruta del contrato responde algo que su esquema acepta;
    - el `openapi.json` guardado es igual al generado: si cambias una respuesta sin regenerar el contrato, la prueba falla.
11. **Reglas de cambio,** en `docs/api/CAMBIOS.md`:
    - se puede agregar;
    - lo incompatible va a `/api/v2`;
    - lo obsoleto se anuncia con los encabezados `Deprecation` y `Sunset`, y con una fecha.

**Verifica**
- El JSON del contrato se abre sin errores en un visor de OpenAPI.
- La serie de 7 días de una variable devuelve 672 puntos a `15m`, con mínimo y máximo, y no unos 121.000 puntos crudos.
- Una respuesta de error tiene el mismo formato para un 401, un 404 y un 422.
- Un 422 trae, en cada error por campo, el `code` de zod y el mensaje en español.
- Con un token de renovación robado y reutilizado, la sesión completa queda revocada.
- Renombra un campo de una respuesta sin regenerar el contrato: `npm test` falla.

**Hacer y no hacer**

| Hacer | No hacer | Por qué |
|---|---|---|
| Diseñar las respuestas para la pantalla | Devolver las tablas tal cual | Cada cambio de la base rompería al front |
| Entregar la unidad, la calidad y la resolución con el dato | Dejar que el front adivine o calcule estados | Dos lugares con la misma regla terminan mostrando cosas distintas |
| Reducir puntos en el servidor, con mínimo y máximo | Mandar 121.000 puntos a un gráfico de 1.000 píxeles | El navegador se arrastra y el gráfico no muestra más |
| Agregar campos; versionar lo incompatible | Renombrar un campo "porque quedó mejor" | El front falla en producción y tú no te enteras |
| Paginar todo lo que puede crecer | Devolver "todas las alarmas" | Funciona con 50 y se cae con 500.000 |
| Entregar datos de demostración y el contrato desde el primer día | Hacer esperar al front hasta que haya equipos reales | Los dos trabajan en paralelo y los desacuerdos aparecen antes |

**La dominas si…**
- [ ] Explicas qué cambio es compatible y cuál no, con un ejemplo de tu API.
- [ ] Explicas por qué la serie viaja con mínimo y máximo.
- [ ] Explicas cómo se renueva la sesión y qué pasa si roban el token de renovación.

**Pregunta de entrevista.** *"El front te pide un gráfico de tres meses de potencia. ¿Qué le entregas?"* Una serie reducida en el servidor: un punto por día con promedio, mínimo y máximo, la unidad, el porcentaje de datos buenos y la resolución usada. Más de 1,5 millones de puntos crudos (uno cada 5 s) no le sirven a un gráfico. Si quiere mirar un día, vuelve a pedir ese rango y recibe más detalle. Todo está en el contrato OpenAPI, con datos de demostración para que no dependa de mí.

**Simulacros que habilita:** "el front dice que la API cambió" y "el gráfico muestra datos en la hora equivocada".

**Cierre:** `feat(api): contrato OpenAPI, /api/v1, series con resolución y sesión para el front` · tag `fase-22`.

---

## Fase 23 · Observabilidad: métricas, alertas y objetivos

**Objetivo:** enterarte de un problema antes que el cliente, con evidencia para diagnosticarlo y un procedimiento para cada alerta.
**Tu tiempo:** 3 horas.
**Depende de:** 16, por el servicio `tareas`; aprovecha lo de las fases 18 y 20, si existen.

**La idea.** Hoy la plataforma vigila a los motores; falta vigilar a la plataforma. Es armarle su propia sala de control: instrumentos (métricas con historia), alarmas con prioridad, un procedimiento por alarma y alguien que vigile al vigilante.

**Definiciones**
- **Métrica, log y traza:** la métrica es un número en el tiempo (cuánto); el log, un hecho con detalle (qué pasó); la traza, el recorrido de una petición (por dónde).
- **Contador, medidor e histograma:** el contador solo sube (mensajes recibidos); el medidor sube y baja (filas en cola); el histograma reparte las observaciones en tramos, y de él salen los percentiles.
- **Percentil 95:** el valor bajo el cual queda el 95 % de las mediciones. Cuenta lo que vive casi todo el mundo; el promedio lo esconde.
- **SLI, SLO y presupuesto de error:** el indicador que mides, el objetivo que te comprometes a cumplir y cuánto puedes fallar sin incumplirlo.
- **Alerta accionable:** la que exige que alguien haga algo ahora. Si no hay nada que hacer, no es una alerta.
- **Vigilante:** una alerta que está siempre encendida. Si deja de llegar, lo caído es el monitoreo.
- **Sonda de caja negra:** una prueba que usa el sistema desde fuera, como un cliente.

**Construyes:** `src/comun/metricas.js`, la instrumentación de la API y del gateway, `src/scripts/sonda.js`, la carpeta `observabilidad/` (Prometheus, reglas, Alertmanager y Grafana), el perfil `observabilidad` de Compose, la tabla `hitos_operacion`, `docs/operacion/objetivos.md` y más procedimientos en `RUNBOOK.md`.

**Pasos**

1. **`metricas.js`,** con `prom-client`. Un puerto aparte (`METRICAS_PUERTO`) sirve `/metrics`, y no se publica fuera de la red interna.
2. **Qué medir:**

   | Tema | Métricas |
   |---|---|
   | HTTP | Duración por método, ruta (el patrón, no la URL) y estado |
   | Ingesta | Mensajes, lecturas por resultado, rechazos por motivo, retraso entre `ts` y la llegada (histograma) y saltos de secuencia |
   | Loteador | Filas pendientes, duración de cada escritura y filas descartadas |
   | Base | Conexiones del pool en uso, bytes por tabla y días de particiones abiertos por delante |
   | Terreno | Equipos en silencio, gateways en línea y, por gateway, mensajes en buffer y desfase de reloj |
   | Operación | Edad de cada hito: el último respaldo, el último lote de calidad, la hora más reciente de `lecturas_hora` y la última restauración probada |

   Los gateways publican su propia salud cada minuto en `motores/{sitio}/gateways/{id}/salud`.
3. **Perfil `observabilidad` de Compose:** Prometheus, Alertmanager, Grafana (con la fuente de datos y un tablero guardados como archivos), el exportador de MySQL (con un usuario `telemetria_monitor` de solo lectura) y un receptor de alertas que las imprime. Fija la versión de cada imagen.
4. **Sonda de punta a punta.** `sonda.js` es una tarea del servicio `tareas` (Fase 16): cada minuto publica una lectura de un equipo de prueba, `MTR-9999`, en un sitio propio llamado `sonda`, por MQTT y con su propia credencial. Después consulta la API hasta verla. Mide si llegó y cuánto tardó. Es el indicador que más se parece a lo que vive un cliente.
   - El código cumple la regla de siempre (`^MTR-\d{2,4}$`, en `rutas/motores.js`): la validación no se relaja por la sonda.
   - `MTR-9999` queda reservado: nunca se asigna a un equipo real.
   - El sitio `sonda` se excluye de los indicadores y de las alertas de la flota, como la completitud y `EquiposEnSilencio`. La sonda tiene su propia alerta, `SondaFallando`.
   - OJO: si `tareas` se detiene, no hay sonda que falle. Por eso `SondaFallando` también se dispara cuando la sonda deja de informar.
5. **Reglas de alerta,** cada una con su gravedad y un enlace a su procedimiento:

   | Alerta | Condición | Gravedad |
   |---|---|---|
   | `ApiCaida` | Prometheus no logra leer la API por 2 minutos | Urgente |
   | `SondaFallando` | La sonda no ve su dato 3 veces seguidas, o no informa por 3 minutos | Urgente |
   | `IngestaDetenida` | Ninguna lectura aceptada en 10 minutos | Urgente |
   | `LoteadorAcumulando` | Las filas pendientes crecen durante 10 minutos | Urgente |
   | `RespaldoAntiguo` | El último respaldo tiene más de 26 horas | Urgente |
   | `RetrasoAlto` | El percentil 95 del retraso supera 60 s por 10 minutos | Aviso |
   | `RechazosAltos` | Más del 5 % de las lecturas rechazadas en 15 minutos | Aviso |
   | `EquiposEnSilencio` | Algún equipo en silencio por 10 minutos | Aviso |
   | `ParticionesPorAgotarse` | Quedan menos de 15 días de particiones abiertas | Aviso |
   | `AgregadosAtrasados` | La hora más reciente de `lecturas_hora` tiene más de 2 horas. Por qué 2 horas: en marcha normal, esa edad llega a 1 h 15 min con el lote de la Fase 20 (cada 15 minutos) y a 1 h 5 min con el evento de la Fase 11 (a las HH:05), porque los dos recalculan también la hora en curso. Con el lote quedan 45 minutos de margen: dos corridas perdidas seguidas no la disparan | Aviso |
   | `Vigilante` | Siempre activa | — |

   Urgente significa que alguien se despierta. Aviso significa que se revisa en horario hábil.
   - **Regla de inhibición en Alertmanager:** mientras `IngestaDetenida` está activa, no se notifican `EquiposEnSilencio` ni `AgregadosAtrasados`. Una causa, una alerta: si no entra ninguna lectura, todos los equipos callan y los agregados se atrasan, pero el problema es uno solo. El detalle se diseña en esta fase.
6. **Objetivos,** en `docs/operacion/objetivos.md`:
   - frescura: el 99 % de las sondas ve su dato en la API en menos de 30 s;
   - disponibilidad de la API: 99,5 % al mes, es decir, un presupuesto de error de 3,6 horas;
   - completitud: cada equipo activo entrega al menos el 99 % de los mensajes esperados al día.

   Cada objetivo dice cómo se mide y qué se hace cuando el presupuesto se agota: se detienen los cambios y se trabaja en estabilidad.
7. **Correlación.** Cada petición HTTP lleva un identificador (`X-Request-Id`), que aparece en todos sus logs. En la ingesta, el log de un rechazo lleva el gateway, el equipo y el `seq`.
8. **`RUNBOOK.md`:** un procedimiento por cada alerta urgente, probado con un simulacro.

**Verifica**
- Repite dos simulacros de la Fase 15 mirando solo Grafana y las alertas, y compara tu tiempo de diagnóstico con el de antes.
- Detén la API: `ApiCaida` llega al receptor en menos de 3 minutos.
- Detén Prometheus: el `Vigilante` deja de llegar.
- Un tablero muestra, para un corte del broker, el buffer del gateway que crece y después se vacía.

**Hacer y no hacer**

| Hacer | No hacer | Por qué |
|---|---|---|
| Alertar por lo que siente el usuario: frescura, errores y disponibilidad | Alertar por cada causa posible (CPU, memoria) | Las causas son infinitas; los síntomas, pocos y siempre relevantes |
| Un procedimiento y un responsable por alerta | Alertas que nadie sabe cómo atender | A las 3 de la mañana no se improvisa |
| Usar el patrón de la ruta y un conjunto acotado de etiquetas | Poner el id de cada petición o la hora como etiqueta | Cada valor distinto crea una serie nueva, y Prometheus se queda sin memoria |
| Vigilar al vigilante desde fuera | Dejar el detector de fallas dentro de lo que puede fallar | Si cae la API, cae con ella el que avisa |
| Dejar las métricas en una red interna | Publicar `/metrics` hacia internet | Muestran cómo está hecho el sistema por dentro |
| Guardar eventos y números en los logs | Escribir claves, tokens o datos personales | Los logs se copian a muchos lugares y viven mucho tiempo |

**La dominas si…**
- [ ] Explicas la diferencia entre contador, medidor e histograma, con una métrica tuya de cada tipo.
- [ ] Explicas qué es un presupuesto de error y qué decisiones cambia.
- [ ] Explicas por qué el detector de silencio no basta.

**Pregunta de entrevista.** *"¿Cómo defines que la plataforma está arriba?"* Con objetivos medibles desde el lado del usuario: una sonda que publica un dato como si fuera un equipo y comprueba que aparece en la API en menos de 30 segundos, y la disponibilidad de la API. Un 99,5 % mensual me da 3,6 horas de presupuesto de error. Alerto por esos síntomas, cada alerta tiene su procedimiento, y un vigilante avisa si el monitoreo mismo se cae.

**Simulacros que habilita:** todos los anteriores, ahora "solo con los tableros", y "las alertas dejaron de llegar".

**Cierre:** `feat(ops): métricas, tableros, alertas con procedimiento y objetivos de servicio` · tag `fase-23`.

---

## Fase 24 · Respaldo y recuperación a un punto en el tiempo

**Objetivo:** poder volver la base al minuto anterior a un accidente, y haberlo probado.
**Tu tiempo:** 2 horas.
**Depende de:** 16, por el servicio `tareas`.

**La idea.** El respaldo es el grupo de emergencia de tus datos. No se evalúa por tenerlo instalado, sino por si parte y toma carga el día del corte. Por eso se prueba con carga y con el reloj corriendo.

**Definiciones**
- **RPO:** cuántos datos puedes perder, medido en tiempo. Con un respaldo diario, hasta 24 horas.
- **RTO:** cuánto puedes tardar en volver a operar.
- **Respaldo lógico y físico:** el lógico es SQL que recrea la base (`mysqldump`); el físico copia los archivos.
- **Binlog:** el registro de todos los cambios de la base, en orden. MySQL 8.4 lo trae encendido.
- **Recuperación a un punto en el tiempo:** restaurar el último respaldo y volver a aplicar el binlog hasta justo antes del accidente.
- **Regla 3-2-1:** tres copias, en dos medios distintos, una fuera del sitio.

**Construyes:** cambios en `deploy/respaldo.sh`, `deploy/respaldo-binlog.sh` y su registro en `tareas`, el servicio `mysql-restauracion` en Compose (perfil `restauracion`), `docs/operacion/continuidad.md` y la sección 4 de `RUNBOOK.md` ampliada.

**Pasos**

1. **Fija los objetivos** en `continuidad.md`: por ejemplo, RPO de 15 minutos y RTO de una hora. Anota lo que tienes hoy: RPO de 24 horas y un RTO sin medir.
2. **`respaldo.sh`:**
   - deja el `crontab` de la Fase 13: se registra en el servicio `tareas`, una vez al día;
   - agrega `--source-data=2`, que anota dentro del respaldo el archivo y la posición del binlog en ese instante;
   - guarda un SHA-256 del archivo;
   - si ya hiciste la Fase 23, registra el hito `respaldo_ok` en `hitos_operacion`, para la alerta `RespaldoAntiguo`.
3. **`respaldo-binlog.sh`,** registrado en `tareas` cada 15 minutos: `FLUSH BINARY LOGS` cierra el binlog en curso, y los cerrados se copian a la carpeta de respaldos. Ese intervalo es tu RPO.
4. **Una instancia aparte para restaurar.** `mysql-restauracion` usa la misma imagen, otro volumen y otro puerto (`127.0.0.1:3308`), sin los scripts de `sql/`.
5. **El simulacro.** El agente ejecuta un `UPDATE` sin `WHERE` sobre `variables` en un momento que no te dice, con la ingesta andando. Tú:
   1. lo detectas y acotas la hora;
   2. decides si detener la ingesta. Aquí conviene: sin rangos válidos, todo se está calificando mal;
   3. restauras el último respaldo en `mysql-restauracion`;
   4. buscas la transacción en una **copia** del binlog, con `mysqlbinlog --verbose --base64-output=DECODE-ROWS`;
   5. aplicas el binlog desde la posición del respaldo hasta justo antes de la transacción culpable (`--stop-position`);
   6. validas: `variables` está intacta y están los datos posteriores al respaldo;
   7. reparas producción copiando solo `variables` desde la instancia restaurada;
   8. anotas cuánto tardaste. Ese es tu RTO real.
6. **Saltar solo lo malo.** Para no perder lo que entró después del accidente:
   - aplica hasta `--stop-position`: el `# at` que sigue al `COMMIT` anterior;
   - retoma con `--start-position`: el `end_log_pos` del `COMMIT` de la transacción culpable.
7. **Fuera del equipo y cifrado.** Un respaldo en el mismo disco no sobrevive a la pérdida del disco. Documenta dónde iría la copia externa, quién puede restaurar y cómo se protege el respaldo: contiene toda la base.
8. **La prueba se agenda.** Una restauración de prueba al mes, que registra el hito `restauracion_probada` si existe la tabla de la Fase 23.

**Verifica**
- El encabezado del respaldo trae, comentados, el archivo y la posición del binlog.
- Después del simulacro, `variables` vuelve a tener sus rangos y no falta ninguna lectura posterior al respaldo.
- `continuidad.md` muestra el RPO y el RTO medidos junto a los objetivos.

**Ojo**
- `mysqlbinlog` muestra e interpreta las horas en la zona horaria de la máquina donde corre. Trabaja en UTC (`TZ=UTC`) o usa posiciones.
- Comprueba que la imagen trae la herramienta: `docker compose exec mysql sh -c 'command -v mysqlbinlog'`. Si no la trae, úsala desde un contenedor auxiliar.
- En MySQL 8.4, el estado del binlog se consulta con `SHOW BINARY LOG STATUS`. `--single-transaction` da una foto coherente solo de las tablas InnoDB.
- Hoy `respaldo.sh` llama a `docker exec` desde el equipo, y dentro de `tareas` no hay Docker. Montarle el socket de Docker le daría control total del equipo. La tarea se conecta a MySQL por la red, con `mysqldump` y `mysqlbinlog` de MySQL 8.4: el paquete de Debian trae los de MariaDB.

**Hacer y no hacer**

| Hacer | No hacer | Por qué |
|---|---|---|
| Restaurar primero en una instancia aparte y validar | Restaurar encima de producción | Si el respaldo está malo, perdiste también lo que tenías |
| Probar la restauración completa y medir el tiempo | Dar por bueno un respaldo porque el archivo existe | Un respaldo que nunca se restauró es una suposición |
| Copiar el binlog cada pocos minutos | Depender solo del volcado nocturno | Un accidente a las 18:00 costaría el día entero |
| Vigilar la edad del último respaldo con una alerta | Enterarte de que la tarea falló el día que lo necesitas | Los respaldos fallan en silencio |
| Proteger los respaldos igual que la base | Dejarlos en una carpeta compartida | Quien se lleva el respaldo se lleva todo |

**La dominas si…**
- [ ] Explicas RPO y RTO con los números de tu laboratorio.
- [ ] Recuperas la base saltándote una sola transacción.
- [ ] Explicas por qué se restaura en otra instancia.

**Pregunta de entrevista.** *"A las 15:02 alguien ejecutó un UPDATE sin WHERE en producción. ¿Qué haces?"* Acoto la hora y decido si detengo las escrituras, para no seguir dañando. Restauro el último respaldo en una instancia aparte y aplico el binlog hasta justo antes de esa transacción. Valido, y reparo producción con lo recuperado: si puedo, solo la tabla dañada. Después lo dejo por escrito: cuánto se perdió, cuánto tardé y qué control faltó para que no se repita.

**Simulacros que habilita:** el `UPDATE` sin `WHERE`, "se borró una tabla" y "el respaldo de anoche no existe".

**Cierre:** `feat(ops): respaldo con posición de binlog y recuperación a un punto en el tiempo` · tag `fase-24`.

---

## Fase 25 · Entornos, CI y gestión de cambios

**Objetivo:** que ningún cambio llegue a producción sin revisión, sin pruebas automáticas, sin ensayo y sin un camino de vuelta.
**Tu tiempo:** 2 a 3 horas.
**Depende de:** 16, y de terminar el despliegue en Ubuntu de la Fase 13, que quedó pendiente.

**La idea.** Es el permiso de trabajo de una planta. Nadie interviene un equipo en servicio sin una orden, un plan de aislación, alguien que la revise y un plan para dejarlo como estaba. En software, eso es rama, revisión, pruebas automáticas, ensayo en un ambiente gemelo y despliegue con retroceso.

**Definiciones**
- **Entorno:** una copia completa del sistema con un propósito: desarrollo, pruebas o producción.
- **Paridad de entornos:** que pruebas se parezca a producción en versiones, permisos y configuración. Lo que difiere es lo que falla.
- **Integración continua (CI):** en cada cambio propuesto, una máquina limpia instala, prueba y construye el proyecto.
- **Artefacto inmutable:** la imagen se construye una vez por versión, y esa misma pasa de pruebas a producción.
- **Versión semántica:** `mayor.menor.parche`. El número mayor sube cuando el cambio rompe la compatibilidad.
- **Ventana de mantenimiento:** el horario acordado con quienes operan para hacer un cambio.

**Construyes:** `.github/workflows/ci.yml`, `.github/dependabot.yml`, `docs/plantillas/cambio.md`, `docs/plantillas/postmortem.md`, `CHANGELOG.md` y cambios en `deploy/desplegar.sh`.

**Pasos**

1. **Tres entornos, con sus reglas:**

   | Entorno | Dónde | Datos | Quién cambia y cómo |
   |---|---|---|---|
   | Desarrollo | Tu equipo | Simulados | Tú, libremente |
   | Pruebas | El mismo Compose con otro nombre de proyecto y otro archivo de variables (`-p telemetria-pruebas --env-file .env.pruebas`): sus propios volúmenes, puertos y claves | Simulados, con volumen real | Solo por despliegue de una versión |
   | Producción | El Ubuntu de la Fase 13 | Reales | Solo por despliegue de una versión ya ensayada en pruebas |

   Entre entornos cambia solo la configuración, por variables de entorno. El código y la imagen son los mismos.

   OJO: hoy el Compose publica puertos fijos (`3306:3306`, `1883:1883`, `3000:3000`), y dos proyectos no pueden usar el mismo puerto del equipo. Pásalos a variables con valor por defecto, como `"${PUERTO_MYSQL:-3306}:3306"`, y dale a `.env.pruebas` otros valores.
2. **CI en cada PR,** con GitHub Actions:
   1. genera un `.env` con claves al azar;
   2. levanta MySQL y Mosquitto con Compose;
   3. crea los usuarios del broker y prepara la base de pruebas;
   4. ejecuta `npm ci` y `npm test`;
   5. aplica todas las migraciones sobre una base en línea base;
   6. comprueba que el contrato no tiene deriva;
   7. ejecuta `npm audit --audit-level=high`;
   8. construye la imagen.
3. **`main` protegida:** todo entra por PR con el CI en verde. Trabajas solo, así que revisa tu propio PR al día siguiente, como si fuera de otra persona.
4. **Versiones:** un tag anotado por versión, `CHANGELOG.md` con lo que cambió para quien opera, y la imagen construida una vez por tag.
5. **`desplegar.sh` completo:** respaldo → migraciones → cambio de versión → `/api/listo` → sonda de punta a punta. Si algo falla, vuelve atrás solo. Cada despliegue queda registrado: versión, hora y resultado.
6. **Plantilla de cambio** (`docs/plantillas/cambio.md`):
   - qué se cambia y por qué;
   - qué sitios, equipos o clientes toca;
   - el riesgo, y cómo se probó en pruebas;
   - la ventana, y a quién se avisa;
   - el plan de vuelta atrás, con su criterio: "si en 10 minutos la sonda no vuelve, se retrocede";
   - cómo se verifica después;
   - quién aprueba.
7. **Plantilla de postmortem:** resumen, impacto, cronología, causa raíz (con los cinco porqués), qué funcionó, qué no, y acciones con responsable y fecha. Escribe uno de verdad con el simulacro que más te costó.
8. **Actualizaciones.** Dependabot revisa cada semana npm, las imágenes de Docker y las Actions. Regla: los parches entran con el CI en verde; las versiones mayores se planifican como un cambio.

**Verifica**
- Un PR con una prueba rota no se puede fusionar.
- En pruebas, un despliegue con una migración defectuosa se detiene y vuelve atrás solo.
- Existe una solicitud de cambio llena y un postmortem escrito.

**Hacer y no hacer**

| Hacer | No hacer | Por qué |
|---|---|---|
| Ensayar el despliegue en pruebas con la misma imagen | Probar en producción | El primer ensayo siempre encuentra algo |
| Hacer cambios pequeños y frecuentes | Juntar tres meses de cambios en un despliegue | Si falla, no sabes cuál de los cuarenta cambios fue |
| Definir el criterio de retroceso antes de empezar | Decidir en el momento si se vuelve atrás | Bajo presión, se insiste de más |
| Avisar a quienes operan y elegir la ventana | Desplegar un viernes en la tarde | Los problemas aparecen cuando nadie está mirando |
| Cambiar por despliegue | Editar archivos en el servidor por SSH | El servidor queda distinto del repositorio y el próximo despliegue lo pisa |

**La dominas si…**
- [ ] Explicas qué hace el CI y qué no puede detectar.
- [ ] Explicas por qué la imagen se construye una sola vez.
- [ ] Llenas la plantilla de cambio para una migración real.

**Pregunta de entrevista.** *"¿Cómo llevas un cambio a producción?"* Rama, PR y pruebas automáticas. Construyo la imagen una vez y la despliego primero en un entorno de pruebas gemelo. En producción, dentro de una ventana avisada: respaldo, migraciones compatibles con la versión anterior, cambio de versión y verificación con una sonda. El criterio de vuelta atrás queda definido antes de empezar. Si algo sale mal, se retrocede y se escribe el postmortem.

**Simulacros que habilita:** "el despliegue de hoy rompió algo" y "funciona en pruebas y falla en producción".

**Cierre:** `ci: pruebas en cada PR, entornos y plantillas de cambio y postmortem` · tag `fase-25`.

---

## Fase 26 · Capacidad y ciclo de vida del dato

**Objetivo:** saber cuánto aguanta la plataforma, cuánto crece, qué se conserva y por cuánto tiempo.
**Tu tiempo:** 2 a 3 horas.
**Depende de:** 16 y 23.

**La idea.** Un alimentador o un grupo se dimensionan para la carga esperada, con margen, y se comprueban en un banco de carga. La plataforma, igual: primero el cálculo, después la prueba con carga creciente hasta encontrar el límite.

**Definiciones**
- **Capacidad y holgura:** cuánto procesa el sistema antes de degradarse, y qué margen se deja libre.
- **Rodilla de la curva:** el punto donde, al subir la carga, la cola deja de vaciarse y el retraso se dispara.
- **Contrapresión:** cuando una etapa no da abasto, frena a la anterior en vez de perder datos.
- **Retención:** cuánto tiempo se conserva cada nivel de detalle.
- **Archivo:** sacar datos antiguos de la base a un almacenamiento más barato, de modo que se puedan recuperar.

**Construyes:** `src/scripts/capacidad.js`, la migración `retencion` (`lecturas_minuto`), `src/scripts/archivar-particion.js`, `src/scripts/carga-mqtt.js`, `src/api/diario-local.js`, cambios en `ingesta-mqtt.js` y `loteador.js`, y `docs/operacion/capacidad.md`.

**Pasos**

1. **`capacidad.js`.**
   - Entradas: los equipos, las variables por equipo, el período, la fracción del tiempo en marcha y el latido.
   - Salidas: filas por día, GB por mes, MB por mes de enlace por sitio y días de autonomía del buffer del gateway.
   - Los bytes por fila se **miden** en tu base, con `information_schema`. En una tabla de prueba de un millón de filas dieron unos 94 bytes por lectura: 60 de datos y 34 del índice secundario.
2. **Referencias para comparar tu cálculo:**

   | Caso | Filas por día | Disco |
   |---|---|---|
   | 50 equipos, 36 variables, cada 10 s, siempre en marcha | 15,5 millones | 1,5 GB por día, 44 GB al mes |
   | Los mismos 50, detenidos y con latido de 5 minutos | 518.400 | 0,05 GB por día |
   | 200 equipos, en marcha el 25 % del tiempo | 17,1 millones | 1,6 GB por día |

   Un equipo en marcha genera 30 veces más filas que uno detenido: el tamaño depende de cuánto funcionan los equipos, no de cuántos son. Un mensaje JSON de 36 variables pesa cerca de 1 KB: cada 10 s son unos 9 MB al día por equipo, antes de TLS.
3. **Política de retención,** que se acuerda con el negocio (contratos, garantías y auditorías):

   | Nivel | Tabla | Se conserva |
   |---|---|---|
   | Crudo | `lecturas` | 90 días |
   | Por minuto | `lecturas_minuto` | 2 años |
   | Por hora | `lecturas_hora` | Sin límite |

   `lecturas_minuto` tiene la misma forma que `lecturas_hora`, y la resolución `15m` de la Fase 22 pasa a leerla.
4. **`archivar-particion.js`:**
   - exporta la partición más antigua a un archivo comprimido, con un manifiesto: filas, rango de fechas y SHA-256;
   - verifica el conteo;
   - solo con `--confirmar` ejecuta `DROP PARTITION`.

   Prueba el camino de vuelta: carga un archivo en una tabla temporal.
5. **Prueba de carga.** `carga-mqtt.js` publica mensajes por escalones (10, 50, 100, 200… por segundo), unos minutos en cada uno. En Grafana, mira las filas pendientes del loteador, la duración de las escrituras y el retraso. La rodilla es el escalón donde la cola deja de vaciarse. Anota la capacidad y la regla: operar bajo la mitad.
6. **Prueba de pérdida.** En plena carga, mata la API (`docker compose kill api`) y cuenta lo que falta con `seq`. Hoy la API confirma cada mensaje al recibirlo, así que se pierde lo que tenía en memoria.
7. **Confirmar después de guardar.** El mensaje se confirma al broker recién cuando quedó guardado en disco.
   - OJO: no se puede esperar al lote de MySQL dentro de `handleMessage`. mqtt.js procesa los paquetes de a uno y no lee el siguiente (ni siquiera la respuesta al *ping*) hasta que `handleMessage` responde: la ingesta quedaría en un mensaje por lote.
   - Por eso se usa un **diario local**: un SQLite como el buffer del gateway. `handleMessage` guarda el mensaje crudo en el diario y responde, y recién ahí sale la confirmación. El loteador lee del diario y borra lo que MySQL confirmó.
   - Al arrancar, la API reprocesa lo que quedó en el diario. La escritura idempotente absorbe lo repetido.
   - Repite la prueba de pérdida: debe dar cero.
8. **Contrapresión de punta a punta.** Dibuja en `capacidad.md` la cadena con sus topes: MySQL lento → la API deja de confirmar → el broker acumula hasta `max_queued_messages` → los gateways guardan en su buffer hasta su tope. Para cada eslabón: cuánto aguanta, qué alerta avisa y qué se pierde primero.
9. **El guardado del broker.** Mosquitto guarda su cola en disco al apagarse en orden y cada `autosave_interval`, que por defecto es de 1.800 s (30 minutos). Una caída abrupta pierde lo posterior al último guardado, y esos mensajes ya no están en el buffer del gateway, porque el broker los había confirmado.
   - Pruébalo: con la API detenida, deja que se acumulen mensajes, mata el broker con `docker compose kill mosquitto` (SIGKILL), levántalo y cuenta lo que llega a la API.
   - Baja `autosave_interval` (por ejemplo, a 60 s) y repite. Anota en `capacidad.md` el resultado y el costo: más escrituras en disco.
10. **Cuándo cambiar de motor.** En `docs/decisiones.md`, escribe los umbrales concretos (filas por día, tamaño y latencia de las consultas) y las opciones con su costo: una réplica de lectura, una base de series de tiempo o más agregados.

**Verifica**
- `capacidad.js` reproduce las referencias de la tabla.
- La prueba de carga deja un gráfico con la rodilla identificada.
- Después del paso 7, matar la API en plena carga no pierde ninguna lectura, y la capacidad medida con el diario se anota junto a la anterior.
- Después del paso 9, una caída abrupta del broker pierde como máximo lo de su nuevo intervalo de guardado.
- Una partición archivada se puede volver a cargar, y su conteo coincide.

**Hacer y no hacer**

| Hacer | No hacer | Por qué |
|---|---|---|
| Calcular antes de comprometer un período o una cantidad de equipos | Aceptar "cada segundo, todo, para siempre" | El costo crece multiplicando, y se descubre cuando el disco se llena |
| Medir los bytes por fila en tu base | Estimar "unos 20 bytes" | Los índices y los encabezados triplican el tamaño |
| Acordar la retención por escrito | Borrar cuando el disco se llena | Se borra con apuro justo lo que alguien necesitaba |
| Archivar, verificar y recién entonces borrar | `DROP PARTITION` directo | No hay vuelta atrás |
| Conocer la rodilla y operar bajo la mitad | Enterarte del límite en producción | Un corte largo seguido de un drenaje masivo es una prueba de carga no planificada |

**La dominas si…**
- [ ] Calculas filas por día y GB por mes para una flota dada.
- [ ] Explicas la cadena de contrapresión y dónde se pierde primero.
- [ ] Explicas por qué la confirmación espera al diario local y no a MySQL.

**Pregunta de entrevista.** *"Nos piden sumar 200 equipos. ¿Aguanta?"* Lo calculo: variables, período y cuánto tiempo están en marcha me dan filas por día y GB por mes, con los bytes por fila medidos en nuestra base. Lo comparo con la capacidad que encontré en la prueba de carga y con el espacio en disco según la retención acordada. Si queda bajo la mitad de la rodilla, entra; si no, digo qué hay que cambiar: el período, la banda muerta, más agregados u otro motor.

**Simulacros que habilita:** "después del corte de anoche la ingesta va atrasada" y "el disco llegó al 90 %".

**Cierre:** `feat(capacidad): cálculo, retención con archivo, prueba de carga y diario antes de confirmar` · tag `fase-26`.

---

## Fase 27 · Zonas y conductos, TLS y un certificado por equipo

**Objetivo:** que la arquitectura del laboratorio respete las reglas de una red industrial: zonas separadas, conexiones que solo salen del sitio, cifrado y una identidad por equipo.
**Tu tiempo:** 3 horas.
**Depende de:** nada (la 18 la enriquece).

**La idea.** Una planta se divide en áreas, y entre ellas solo hay pasos controlados: nadie cruza de la sala eléctrica a la oficina por una puerta cualquiera. En redes es igual. Lo que está junto al proceso no conversa directo con la oficina ni con internet: pasa por un punto intermedio y vigilado.

**Definiciones**
- **OT y TI:** OT son los sistemas que miden y controlan el proceso físico; TI, los que manejan información. En OT, lo primero es la seguridad de las personas y la continuidad.
- **Modelo de Purdue:** la forma estándar de ordenar una planta por niveles, del sensor (0) a la red corporativa (4 y 5).
- **Zona y conducto** (IEC 62443): una zona agrupa equipos con el mismo nivel de exigencia; un conducto es el único camino permitido entre dos zonas.
- **DMZ industrial:** la zona intermedia entre la planta y el resto. Los dos lados llegan a ella, y ninguno la atraviesa.
- **Conexión saliente:** la inicia el sitio hacia afuera. El sitio no acepta conexiones entrantes.
- **TLS mutuo:** el cliente comprueba la identidad del servidor y, además, el servidor exige un certificado al cliente.
- **CA, certificado y revocación:** la autoridad que firma identidades, la identidad firmada y la forma de anularla antes de que venza.
- **Modelo de amenazas:** la lista ordenada de qué puede salir mal, por dónde y qué control lo cubre.

**Construyes:** `docs/seguridad/zonas.md`, `docs/seguridad/amenazas.md`, `docs/seguridad/endurecimiento.md`, las redes en `docker-compose.yml`, `src/scripts/crear-ca.sh` y `emitir-certificado.sh`, la carpeta `tls/` (que Git ignora) y cambios en `mosquitto.conf`, `acl`, el gateway y la API.

**Pasos**

1. **El mapa.** Ubica cada pieza en su nivel:

   | Nivel | En un sitio real | En tu laboratorio |
   |---|---|---|
   | 0 | Sensores y actuadores del grupo | El modelo de `grupo.js` |
   | 1 | El controlador del grupo y la ECU | El simulador Modbus y el log CAN |
   | 2 | La pantalla local o el SCADA del sitio | — |
   | 3 | El gateway del sitio | `gateway.js` y Node-RED |
   | DMZ | El punto de entrada de la plataforma | Mosquitto |
   | 4 y 5 | La plataforma y sus usuarios | API, MySQL, observabilidad y front |

   En `zonas.md`, dibuja el diagrama con cada conducto: protocolo, puerto, sentido y quién inicia la conexión.
2. **Redes en Compose:** `terreno` (simulador y gateway), `borde` (gateway y broker) y `plataforma` (broker, API, MySQL y observabilidad). El gateway es el único que está en `terreno` y en `borde`; el broker, el único entre `borde` y `plataforma`.
3. **Puertos.** MySQL y Mosquitto dejan de publicarse en todas las interfaces: quedan en `127.0.0.1` o sin publicar. Es el pendiente que anotaste en la Fase 12.
4. **La CA del laboratorio.**
   - Antes de generar nada, agrega `tls/`, `*.key` y `*.pem` a `.gitignore`: tu repositorio es público.
   - `crear-ca.sh` crea la autoridad en `tls/`.
   - `emitir-certificado.sh <nombre>` firma un certificado: uno para el broker, con los nombres `mosquitto` y `localhost`, y uno por cada cliente del broker (la API, cada gateway, Node-RED y la sonda), con su nombre de usuario como CN.
   - OJO en Git Bash: `-subj "/CN=..."` se convierte en una ruta de Windows. Usa `MSYS_NO_PATHCONV=1` o `//CN=...`.
5. **Broker con TLS mutuo:** `listener 8883` con `cafile`, `certfile`, `keyfile`, `require_certificate true` y `use_identity_as_username true`. La identidad del cliente pasa a ser el CN de su certificado, y la ACL se aplica a ese nombre. El 1883 sin cifrar se cierra, y con él se quitan de `mosquitto.conf` las dos líneas del plugin de claves: `plugin /usr/lib/mosquitto_password_file.so` y `plugin_opt_password_file`. El archivo `passwd` deja de usarse.
   - OJO: si esas dos líneas quedan, el plugin puede seguir pidiendo clave en el 8883 aunque el certificado sea válido.
   - **La ACL deja el comodín de sitio** y pasa a permisos por tipo de tópico. Con `motores/norte/#`, un gateway robado puede publicar alertas falsas en `motores/norte/alertas` y, desde la Fase 28, comandos. Cada gateway escribe solo la telemetría, el estado y la comunicación de su sitio (y su salud, desde la Fase 23), y desde la Fase 28 solo lee sus comandos. La API es la única que escribe comandos y alertas. Para el sitio norte:
     ```
     user gw-norte
     topic write motores/norte/+/telemetria
     topic write motores/norte/+/comunicacion
     topic write motores/norte/gateways/gw-norte/estado
     # desde la Fase 23
     topic write motores/norte/gateways/gw-norte/salud
     # desde la Fase 28
     topic read motores/norte/+/comandos

     user api
     topic read motores/#
     topic write motores/+/alertas
     # desde la Fase 28
     topic write motores/+/+/comandos

     user sonda
     topic write motores/sonda/MTR-9999/telemetria
     ```
6. **Clientes.** El gateway y la API se conectan con `mqtts://` y validan al broker con la CA (`rejectUnauthorized: true`). Nunca se desactiva la validación "para probar".
7. **Tres simulacros de identidad:**
   - renueva el certificado de `gw-norte` sin perder datos: el buffer cubre el reinicio;
   - "robaron el gateway de sur": anula su acceso (con una lista de revocación en `crlfile`, o quitando su sección de la ACL) y comprueba que ya no puede publicar;
   - emite un certificado que venza en 5 minutos y observa el síntoma, para reconocerlo cuando pase de verdad.
8. **Cuentas de MySQL por función,** cada una con lo mínimo:
   - `telemetria_app`, que ya existe;
   - `telemetria_migra`, para cambios de esquema;
   - `telemetria_respaldo`;
   - `telemetria_monitor`.

   Root deja de usarse en los scripts.
9. **Endurecimiento del servidor** (`endurecimiento.md`):
   - SSH solo con llave y sin root;
   - firewall cerrado, salvo 443 y 8883;
   - actualizaciones de seguridad automáticas;
   - servicios sin privilegios;
   - tamaño de logs acotado;
   - un inventario de qué versión corre dónde.
10. **Modelo de amenazas en una página.** Para cada conducto, qué puede salir mal y qué control lo cubre: suplantar un gateway, inyectar datos falsos, leer datos de otro cliente, tumbar el broker o robar un respaldo.

**Verifica**
- Desde el contenedor de la API, una conexión al simulador falla: no hay ruta.
- Con el certificado de `gw-norte` se publica en `motores/norte/...`. En `motores/sur/...`, el broker responde "no autorizado" (código 135).
- Con ese mismo certificado tampoco se publica en `motores/norte/alertas`: eso solo lo escribe la API.
- Sin certificado, la conexión se rechaza en el saludo TLS.
- Después de anular a `gw-sur`, su gateway no logra publicar y sus mensajes quedan en el buffer.
- `docker compose ps` no muestra `0.0.0.0:3306` ni `0.0.0.0:1883`.

**Hacer y no hacer**

| Hacer | No hacer | Por qué |
|---|---|---|
| Que el gateway inicie la conexión hacia afuera | Abrir un puerto de entrada en el sitio | Un puerto abierto en una planta es una puerta para cualquiera que la encuentre |
| Dar una identidad a cada equipo | Compartir una clave entre sitios o equipos | Si se filtra una, hay que cambiar todas, y no sabes quién fue |
| Cifrar y autenticar todo lo que cruza una zona | Publicar Modbus (502) o MQTT sin TLS hacia internet | Modbus no tiene clave: quien llega, lee y escribe |
| Separar las redes y permitir solo lo necesario | Dejar un equipo con una pata en la planta y otra en la oficina | Ese equipo es el puente que usa un ataque para cruzar |
| Rotar y revocar como rutina ensayada | Aprender a revocar el día del robo | Con el incidente encima no hay tiempo para leer el manual |
| Coordinar parches y reinicios con la operación | Aplicar una actualización automática a un equipo de planta | En OT, un reinicio fuera de ventana es una detención del proceso |

**La dominas si…**
- [ ] Dibujas las zonas de tu sistema y explicas cada conducto.
- [ ] Explicas TLS mutuo y por qué la identidad sale del certificado.
- [ ] Revocas un gateway y demuestras que quedó fuera.

**Pregunta de entrevista.** *"¿Cómo conectas un sitio remoto a la plataforma sin exponer la planta?"* El gateway inicia una conexión saliente y cifrada hacia un broker que está en una zona intermedia; el sitio no abre ningún puerto de entrada. Cada gateway tiene su propio certificado, y el broker solo le deja publicar en los tópicos de su sitio. La plataforma lee del broker y nunca llega a la red de control. Si un equipo se pierde, revoco su certificado y los demás siguen igual.

**Simulacros que habilita:** un certificado vencido, un gateway revocado y "alguien publicó datos de otro sitio".

**Cierre:** `feat(seguridad): zonas de red, TLS mutuo y un certificado por gateway` · tag `fase-27`.

---

## Fase 28 · Escribir hacia terreno: comandos seguros (opcional)

**Objetivo:** entender, construyéndolo en el simulador, todo lo que exige mandar una orden a un equipo real. Hazla solo si tu cargo va a incluir escritura hacia terreno, y nunca la copies a un equipo real sin el procedimiento de la empresa.
**Tu tiempo:** 2 horas.
**Depende de:** 18, 21 y 27.

**La idea.** En terreno existen el selector local/remoto y el candado de bloqueo: si alguien está con las manos en el equipo, nada lo arranca a distancia. La plataforma nunca pasa por encima de eso. Pide; el controlador decide.

**Definiciones**
- **Comando y consigna:** el comando pide una acción (arrancar o detener); la consigna fija un valor objetivo (potencia).
- **Enclavamiento:** una condición que debe cumplirse para que la acción se permita.
- **Bloqueo y etiquetado (LOTO):** el procedimiento que impide energizar un equipo mientras alguien lo interviene.
- **Cuatro ojos:** una persona pide y otra aprueba.
- **Caducidad:** el plazo después del cual una orden ya no vale.
- **Fallo seguro:** ante la duda o la pérdida de comunicación, el sistema queda en el estado menos peligroso.

**Construyes:** la migración `comandos`, `src/api/comandos.js`, `src/api/rutas/comandos.js`, `src/gateway/comandos.js`, el registro de comando y el selector en el simulador, y sus pruebas.

**Pasos**

1. **Apagado por defecto.** `COMANDOS_HABILITADOS=false`, y cada equipo tiene su propia marca `acepta_comandos`.
2. **La tabla `comandos`:**
   - identificador único, equipo, tipo (`arrancar`, `detener` o `reconocer_alarma`) y parámetros;
   - quién lo pidió y quién lo aprobó;
   - estado: `solicitado`, `aprobado`, `enviado`, `ejecutado`, `rechazado` o `vencido`;
   - la hora de cada paso, `vence_en` y el resultado.
3. **En la API:**
   - el rol nuevo `operador` solicita, y `arrancar` exige la aprobación de otra persona;
   - se rechaza si el equipo está en mantenimiento, si no acepta comandos o si ya hay uno en curso;
   - tope de comandos por equipo y por hora;
   - todo queda en la auditoría.
4. **El transporte.** Se publica en `motores/{sitio}/{motor}/comandos` con QoS 1 y **sin retener**, con el identificador y `vence_en` (30 segundos). La ACL permite que solo la API escriba ahí y que solo ese gateway lo lea.
5. **En el gateway,** antes de escribir nada:
   1. descarta el comando vencido;
   2. descarta el repetido: el mismo identificador se ejecuta una sola vez;
   3. comprueba los enclavamientos leyendo el equipo: modo automático, selector en remoto y ninguna parada activa;
   4. escribe el registro de comando (función 06);
   5. **verifica leyendo** que el estado cambió, y publica el resultado.

   Esta es la única escritura Modbus del sistema, aislada en `src/gateway/comandos.js`.
6. **Pruebas:**
   - un comando que llega después de un corte ya venció, y no se ejecuta;
   - el mismo comando entregado dos veces se ejecuta una vez;
   - con el equipo en mantenimiento, la API lo rechaza;
   - con el selector en local, el gateway lo rechaza aunque la API lo haya aprobado.

**Verifica**
- Pide un arranque con el gateway desconectado y vuelve a conectarlo después de un minuto: el equipo no arranca, y el comando queda `vencido`.
- El recorrido completo queda en la auditoría: quién pidió, quién aprobó, cuándo se ejecutó y qué respondió el equipo.

**Hacer y no hacer**

| Hacer | No hacer | Por qué |
|---|---|---|
| Poner caducidad a toda orden | Publicar un comando retenido | Un "arrancar" retenido se ejecuta de nuevo en cada reconexión, quizás con alguien adentro |
| Respetar el selector local y el bloqueo de mantenimiento | Ofrecer un "forzar" desde la plataforma | El bloqueo existe para proteger a una persona |
| Confirmar leyendo el estado del equipo | Dar por ejecutado lo que se envió | Enviar no es lo mismo que ejecutar |
| Dejar las protecciones y el control rápido en el controlador | Cerrar un lazo de control a través de internet | El enlace se cae, y la latencia varía |
| Mostrar el equipo exacto y pedir confirmación | Un botón "aplicar a todos" | Un error en un equipo es un incidente; en toda la flota, un desastre |

**La dominas si…**
- [ ] Explicas las cinco comprobaciones del gateway y qué accidente evita cada una.
- [ ] Explicas por qué un comando no puede ser un mensaje retenido.
- [ ] Explicas quién tiene la última palabra y por qué.

**Pregunta de entrevista.** *"¿Dejarías arrancar un grupo desde la web?"* Solo con todas las barreras. El equipo debe estar habilitado para comandos y con su selector en remoto. La orden lleva la solicitud de una persona, la aprobación de otra, una caducidad corta y un identificador único. El gateway comprueba los enclavamientos antes de escribir, y confirma leyendo el estado. Si el equipo está en mantenimiento, no hay forma de pasar por encima. La protección sigue siendo del controlador.

**Simulacros que habilita:** "el grupo arrancó solo después de un corte de enlace".

**Cierre:** `feat(comandos): escritura hacia terreno con enclavamientos, caducidad y auditoría` · tag `fase-28`.

---

## Fase 29 · Puesta en servicio de un sitio

**Objetivo:** dar de alta un sitio nuevo con un procedimiento que deja evidencia de que cada señal es correcta.
**Tu tiempo:** 2 horas.
**Depende de:** 17, 18, 19 y 27.

**La idea.** Es lo que ya hiciste en proyectos de control: FAT, SAT y la prueba punto a punto, con un protocolo firmado. Un dato que nadie comparó contra el equipo real es una suposición. La mayoría de los problemas de calidad nacen el día de la conexión y se descubren meses después.

**Definiciones**
- **Puesta en servicio:** el conjunto de pruebas que demuestra que un sistema instalado funciona como se diseñó.
- **FAT y SAT:** la prueba en fábrica, con señales simuladas, y la prueba en sitio, con el equipo real.
- **Prueba punto a punto:** comparar cada señal, una por una, entre el origen y el destino.
- **Acta:** el documento con los resultados y las firmas. Es la línea base del sitio.
- **Baja:** el retiro ordenado de un equipo, con sus credenciales revocadas y sus datos conservados.

**Construyes:** `docs/procedimientos/puesta-en-servicio.md`, `docs/procedimientos/baja-de-equipo.md`, `src/scripts/alta-sitio.js`, `src/scripts/verificar-sitio.js` y la carpeta `docs/actas/`.

**Pasos**

1. **`alta-sitio.js`.** A partir de un archivo de definición, crea en un solo paso y de forma repetible:
   - el sitio, con su zona horaria;
   - los equipos, con su perfil y sus datos de placa;
   - el certificado del gateway;
   - la sección del gateway en la ACL.

   OJO: antes de dar de alta sitios reales, el formato del código de equipo (`MTR-` y de 2 a 4 dígitos) se revisa contra la nomenclatura de la empresa. Ese código viaja en los tópicos, la ACL, las URL de la API y las integraciones: cambiarlo después obliga a tocar todo eso. `MTR-9999` y el sitio `sonda` están reservados para la sonda (Fase 23).
2. **El procedimiento,** en cinco etapas:
   1. **Antes de viajar:** el modelo y el firmware de cada controlador, su manual de comunicaciones, el perfil probado contra el simulador, la red del sitio (el gateway solo necesita salida) y la ventana acordada con quien opera.
   2. **Conexión:** el gateway lee sin error, su reloj está sincronizado y su credencial funciona.
   3. **Punto a punto:** para cada variable del perfil, el valor en la pantalla del controlador contra el valor en la plataforma, con una tolerancia. Se anotan los dos.
   4. **Alarmas y estados:** se provoca o se simula cada alarma importante y se ve el evento. Se cambia el modo y se ve el cambio.
   5. **Corte y vuelta:** se desconecta el enlace 10 minutos. Debe aparecer la alerta de silencio y, al volver, el buffer se vacía sin huecos.
3. **`verificar-sitio.js`** automatiza lo que no necesita ojos. Comprueba que:
   - llegaron todos los puntos del perfil, o están declarados sin dato;
   - los valores caen en los rangos de la placa;
   - el desfase de reloj es menor que 5 segundos;
   - la coherencia entre variables se cumple;
   - el retraso está dentro del objetivo.

   Con eso genera el acta en `docs/actas/` y deja en blanco la tabla punto a punto, para llenarla en terreno.
4. **El acta guarda:** la fecha, las personas, el firmware de cada controlador, la versión del perfil, la tabla punto a punto, las pruebas de alarma y de corte, lo pendiente con su responsable y los valores normales del equipo. Esa es la línea base para comparar más adelante.
5. **`baja-de-equipo.md`:** marcar el equipo como inactivo, revocar el certificado de su gateway, quitar su sección de la ACL, decidir qué pasa con sus datos según la retención y registrarlo.

**Verifica**
- Da de alta un sitio `pruebas-2` con dos equipos del simulador, usando solo el procedimiento y los scripts, sin SQL a mano.
- Inyecta `unidad_mal` antes de la verificación: el punto a punto o la coherencia la detectan, y el acta queda con una observación.
- Da de baja un equipo: su gateway ya no puede publicar, y su historial sigue consultable.

**Hacer y no hacer**

| Hacer | No hacer | Por qué |
|---|---|---|
| Comparar cada señal con la pantalla del controlador | Confiar en el manual | El firmware instalado no siempre es el del manual |
| Anotar el firmware y la versión del perfil en el acta | Dejar "funciona" como única evidencia | Cuando un dato se vea raro en un año, querrás saber con qué mapa se leyó |
| Dejar los pendientes escritos, con responsable | Entrar en operación con señales "por revisar" | Lo que no se revisa el primer día no se revisa |
| Probar el corte del enlace antes de irte | Suponer que el buffer funciona | Es la única prueba que no puedes hacer desde la oficina |
| Coordinar con la operación del sitio | Conectarte a un controlador en servicio sin avisar | Un sondeo mal configurado puede molestar a un equipo que está generando |

**La dominas si…**
- [ ] Explicas la diferencia entre FAT y SAT aplicada a un sitio de telemetría.
- [ ] Das de alta y de baja un sitio sin escribir SQL.
- [ ] Explicas qué problemas de datos se evitan en la puesta en servicio.

**Pregunta de entrevista.** *"¿Cómo incorporas un sitio nuevo?"* Con un procedimiento. Antes de viajar, pruebo el perfil del controlador contra un simulador. En sitio, compruebo la conexión y el reloj, y hago el punto a punto: cada señal de la plataforma contra la pantalla del controlador. Pruebo las alarmas y un corte del enlace. Todo queda en un acta con el firmware, la versión del perfil y los pendientes. Así, los errores de unidad o de escala se encuentran el primer día.

**Simulacros que habilita:** "el sitio nuevo muestra valores raros desde el primer día".

**Cierre:** `feat(sitios): alta por script, verificación automática y acta de puesta en servicio` · tag `fase-29`.

---

## Fase 30 · Traspaso: que otra persona pueda operarlo

**Objetivo:** que alguien que no estuvo en el proyecto pueda operar, diagnosticar y cambiar el sistema con lo que está escrito.
**Tu tiempo:** 2 horas.
**Depende de:** las fases que hayas hecho.

**La idea.** Es la carpeta de entrega de un proyecto: planos *as built*, listas, manuales y protocolos. Un sistema que depende de la memoria de una persona se cae el día que esa persona se enferma.

**Construyes:** `docs/GUIA.md`, `docs/COMO-ABORDAR.md` y `docs/README.md` al día, `docs/operacion/calendario.md`, `docs/operacion/responsables.md` y `docs/lista-de-produccion.md`.

**Pasos**

1. **Guía y diagramas.** Actualiza `docs/GUIA.md` con la arquitectura de la Parte 2: zonas, perfiles, calidad, eventos y observabilidad. Un diagrama de contexto y uno de contenedores, en Mermaid. Actualiza también los cinco mapas de `docs/COMO-ABORDAR.md`: lo que decía "Fase N" ahora existe.
2. **Calendario de operación:**

   | Cada cuánto | Qué se revisa |
   |---|---|
   | Día | Alertas abiertas, equipos en silencio y cuarentena |
   | Semana | Indicadores de calidad por equipo, actualizaciones pendientes y un simulacro |
   | Mes | Restauración de prueba, particiones, vencimiento de certificados, capacidad contra lo calculado y presupuesto de error |
   | Año | Rotación de secretos, revisión de accesos y del modelo de amenazas |

3. **Responsables.** Una tabla que diga, para cada pieza, quién es el dueño, quién la opera y a quién se llama: la red del sitio, el controlador, el gateway, el enlace, el broker, la plataforma, el front y los datos. En un sistema OT/TI, la mitad de los incidentes se alargan por no saber de quién es el problema.
4. **Lista de producción.** Una auditoría final con una línea por control. Cada ítem dice "sí, con evidencia" o "no, porque…":
   - los respaldos probados y la restauración medida;
   - una alerta por cada falla conocida;
   - un procedimiento por cada alerta;
   - los secretos fuera del repositorio;
   - los puertos cerrados;
   - las migraciones al día;
   - el contrato publicado;
   - los objetivos definidos;
   - la capacidad calculada.
5. **Decisiones.** Completa `docs/decisiones.md` con las de la Parte 2: banderas de calidad, perfiles como datos, correcciones como capa, eventos derivados por la hora del dato, diario local antes de confirmar y TLS mutuo.
6. **Presentación.** Explica el sistema completo en 5 minutos a alguien que no lo conoce, y anota qué preguntó. Lo que preguntó es lo que le falta a la guía.

**Verifica**
- La lista de producción no tiene ítems sin respuesta.
- Con solo `docs/`, puedes responder: ¿cómo se da de alta un sitio?, ¿qué hago si llega `RespaldoAntiguo`?, ¿qué significa calidad 8?
- `docs/README.md` lista todos los documentos, y la auditoría de documentación (Prompt 14) no encuentra contradicciones con el código.
- Los mapas de `docs/COMO-ABORDAR.md` describen el sistema tal como quedó, sin las marcas de "Fase N" pendientes.

**La dominas si…**
- [ ] Presentas el sistema en 5 minutos con un diagrama.
- [ ] Explicas, para tres fallas distintas, quién es el responsable y por qué.

**Pregunta de entrevista.** *"Si mañana no estás, ¿quién opera esto?"* Cualquiera con la documentación: la guía con la arquitectura, un procedimiento por alerta, el calendario de rutinas, la tabla de responsables y la lista de producción con la evidencia de cada control. Los simulacros registrados muestran que los procedimientos se probaron.

**Cierre:** `docs: traspaso, calendario de operación y lista de producción` · tag `v2.0.0`.

---

## Ejercicios a mano

Igual que en la Parte 1: de 10 a 20 minutos cada uno, sin mirar el código. Entre paréntesis va el resultado, cuando lo hay.

| Fase | Ejercicio 1 | Ejercicio 2 |
|---|---|---|
| 15 | Escribe de memoria el método de seis pasos y aplícalo a un caso inventado | Redacta en una página el postmortem de un simulacro |
| 16 | Escribe una migración que agregue una columna con `ALGORITHM=INSTANT` y su `GRANT` | Explica por escrito qué pasa si editas una migración ya aplicada |
| 17 | Escribe el perfil de un controlador inventado con cinco puntos, uno de 32 bits | Convierte 75 psi y 200 °F (517,1 kPa y 93,33 °C) |
| 18 | Calcula una vuelta de sondeo: 8 equipos, 40 registros y 19.200 baudios (93 bytes, 53 ms por consulta y 0,43 s por vuelta) | Decodifica la trama GAAC `90 01 E6 00 00 1E 20 03` (400 V, 230 V, 60 Hz y 800 A) |
| 19 | Asigna los bits de calidad a diez lecturas que inventes | Escribe la fórmula del desfase de reloj y resuelve un caso con un mensaje que esperó una hora en el buffer |
| 20 | Calcula los incrementos de un contador de 16 bits: 65.500 → 65.530 → 10 → 40 → 5 → 25 (30, 16, 30, reinicio con 5, y 20) | Escribe en SQL la detección de huecos de más de un minuto |
| 21 | Arma una trama DM1: SPN 190, FMI 0, 2 ocurrencias y lámpara roja (`10 FF BE 00 00 02 FF FF`) | Calcula el factor de carga y el consumo específico de un arranque que inventes |
| 22 | Escribe el esquema de respuesta de `/flota` para un equipo | Elige la resolución para 45 días con 1.500 puntos como máximo (`1h`, 1.080 puntos) |
| 23 | Escribe una regla de alerta con su condición, su duración y su gravedad | Calcula el presupuesto de error mensual de un 99,9 % (43 minutos) |
| 24 | Escribe sin mirar los pasos de una recuperación a un punto en el tiempo | En un listado de binlog, marca dónde te detienes y dónde retomas |
| 25 | Llena la plantilla de cambio para "agregar una columna a `motores`" | Escribe de memoria los pasos del CI |
| 26 | Calcula filas y disco para 120 equipos, 30 variables y 15 s (20,7 millones por día, 1,95 GB por día y 58,5 GB al mes) | Dibuja la cadena de contrapresión con sus topes |
| 27 | Dibuja los niveles de Purdue, con una pieza de tu sistema en cada uno | Escribe los comandos de openssl para una CA y un certificado de cliente |
| 28 | Escribe las cinco comprobaciones del gateway antes de ejecutar un comando | Explica por qué un comando no puede ser un mensaje retenido |
| 29 | Escribe de memoria las cinco etapas de la puesta en servicio | Llena el acta punto a punto de un equipo simulado |
| 30 | Presenta el sistema en 5 minutos, con el diagrama | Explica a alguien no técnico qué garantiza la plataforma y qué no |

## Lo que este proyecto no te puede dar

| Lo que falta | Por qué importa | Cómo acercarte |
|---|---|---|
| Equipos reales | Los controladores tardan en responder, traen firmware distinto al del manual y mapas que no calzan | Consigue el manual de comunicaciones de los controladores que uses en el trabajo y escribe su perfil. Si hay un controlador de banco, practica ahí |
| Código heredado | El sistema real ya existe y lo escribió otra persona. Mantener es, sobre todo, leer | Usa `simulacro de código` y `revisa mi cambio`. Con el repositorio real, aplica el mismo orden de lectura: el dato de punta a punta, primero |
| Presión real | Con un cliente esperando se piensa distinto | Simulacros con cronómetro y con la ficha escrita |
| La organización | Quién aprueba, a quién se llama y qué se puede tocar no está en ningún repositorio | Las preguntas de las primeras semanas, en `docs/OT-TI.md` |
| Escala y tiempo | Un año de datos y cien sitios muestran problemas que una semana simulada no muestra | La prueba de carga y el cálculo de capacidad de la Fase 26 |

## Problemas comunes de la Parte 2

| Síntoma | Causa probable | Arreglo |
|---|---|---|
| `ER_TABLEACCESS_DENIED_ERROR` después de una migración | La migración creó una tabla sin su `GRANT` | Agrégalo en una migración nueva |
| `migrar` se detiene por un checksum distinto | Alguien editó una migración ya aplicada | Devuelve el archivo a su versión (`git checkout`) y escribe otra migración |
| `openssl ... -subj` falla con una ruta `C:/Program Files/Git/...` | Git Bash convirtió `/CN=...` en una ruta | `MSYS_NO_PATHCONV=1` o `//CN=...` |
| El cliente MQTT dice `self-signed certificate in certificate chain` | No se le pasó la CA del laboratorio | Entrégale `ca` y deja `rejectUnauthorized: true` |
| `Hostname/IP does not match certificate's altnames` | El certificado del broker no trae el nombre con que te conectas | Emítelo con `mosquitto` y `localhost` |
| El objetivo `api` aparece caído en Prometheus | Están en redes distintas, o `/metrics` escucha en otro puerto | Revisa `METRICAS_PUERTO` y las redes de Compose |
| Con la confirmación después de guardar, la ingesta procesa un mensaje por segundo o el cliente MQTT se desconecta | `handleMessage` espera al lote de MySQL, y mqtt.js no lee el siguiente paquete hasta que responde | Responde en cuanto el mensaje queda en el diario local (Fase 26, paso 7) |
| `mysqlbinlog: command not found` | La imagen no trae la herramienta | Úsala desde un contenedor auxiliar |
| El lote marca todo como "pegado" | Con banda muerta solo llegan latidos iguales | Aplica la regla solo con el motor en marcha y sobre varios latidos |
| En el CI, `docker compose exec` falla con `the input device is not a TTY` | Falta `-T` | Agrega `-T` |
| El CI no encuentra `.env` | No está en el repositorio, y así debe ser | Genera uno en el flujo, con valores al azar |
