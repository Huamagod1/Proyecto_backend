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

## Palabras clave durante el trabajo

| Escribes | El agente |
|---|---|
| `implementa` | Hace el siguiente paso: lo explica en 3 a 5 líneas, lo programa comentado, lo verifica y te deja el bloque Para estudiar |
| `implementa la fase` | Hace todos los pasos de la fase seguidos, verificando cada uno |
| `explica <archivo, función o línea>` | Te lo explica de lo general a lo particular |
| `por qué <algo>` | Te da la razón, las alternativas y qué pasaría si no se hiciera así |
| `pregúntame` | Te hace 3 preguntas de entrevista sobre lo último y evalúa tus respuestas |
| `ejercicio` | Te da un ejercicio a mano de 10 a 20 minutos, sin la solución hasta que la pidas |
| `cierra la fase` | Escribe el apunte de la fase, actualiza tu avance y propone el commit y el tag |
