# Prompts para el agente (Codex o Claude Code)

## Antes de empezar

1. Termina la Fase 0 de `PLAN.md`.
2. La carpeta del proyecto ya existe con los cuatro archivos: `F:\1. Proyectos personales\Developer Apis\Detroit` (repositorio `Huamagod1/Proyecto_backend`).
   `AGENTS.md` tiene las reglas. Codex lo lee al iniciar, y `CLAUDE.md` lo importa para Claude Code.
3. Abre el agente en esa carpeta:
   - **Codex:** `codex`. Lee `AGENTS.md` al arrancar; si cambias el archivo, reinícialo.
   - **Claude Code:** `claude`. Con `/context` confirmas que cargó `CLAUDE.md` y `AGENTS.md`.
4. Pega el Prompt 1.

Al cambiar de fase, empieza una sesión nueva (en Claude Code, `/clear`): `AGENTS.md` y `PROGRESO.md` le devuelven el hilo al agente.

---

## Prompt 1 · Revisar el plan antes de empezar

```text
Lee AGENTS.md y PLAN.md completos. No escribas código todavía.
1. Verifica mi entorno solo con comandos de lectura: node -v, npm -v, git --version, docker compose version, ps -p 1 -o comm= y ls ../lab-telemetria-motores. Dime qué falta.
2. Revisa PLAN.md contra el cargo (Back-end Developer para Datos Industriales: Node.js, APIs, MySQL y SQLite, autenticación y roles, datos en tiempo real, servicios en Linux y Git; deseables: Express, Node-RED, WebSocket, Modbus TCP/IP, RS485, CAN, MQTT, SCADA/EMS, Docker y optimización SQL) y contra mi entorno. Dime qué versiones, comandos o APIs quedaron desactualizados y qué ajustarías.
3. Muéstrame los cambios que propones y espera mi aprobación antes de editar.
```

## Prompt 2 · Paso a paso (aprendes más)

```text
Vamos con la Fase N de PLAN.md. Lee solo esa sección y PROGRESO.md. Implementa el paso 1 siguiendo AGENTS.md: comentarios según la guía, verificación ejecutada y bloque "Para estudiar". Después espera.
```

Para cada paso siguiente, escribe `implementa`.

## Prompt 3 · Una fase completa (cuando tienes poco tiempo)

```text
Implementa la Fase N completa de PLAN.md siguiendo AGENTS.md: paso por paso y ejecutando la verificación de cada uno. Al final, un solo bloque "Para estudiar" con el orden de lectura de todos los archivos. Después, cierra la fase.
```

## Prompt 4 · Retomar otro día

```text
Lee PROGRESO.md y la fase actual de PLAN.md. Dime en tres líneas dónde quedé y cuál es el siguiente paso. Antes de seguir, hazme dos preguntas rápidas sobre lo último que hicimos.
```

## Prompt 5 · Revisar los comentarios de un archivo

```text
Revisa los comentarios de <archivo> contra la guía de AGENTS.md: quita el relleno y agrega lo que falte (opciones de librerías, decisiones, errores típicos), sin cambiar la lógica. Muéstrame el diff.
```

## Prompt 6 · Simulacro de entrevista con tu proyecto

```text
Actúa como el jefe de proyectos de microrredes que me entrevista para el cargo de Back-end Developer de Datos Industriales. Revisa el repositorio y hazme 6 preguntas técnicas sobre lo construido, de menor a mayor dificultad, una a la vez. Después de cada respuesta, dime qué faltó y cómo decirlo mejor en 30 segundos.
```

---

# Parte 2 · De laboratorio a producción

## Antes de empezar la Parte 2

1. Copia los archivos:
   - en la raíz del repositorio, `PLAN-2.md`, `AGENTS.md` y `PROMPTS.md` (estos dos reemplazan a los anteriores);
   - en `docs/`, `README.md`, `COMO-ABORDAR.md`, `CRITERIO.md` y `OT-TI.md`;
   - en `docs/simulacros/`, `guion-del-agente.md`. **No lo abras:** trae las respuestas de los simulacros.
2. Haz el commit tú: `docs: plan de la Parte 2, guías de lectura, criterio y OT/TI, y guion de simulacros`.
3. Crea la rama de la primera fase: `git switch -c fase-15-simulacros`.
4. Abre una sesión nueva del agente y pega el Prompt 7.

## Prompt 7 · Revisar la Parte 2 contra el repositorio

```text
Lee AGENTS.md, PLAN-2.md (completo), docs/README.md, docs/COMO-ABORDAR.md y docs/OT-TI.md. No escribas código todavía.
1. Contrasta la tabla "Punto de partida" de PLAN-2.md y los mapas de COMO-ABORDAR.md con el código real: dime si algo ya está hecho, si algo falta o si algún archivo cambió de nombre.
2. Revisa las versiones, comandos y APIs de la Parte 2 contra mi entorno (Windows con Git Bash, Docker Desktop, Node 26, MySQL 8.4, Mosquitto 2.1) y dime qué ajustarías.
3. Agrega al README de la raíz una sección "Documentación" que enlace a docs/README.md, PLAN-2.md, docs/COMO-ABORDAR.md, docs/CRITERIO.md y docs/OT-TI.md.
Muéstrame los cambios que propones y espera mi aprobación antes de editar.
```

