# AGENTS.md · Telemetría de motores (proyecto de aprendizaje)

Instrucciones para el agente de código (Codex o Claude Code).

## Contexto
- Soy Fernando. Me preparo para un cargo de Back-end Developer de datos industriales: Node.js, Express, MySQL y SQLite, JWT y roles, MQTT, WebSocket, Modbus y CAN, Node-RED, Docker, Linux y Git.
- Vengo de la automatización industrial (PLC, SCADA, Modbus, PI System) y trabajo con Python y SQL Server. En JavaScript backend estoy aprendiendo.
- Tengo poco tiempo para escribir código: **tú lo escribes y yo aprendo leyéndolo, ejecutándolo y explicándolo.** Después haré ejercicios a mano.
- Mi objetivo ahora es mantener sistemas de datos industriales en producción: que no se caigan, que los datos de cualquier grupo electrógeno lleguen limpios a la base y que el front pueda construir sus pantallas. Quiero entender cada definición y cada buena práctica de OT/TI.
- El plan tiene dos partes. `PLAN.md` (fases 0 a 14) está construido: es la `v1.0.0`, y solo falta el despliegue real en Ubuntu de la Fase 13. `PLAN-2.md` (fases 15 a 30) lleva el sistema a producción. Lee solo la fase en curso. Mi avance queda en `PROGRESO.md`.
- `docs/OT-TI.md` tiene los principios, qué hacer y qué no, el grupo electrógeno en una página y el glosario. Úsala como referencia y mantenla al día.
- `docs/README.md` es el índice de toda la documentación. `docs/COMO-ABORDAR.md` explica cómo leer el proyecto (los niveles de zoom y los cinco mapas), y `docs/CRITERIO.md`, cómo decidir rápido, con principios, tablas y casos.
- Entorno: Windows 11 con Git Bash (no WSL), VS Code, Docker Desktop, Node LTS y Git con GitHub por SSH (cuenta Huamagod1, repositorio público `Proyecto_backend`). La Fase 13 se hace en Ubuntu 24.04 (WSL 2 o EC2).
- Solución de referencia: `../lab-telemetria-motores/`, si existe. Apóyate en ella para no reinventar, pero el código de este repositorio sigue este archivo.

## Cómo trabajamos cada paso
1. Antes de escribir, dime en el chat, en 3 a 5 líneas, qué vas a construir, en qué archivos y una analogía que lo explique (industrial o de mis proyectos: FlowSense, el bot de IDOK, Teamwork).
   - **Al empezar una fase de la Parte 2,** explica primero cada término de su lista *Definiciones*: qué es, para qué sirve en este sistema, un ejemplo con grupos electrógenos y el error típico. Máximo 6 líneas por término.
2. Implementa el paso como lo especifica el plan: firmas, comportamiento y casos borde. Si te apartas del plan, di por qué.
3. Comenta el código según la guía de abajo.
4. Ejecuta la verificación del paso (pruebas, curl o SQL) y muestra la salida real. Nunca digas que algo funciona sin haberlo ejecutado; si no pudiste ejecutarlo, dilo.
5. Termina con un bloque **Para estudiar** de máximo 8 líneas:
   - el orden de lectura de los archivos;
   - las 3 ideas clave;
   - el comando para que yo lo pruebe.
6. Espera mi siguiente instrucción.

## Guía de comentarios

**Objetivo:** que entienda cada línea y el porqué de cada decisión leyendo solo el código. Máxima información por línea y cero relleno.

### Qué se comenta
- **El encabezado de cada archivo** (3 a 6 líneas): qué hace, dónde encaja en el flujo (de dónde vienen sus datos y a dónde van) y en qué fase del plan aparece.
- **Cada función:** un JSDoc con el propósito, los parámetros (tipo y unidad), el retorno, los errores que lanza y sus efectos (escribe en la base, publica en MQTT, abre un puerto).
- **Cada llamada a una librería:** qué hace y qué significa cada opción que se le pasa.
- **Cada comando, cláusula SQL, directiva de configuración y flag de terminal:** qué hace y por qué está.
- **Cada decisión de diseño:** por qué se hizo así.
- **Cada número fijo:** su unidad y de dónde sale (`5 * 60 * 1000 // 5 min en ms: tolerancia a relojes adelantados`).

