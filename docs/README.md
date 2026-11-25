# Documentación del proyecto

Índice de toda la documentación de la plataforma de telemetría de motores: qué leer según lo que necesitas, qué documentos existen, cómo se escriben y cuándo se actualizan.

## Empieza aquí, según lo que necesitas

| Necesito… | Lee | Tiempo |
|---|---|---|
| Entender el proyecto desde cero | `docs/GUIA.md`, secciones 1 a 4 | 30 min |
| Saber cómo leerlo y estudiarlo sin perderme | `docs/COMO-ABORDAR.md` | 25 min |
| Decidir rápido en una situación nueva | `docs/CRITERIO.md`, la tarjeta de bolsillo | 5 min |
| Atender una alerta o una falla | `docs/RUNBOOK.md` | En el momento |
| Saber qué hacer y qué no en OT/TI | `docs/OT-TI.md` | 40 min |
| Entender por qué algo se hizo así | `docs/decisiones.md` | 15 min |
| Buscar un término | El glosario de `docs/GUIA.md` (sección 13) para la Parte 1, y el de `docs/OT-TI.md` (sección 9) para la Parte 2 y OT | 1 min |
| El formato de un mensaje MQTT | `docs/topicos.md` | 5 min |
| Construir pantallas (para el front) | `docs/api/` (Fase 22) y `docs/catalogo.md` (Fase 17) | 20 min |
| Cambiar el esquema de la base | `migraciones/` (Fase 16) y las reglas de `AGENTS.md` | 10 min |
| Repasar una fase | `docs/apuntes/fase-NN.md` | 10 min |
| Repasar con dibujos, una idea por diagrama | `docs/ATLAS-VISUAL.md` | 15 min |
| Ver en qué voy | `PROGRESO.md` | 2 min |

## Los cuatro tipos de documento

La documentación se separa según para qué se usa: es el marco Diátaxis. Mezclar los cuatro tipos en un mismo documento es la razón más común de que la documentación no se use.

| Tipo | Sirve para | Se lee | Aquí son |
|---|---|---|---|
| **Aprender** (tutoriales) | Adquirir una habilidad haciendo | Una vez, en orden | `PLAN.md`, `PLAN-2.md` y `docs/apuntes/` |
| **Resolver** (guías prácticas) | Lograr algo concreto, ahora | En el momento en que se necesita | `docs/RUNBOOK.md`, `docs/procedimientos/` y las fichas de `docs/simulacros/` |
| **Consultar** (referencia) | Buscar un dato exacto | A saltos | `docs/topicos.md`, `docs/j1939.md`, `docs/rs485.md`, `docs/catalogo.md`, `docs/api/`, `docs/rendimiento.md` y los glosarios |
| **Entender** (explicación) | Saber por qué las cosas son así | Con calma | `docs/GUIA.md`, `docs/OT-TI.md`, `docs/COMO-ABORDAR.md`, `docs/CRITERIO.md`, `docs/ATLAS-VISUAL.md` y `docs/decisiones.md` |

## Inventario

La columna **Estado** dice si el documento ya existe o en qué fase nace. Lo pendiente no se lee como hecho.