## Prompt 8 · Empezar una fase de la Parte 2

```text
Vamos con la Fase N de PLAN-2.md. Lee solo esa sección, PROGRESO.md y la parte de docs/OT-TI.md que le corresponde. Primero explícame las Definiciones de la fase, como dice AGENTS.md. Después implementa el paso 1 y espera.
```

Para cada paso siguiente, `implementa`. Si tienes poco tiempo, usa el Prompt 3 con `PLAN-2.md`.

## Prompt 9 · Simulacro

Con la plataforma completa levantada (`docker compose --profile completo up -d`) y el dashboard abierto con tu sesión iniciada:

```text
simulacro
```

Durante el simulacro: `pista`, `me rindo` o `resuelto: <tu diagnóstico>`. Deja otra terminal abierta para investigar tú.

## Prompt 10 · Simulacro de entrevista de operación

```text
Actúa como el jefe de proyectos de microrredes. Haz de cuenta que estoy a cargo de mantener la plataforma de telemetría. Hazme 6 preguntas de operación y calidad de datos sobre este repositorio, de menor a mayor dificultad, una a la vez: una falla en terreno, un dato sospechoso, un cambio de esquema, un pedido del front, un incidente de seguridad y una decisión de capacidad. Después de cada respuesta, dime qué faltó y cómo decirlo en 30 segundos.
```

## Prompt 11 · Leer código como si fuera heredado

```text
Haz de cuenta que este repositorio lo escribió otra persona y me lo acaban de entregar. Guíame con el orden de lectura de docs/COMO-ABORDAR.md (sección 3.1): un paso por sesión. En cada paso, dame los archivos y tres preguntas que yo deba responder leyéndolos. No me des las respuestas hasta que te las diga, y después corrígeme.
```

## Prompt 12 · Entrenar el criterio

```text
caso
```

O tres seguidos, de temas distintos:

```text
Hazme tres casos seguidos, uno a la vez, siguiendo la sección "Casos de criterio" de AGENTS.md: uno de terreno, uno de datos y uno de plataforma. Al final, dime cuál de los principios de docs/CRITERIO.md me cuesta más.
```

## Prompt 13 · Dibujar los cinco mapas

```text
Sin que yo mire docs/COMO-ABORDAR.md, hazme reconstruir el mapa del estado (dónde espera un dato y qué lo destruye) con preguntas, una a la vez. Cuando lo tenga completo, compáralo con el documento y dime qué me faltó.
```

Cambia "el mapa del estado" por cualquiera de los cinco: el camino del dato, los contratos, las fallas o las personas.

## Prompt 14 · Auditar la documentación

```text
Revisa la documentación contra el código, sin editar nada:
1. Documentos de docs/README.md que no existen, o que existen y no están en el índice.
2. Afirmaciones que contradicen al código: nombres de archivos, comandos, topes, puertos y variables.
3. Términos que se usan y no están en ningún glosario.
4. Diagramas que ya no coinciden con la arquitectura.
Dame una lista ordenada por importancia, con archivo y línea, y espera mi aprobación antes de corregir.
```

---

## Palabras clave durante el trabajo

| Escribes | El agente |
|---|---|
| `implementa` | Hace el siguiente paso: lo explica en 3 a 5 líneas, lo programa comentado, lo verifica y te deja el bloque Para estudiar |
| `implementa la fase` | Hace todos los pasos de la fase seguidos, verificando cada uno |
| `explica <archivo, función o línea>` | Te lo explica de lo general a lo particular |
| `por qué <algo>` | Te da la razón, las alternativas y qué pasaría si no se hiciera así |
| `define <término>` | Te lo explica en tres niveles y lo agrega al glosario si falta |
| `pregúntame` | Te hace 3 preguntas de entrevista sobre lo último y evalúa tus respuestas |
| `ejercicio` | Te da un ejercicio a mano de 10 a 20 minutos, sin la solución hasta que la pidas |
| `cierra la fase` | Escribe el apunte de la fase, actualiza tu avance, la documentación y el glosario, y propone el commit y el tag |
| `caso` o `caso <tema>` | Te plantea una situación real para decidir en 2 minutos y evalúa tu criterio |
| `simulacro` | Rompe algo del laboratorio sin decirte qué, y tú lo diagnosticas |
| `pista`, `me rindo` y `resuelto: <causa>` | Durante un simulacro: una ayuda, la solución o la evaluación de tu diagnóstico |
| `simulacro de código` | Esconde un error en una rama aparte; tú lo encuentras leyendo el código y escribes la prueba que lo atrapa |
| `revisa mi cambio` | Revisa el diff de tu rama como un revisor exigente, pensando en producción, sin cambiar el código |