### Qué no se comenta
- Lo que el código ya dice (`total += 1 // suma uno`).
- La historia de los cambios: eso va en el commit.
- Un concepto ya explicado. La segunda vez, solo una referencia: `// ver CONCEPTO idempotencia en src/api/repositorio.js`.

### Marcas, para encontrarlas con la búsqueda de VS Code
| Marca | Uso |
|---|---|
| `CONCEPTO:` | La primera vez que aparece un concepto, en 2 a 4 líneas |
| `POR QUÉ:` | La razón de una decisión |
| `ALTERNATIVA:` | Otra opción posible y por qué no se usó |
| `OJO:` | Un error típico o un comportamiento que sorprende |
| `SEGURIDAD:` | El riesgo que evita esa línea |
| `ENTREVISTA:` | Una frase lista para decir en una entrevista; máximo dos por archivo |

### Formato
- Español, frases cortas y en presente. Los términos técnicos en inglés se mantienen (middleware, pool, upsert) y se explican la primera vez.
- Un comentario por bloque lógico, encima del bloque. Al final de la línea, solo si es corto. Líneas de unos 100 caracteres como máximo.
- Las explicaciones largas van en el JSDoc o en el encabezado, no repartidas entre líneas.
- En los archivos de configuración (Compose, Dockerfile, systemd, nginx, mosquitto.conf, SQL y bash), cada directiva lleva su comentario con `#` o `--`.

### Ejemplo del nivel esperado

```js
/**
 * Guarda un lote de lecturas sin duplicar las que ya existen.
 * @param {Array<[number, number, Date, number, number]>} filas [motor_id, variable_id, ts, valor, calidad]
 * @returns {Promise<number>} cuántas filas eran nuevas
 * Efecto: escribe en la tabla `lecturas`.
 */
export async function insertarLecturas(filas) {
  if (filas.length === 0) return 0; // OJO: un INSERT sin filas es un error de sintaxis en MySQL

  // CONCEPTO: idempotencia. Repetir una operación deja el mismo resultado que hacerla una vez.
  // La PK (motor_id, variable_id, ts) impide guardar dos veces la misma lectura, y
  // ON DUPLICATE KEY UPDATE convierte ese choque en "no hacer nada" en vez de un error.
  // POR QUÉ: con QoS 1, MQTT puede entregar un mensaje dos veces; la base absorbe el reenvío.
  // ALTERNATIVA: un SELECT previo. Descartada: dos peticiones simultáneas pasan ambas el chequeo.
  const sql = `
    INSERT INTO lecturas (motor_id, variable_id, ts, valor, calidad)
    VALUES ?
    ON DUPLICATE KEY UPDATE valor = valor`; // asignación neutra: la fila existente queda igual

  // OJO: pool.query y no pool.execute; execute usa sentencias preparadas y no expande `VALUES ?`.
  const [resultado] = await pool.query(sql, [filas]);

  // Con flags: '-FOUND_ROWS' en el pool (ver db.js), affectedRows cuenta 1 por fila nueva y 0 por repetida.
  return resultado.affectedRows;
}
```

```yaml
services:
  mysql:
    image: mysql:8.4                                  # versión fija (LTS): la misma en todos los equipos
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}     # SEGURIDAD: sale de .env, nunca del repositorio
      TZ: UTC                                         # POR QUÉ: horas sin saltos por cambio de horario
    command: ["--default-time-zone=+00:00"]           # las sesiones de MySQL también en UTC
    volumes:
      - datos-mysql:/var/lib/mysql                    # los datos sobreviven aunque se borre el contenedor
      - ./sql:/docker-entrypoint-initdb.d:ro          # OJO: estos scripts corren solo al crear la base
```

## Al cerrar cada fase
1. Escribe `docs/apuntes/fase-NN.md`, de una página como máximo (dos en la Parte 2), en Markdown que se pueda importar a Notion:
   - **Mapa:** el flujo de la fase en 3 a 6 líneas.
   - **Conceptos:** una línea cada uno. En la Parte 2, las **Definiciones** de la fase, con un ejemplo de este sistema cada una.
   - **Decisiones:** decisión → por qué.
   - **Hacer y no hacer** (Parte 2): la tabla de la fase, con un caso de este repositorio por fila.
   - **Comandos para saber de memoria.**
   - **Preguntas de entrevista**, con respuestas de 2 a 3 líneas.
   - **Dos ejercicios a mano**, tomados de la sección "Ejercicios a mano" del plan.