| Documento | Tipo | Responde a | Desde | Estado |
|---|---|---|---|---|
| `README.md` (raíz) | Resolver | ¿Cómo levanto y uso el sistema? | Parte 1 | existe |
| `PLAN.md` y `PLAN-2.md` | Aprender | ¿Qué construyo en cada fase, y cómo lo verifico? | Partes 1 y 2 | existe |
| `PROGRESO.md` | Consultar | ¿En qué voy, y qué dudas quedaron? | Parte 1 | existe |
| `AGENTS.md` y `PROMPTS.md` | Consultar | ¿Cómo trabaja el agente, y qué le pido? | Parte 1 | existe |
| `docs/GUIA.md` | Entender | ¿Cómo funciona todo, desde cero? | Parte 1 | existe |
| `docs/COMO-ABORDAR.md` | Entender | ¿Cómo leo y estudio un proyecto de este tamaño? | Parte 2 | existe |
| `docs/CRITERIO.md` | Entender | ¿Cómo decido rápido y bien? | Parte 2 | existe |
| `docs/OT-TI.md` | Entender | ¿Qué hacer y qué no en un ambiente industrial? | Parte 2 | existe |
| `docs/ATLAS-VISUAL.md` | Entender | ¿Cómo se ve cada idea del proyecto, en un dibujo? | Parte 2 | existe |
| `docs/decisiones.md` | Entender | ¿Por qué se hizo así? | Parte 1 | existe |
| `docs/RUNBOOK.md` | Resolver | ¿Qué hago cuando algo falla? | Parte 1 | existe |
| `docs/topicos.md`, `docs/j1939.md` y `docs/rs485.md` | Consultar | ¿Cómo son los mensajes y los protocolos? | Parte 1 | existe |
| `docs/rendimiento.md` | Consultar | ¿Cuánto tardan las consultas, antes y después? | Parte 1 | existe |
| `docs/MAPA-DEL-CARGO.md` | Consultar | ¿Qué pide el cargo, dónde lo construye el proyecto y cuánto lo domino? | Parte 2 | existe |
| `docs/apuntes/fase-NN.md` | Aprender | ¿Qué aprendí en cada fase? | Parte 1 | existe (fases 0 a 14) |
| `docs/simulacros/linea-base.md` | Consultar | ¿Cómo se ve el sistema sano? | Fase 15 | existe |
| `docs/simulacros/` | Resolver | ¿Qué fallas practiqué, y cómo las encontré? | Fase 15 | pendiente · Fase 15 (ya existe el guion del agente) |
| `docs/casos.md` | Consultar | ¿Qué decidí en cada `caso`, y qué aprendí? | Parte 2 | pendiente · primer `caso` |
| `docs/catalogo.md` | Consultar | ¿Qué variables existen, con qué unidad y qué rangos? | Fase 17 | pendiente · Fase 17 |
| `docs/calidad.md` | Entender | ¿Qué se marca, qué se aparta y quién lo revisa? | Fase 19 | pendiente · Fase 19 |
| `docs/api/` | Consultar | ¿Qué entrega la API, y cómo cambia sin romper? | Fase 22 | pendiente · Fase 22 |
| `docs/operacion/` | Resolver | Objetivos, continuidad, capacidad, calendario y responsables | Fases 23 a 30 | pendiente · Fases 23 a 30 |
| `docs/plantillas/` | Resolver | Plantillas de cambio y de postmortem | Fase 25 | pendiente · Fase 25 |
| `docs/seguridad/` | Entender | Zonas, amenazas y endurecimiento | Fase 27 | pendiente · Fase 27 |
| `docs/procedimientos/` y `docs/actas/` | Resolver | ¿Cómo doy de alta o de baja un sitio, y qué se probó? | Fase 29 | pendiente · Fase 29 |
| `docs/lista-de-produccion.md` | Consultar | ¿Está listo para producción, con qué evidencia? | Fase 30 | pendiente · Fase 30 |

## Reglas de la documentación

1. **Un documento responde a una pregunta,** y su título la dice.
2. **La documentación vive junto al código** y se actualiza en el mismo cambio: en el mismo commit o en el mismo PR.
3. **Ejemplos reales del repositorio,** con comandos que funcionan.
4. **Fecha en todo lo que envejece:** mediciones, pruebas y decisiones.
5. **Diagramas en Mermaid,** cada uno con su explicación debajo.
6. **Nada de secretos ni datos de clientes.** El repositorio es público.
7. **Si un documento contradice al código, manda el código,** y el documento se corrige en ese momento.
8. **Español y frases cortas.** Los términos técnicos en inglés se explican la primera vez, o se enlazan al glosario.

## Qué se actualiza cuándo

| Cuando… | Actualiza |
|---|---|
| Agregas o cambias una variable o un perfil | `docs/catalogo.md` (se regenera), y `docs/topicos.md` si cambia el mensaje |
| Cambias el esquema | La migración; `docs/decisiones.md` si hubo una decisión, y la sección 6 de `docs/GUIA.md` si cambia el modelo |
| Tomas una decisión de diseño | `docs/decisiones.md`, con el formato de abajo |
| Creas una alerta | Su procedimiento en `docs/RUNBOOK.md` |
| Cambias la API | `docs/api/openapi.json` (se regenera) y `docs/api/CAMBIOS.md` |
| Terminas un simulacro | Su ficha, y `docs/RUNBOOK.md` si faltaba un procedimiento |
| Terminas un `caso` | Una línea en `docs/casos.md` |
| Pones en servicio un sitio | Su acta en `docs/actas/` |
| Aparece un término nuevo | El glosario de `docs/OT-TI.md` |
| Cambia la arquitectura | Los diagramas de `docs/GUIA.md` y de `docs/COMO-ABORDAR.md`, y la tabla de la sección 1 de `docs/ATLAS-VISUAL.md` si nace un diagrama |
| Cierras una fase | Su apunte, `PROGRESO.md` y este índice si nació un documento. En la Parte 2, también su entrada en `docs/ATLAS-VISUAL.md` |

## Formato de una decisión

Las decisiones nuevas de `docs/decisiones.md` van con este formato. Las de la Parte 1 conservan el suyo.

```markdown
## AAAA-MM-DD · La decisión, en una frase
- **Contexto:** qué problema había y qué restricciones.
- **Decisión:** qué se hizo.
- **Alternativas:** qué más se consideró, y por qué no.
- **Consecuencias:** qué se gana, qué se paga y qué queda pendiente.
- **Estado:** vigente, o reemplazada por <fecha y decisión>.
```

Una decisión no se borra cuando cambia: se marca como reemplazada y se escribe la nueva. Así queda la historia de por qué el sistema es como es.
