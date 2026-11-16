# AGENTS.md · Telemetría de motores (proyecto de aprendizaje)

Instrucciones para el agente de código (Codex o Claude Code).

## Contexto
- Soy Fernando. Me preparo para un cargo de Back-end Developer de datos industriales: Node.js, Express, MySQL y SQLite, JWT y roles, MQTT, WebSocket, Modbus y CAN, Node-RED, Docker, Linux y Git.
- Vengo de la automatización industrial (PLC, SCADA, Modbus, PI System) y trabajo con Python y SQL Server. En JavaScript backend estoy aprendiendo.
- Tengo poco tiempo para escribir código: **tú lo escribes y yo aprendo leyéndolo, ejecutándolo y explicándolo.** Después haré ejercicios a mano.
- El plan está en `PLAN.md`: lee solo la fase en curso. Mi avance queda en `PROGRESO.md`.
- Entorno: Windows con WSL2 (Ubuntu 24.04), VS Code, Docker Desktop, Node LTS, y Git con GitHub por SSH.
- Solución de referencia: `../lab-telemetria-motores/`. Apóyate en ella para no reinventar, pero el código de este repositorio sigue este archivo.

## Cómo trabajamos cada paso
1. Antes de escribir, dime en el chat, en 3 a 5 líneas, qué vas a construir, en qué archivos y una analogía que lo explique (industrial o de mis proyectos: FlowSense, el bot de IDOK, Teamwork).
2. Implementa el paso como lo especifica `PLAN.md`: firmas, comportamiento y casos borde. Si te apartas del plan, di por qué.
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
1. Escribe `docs/apuntes/fase-NN.md`, de una página como máximo, en Markdown que se pueda importar a Notion:
   - **Mapa:** el flujo de la fase en 3 a 6 líneas.
   - **Conceptos:** una línea cada uno.
   - **Decisiones:** decisión → por qué.
   - **Comandos para saber de memoria.**
   - **Preguntas de entrevista**, con respuestas de 2 a 3 líneas.
   - **Dos ejercicios a mano**, tomados de la sección "Ejercicios a mano" de `PLAN.md`.
2. Actualiza `PROGRESO.md` (fecha, fase, qué se hizo y dudas abiertas) y marca las casillas de `PLAN.md`.
3. Propón el mensaje de commit (Conventional Commits, en español) y el tag. El flujo de Git lo hago yo.

## Palabras clave
| Escribo | Haces |
|---|---|
| `implementa` | El siguiente paso de la fase, con el ciclo completo de "Cómo trabajamos cada paso" |
| `implementa la fase` | Todos los pasos de la fase seguidos, verificando cada uno, con un solo bloque Para estudiar al final |
| `explica <archivo, función o línea>` | Una explicación en el chat, de lo general a lo particular, sin repetir lo que ya dicen los comentarios |
| `por qué <algo>` | La razón, las alternativas y qué pasaría si no se hiciera así |
| `pregúntame` | 3 preguntas de entrevista sobre lo último, una a la vez, evaluando cada respuesta: qué faltó y cómo decirlo en 30 segundos |
| `ejercicio` | Un ejercicio a mano de 10 a 20 minutos sobre lo último, sin la solución hasta que la pida |
| `cierra la fase` | Los tres puntos de "Al cerrar cada fase" |

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
  - instalar paquetes del sistema;
  - `git push` o `git reset --hard`.
- Nunca pongas secretos en el código ni en un commit. Van en `.env`, que Git ignora; `.env.example` se mantiene al día sin valores reales.
- Si una versión, un comando o una API del plan quedó desactualizado, avísame y propone el ajuste antes de seguir.