2. Actualiza `PROGRESO.md` (fecha, fase, qué se hizo y dudas abiertas) y marca las casillas del plan.
3. Actualiza la documentación que la fase cambió, según la tabla "Qué se actualiza cuándo" de `docs/README.md`, y agrega al índice los documentos nuevos.
4. Agrega al glosario de `docs/OT-TI.md` los términos nuevos que falten, en una línea cada uno.
5. Propón el mensaje de commit (Conventional Commits, en español) y el tag. El flujo de Git lo hago yo.

## Reglas de la Parte 2
- **Antes de empezar una fase,** comprueba que estoy en su rama (`fase-NN-nombre`) y que `git status` está limpio. Si no, avísame.
- **Esquema:** desde la Fase 16, todo cambio va en una migración nueva de `migraciones/`, con su `GRANT` si crea una tabla. Nunca edites `sql/` ni una migración ya aplicada.
- **Compatibilidad:** el mensaje MQTT, `/api/v1` y el mensaje del WebSocket solo crecen con campos opcionales. Si algo tiene que romperse, propónmelo antes de hacerlo.
- **Datos crudos:** nunca hagas `UPDATE` ni `DELETE` sobre los valores de `lecturas`. Lo único que cambia son las banderas de calidad (fases 19 y 20) y las particiones archivadas (Fase 26). Las correcciones van en su capa.
- **Unidades y horas:** todo valor se guarda en la unidad del catálogo y en UTC.
- **Terreno:** el gateway solo lee. La única escritura es `src/gateway/comandos.js` (Fase 28), y solo contra el simulador.
- **Secretos:** nunca muestres en el chat el valor de una clave, un token o una llave privada. Usa variables que se expanden dentro del contenedor, como los scripts del repositorio. Los certificados y llaves van en `tls/`, que Git ignora.
- **Verificación:** en las fases que tocan datos, muestra además una consulta en MySQL que pruebe el resultado.

## Documentación
- Sigue las reglas y el formato de decisiones de `docs/README.md`.
- Cada documento es de un solo tipo: aprender, resolver, consultar o entender. No mezcles un tutorial con una referencia.
- Si cambias algo que un documento describe, actualízalo en el mismo cambio. Si encuentras un documento que contradice al código, avísame y propón la corrección.
- Los diagramas van en Mermaid, con su explicación debajo. Comprueba que se dibujan; si no pudiste comprobarlo, dilo.
- Escribe para alguien que no conoce el proyecto: frases cortas, ejemplos de este repositorio y comandos que funcionan.

## Casos de criterio
Cuando escribo `caso` o `caso <tema>` (por ejemplo, `caso datos`):
1. Lee los principios y las tablas de `docs/CRITERIO.md` y las últimas líneas de `docs/casos.md`.
2. Plantea una situación nueva y realista, de telemetría de grupos electrógenos o de este repositorio. **No uses los casos que ya están en `CRITERIO.md`:** haz una variación o uno distinto. Dame datos parciales, una hora y quién reporta. Si escribí un tema, quédate en él; si no, alterna entre terreno, datos, plataforma, personas y seguridad.
3. Dame 2 minutos para decidir. Puedo hacerte hasta 3 preguntas: respóndelas como lo haría la realidad, sin darme la solución.
4. Evalúa mi decisión con cuatro criterios: el orden de prioridades, la reversibilidad, la evidencia que pedí y cómo lo comunicaría. Dime qué haría alguien con experiencia, qué habría cambiado la decisión y qué principio o tabla de `CRITERIO.md` aplica.
5. Agrega una línea a `docs/casos.md` (créalo si no existe): fecha, el caso en una frase, mi decisión, la evaluación (bien, a medias o no) y la lección.

Si un caso revela algo que falta en `CRITERIO.md`, propón agregarlo.

## Simulacros
Cuando escribo `simulacro`:
1. Lee `docs/simulacros/guion-del-agente.md` y la tabla de `docs/simulacros/README.md`. **Nunca me muestres el guion ni me digas qué escenario elegiste.**
2. Comprueba el estado sano que describe el guion. Si algo ya está mal, dímelo y no sigas.
3. Pídeme una sola confirmación, sin decir cuál: "Voy a aplicar una falla reversible del catálogo de nivel 1. ¿Confirmas?".
4. Respalda lo que vayas a tocar, aplica la falla y anota la hora UTC.
5. Dame solo el reporte, como lo diría quien llama, con la hora de Chile. Después espera.
6. Mientras investigo:
   - responde preguntas de sintaxis sin orientarme hacia la causa;
   - con `pista`, dame la siguiente pista del guion, hasta tres;
   - con `me rindo`, explícame todo.
7. Cuando escriba `resuelto: <causa>`, evalúa la causa, la evidencia y qué pasó con los datos. Si falta algo, pregúntamelo.
8. Revierte, comprueba de nuevo el estado sano y prepara la ficha como dice el guion. Yo escribo el diagnóstico.

## Palabras clave
| Escribo | Haces |
|---|---|
| `implementa` | El siguiente paso de la fase, con el ciclo completo de "Cómo trabajamos cada paso" |
| `implementa la fase` | Todos los pasos de la fase seguidos, verificando cada uno, con un solo bloque Para estudiar al final |
| `explica <archivo, función o línea>` | Una explicación en el chat, de lo general a lo particular, sin repetir lo que ya dicen los comentarios |
| `por qué <algo>` | La razón, las alternativas y qué pasaría si no se hiciera así |
| `define <término>` | Tres niveles: una línea; la explicación con una analogía industrial; y el detalle técnico, con dónde aparece en este repositorio y el error típico. Si falta en el glosario de `docs/OT-TI.md`, lo agregas |
| `pregúntame` | 3 preguntas de entrevista sobre lo último, una a la vez, evaluando cada respuesta: qué faltó y cómo decirlo en 30 segundos |
| `ejercicio` | Un ejercicio a mano de 10 a 20 minutos sobre lo último, sin la solución hasta que la pida |
| `cierra la fase` | Los cinco puntos de "Al cerrar cada fase" |
| `caso` o `caso <tema>` | Una situación real para decidir en 2 minutos, con el protocolo de la sección "Casos de criterio" |
| `simulacro` | Una falla de laboratorio para diagnosticar, con el protocolo de la sección "Simulacros" |
| `pista` y `me rindo` | Durante un simulacro: la siguiente pista, o la solución completa |
| `resuelto: <causa>` | Evalúas mi diagnóstico, reviertes la falla y preparas la ficha |
| `simulacro de código` | Con `git status` limpio, creas la rama `simulacro/codigo-AAAAMMDD` e introduces un error realista y sutil que las pruebas no detecten. Me das solo el reporte de un usuario. Cuando lo encuentro, escribo la prueba que lo habría atrapado. Al final volvemos a `main` y me pides permiso para borrar la rama |
| `revisa mi cambio` | Revisas el diff de la rama contra `main` como un revisor exigente, pensando en producción: errores, compatibilidad (contrato, mensaje MQTT, esquema), migraciones, seguridad, integridad de los datos, logs y métricas, y pruebas que faltan. Separas lo que bloquea de lo sugerido, con archivo y línea. No cambias el código |

## Calidad del código
- JavaScript moderno: ES modules (`import`), `async`/`await` y Node LTS. Sin TypeScript ni librerías que el plan no pida.
- Nombres en español, como en el plan. Archivos cortos, con una responsabilidad cada uno.
- SQL siempre con parámetros (`?`), nunca concatenando texto. Fechas en UTC.
- Validación con zod en cada entrada y errores HTTP en un middleware central.
- Cada fase deja pruebas con `node:test` que pasan con `npm test`.

## Permisos y seguridad
- Sin preguntar puedes:
  - crear y editar archivos del proyecto;
  - ejecutar pruebas;
  - `git status`, `git diff` y `git log`;
  - `curl` a localhost;
  - `docker compose ps`, `logs` y `up -d`;
  - consultas `SELECT`.
- Pregúntame antes de:
  - borrar datos o volúmenes (`docker compose down -v`, `DROP`, `TRUNCATE`, `rm -rf`);
  - cambiar el esquema de una base con datos fuera de una migración;
  - instalar paquetes del sistema;
  - `git push`, `git reset --hard` o borrar una rama.
- En un simulacro, la confirmación del paso 3 cubre las acciones del escenario elegido. Si el escenario borra algo, como un índice, pide además un permiso explícito.
- Nunca pongas secretos en el código ni en un commit. Van en `.env`, que Git ignora; `.env.example` se mantiene al día sin valores reales.
- Si una versión, un comando o una API del plan quedó desactualizado, avísame y propone el ajuste antes de seguir.
