# Atlas visual

Las ideas del proyecto, una por dibujo. Cada diagrama trae cómo leerlo, la idea en una frase y dónde se profundiza.

**Cómo usarlo**
- Mira el diagrama, lee "La idea" y, si quieres más, sigue el enlace.
- Para repasar, tapa "La idea" e intenta decirla tú.
- Los diagramas son Mermaid: se dibujan solos en GitHub, en VS Code (con la extensión *Markdown Preview Mermaid Support*) y en Notion (en un bloque de código con el lenguaje *Mermaid*).
- Las convenciones (cajas, cilindros, rombos, flechas punteadas) están en "Cómo leer los diagramas", al comienzo de `docs/GUIA.md`.
- Colores: **verde**, lo nuevo o lo permitido; **rojo**, un riesgo; **amarillo**, una reserva o algo provisorio.

---

## 1. Los diagramas que ya existen

| Idea | Tipo de diagrama | Dónde |
|---|---|---|
| El sistema y sus dos mundos, OT y TI | Flujo | `docs/COMO-ABORDAR.md`, sección 1 |
| El camino del dato | Flujo | `docs/COMO-ABORDAR.md`, sección 2.1 |
| La cadena de garantías | Flujo | `docs/COMO-ABORDAR.md`, sección 5 |
| La arquitectura completa | Flujo | `docs/GUIA.md`, sección 2 |
| El viaje de una lectura, paso a paso | Secuencia | `docs/GUIA.md`, sección 3 |
| El event loop de Node | Flujo | `docs/GUIA.md`, sección 5.1 |
| La cadena de middlewares de Express | Flujo | `docs/GUIA.md`, sección 5.2 |
| El login con JWT | Secuencia | `docs/GUIA.md`, sección 5.7 |
| Tópicos, QoS 1 y la sesión persistente | Flujo y dos secuencias | `docs/GUIA.md`, sección 5.8 |
| El upgrade del WebSocket | Secuencia | `docs/GUIA.md`, sección 5.11 |
| El flujo de Node-RED | Flujo | `docs/GUIA.md`, sección 5.12 |
| Imagen, contenedores y volúmenes | Flujo | `docs/GUIA.md`, sección 5.13 |
| El despliegue en Linux | Flujo | `docs/GUIA.md`, sección 5.14 |
| El flujo de Git de la Parte 1 | Git | `docs/GUIA.md`, sección 5.15 |
| El modelo de datos | Entidad-relación | `docs/GUIA.md`, sección 6 |
| La seguridad por capas | Flujo | `docs/GUIA.md`, sección 7 |
| Por qué no se pierden datos | Flujo | `docs/GUIA.md`, sección 8 |
| El detector de silencio | Estados | `docs/GUIA.md`, sección 10 |

---

## 2. Particiones: un cajón por mes

```mermaid
flowchart LR
  L["Lectura nueva,<br/>con su hora"] --> D{"¿De qué mes es?"}
  D -->|"noviembre 2026"| P11["p2026_11"]
  D -->|"diciembre 2026"| P12["p2026_12"]
  D -->|"enero 2027"| P01["p2027_01<br/>abierta el 24-11"]
  D -->|"febrero 2027"| P02["p2027_02<br/>abierta el 24-11"]
  D -->|"más adelante"| PF["p_futuro<br/>la reserva"]
  classDef nueva fill:#d4edda,stroke:#2e7d32,color:#1b5e20
  classDef reserva fill:#fff3cd,stroke:#b7791f,color:#5f370e
  class P01,P02 nueva
  class PF reserva
```

**Cómo leerlo.** La tabla `lecturas` es un archivador con un cajón por mes. MySQL mira la hora de cada lectura y la guarda en el cajón de su mes. Lo que llega después del último cajón cae en la reserva, `p_futuro`. En verde, los dos cajones que se abrieron el 24 de noviembre, cuando la reserva todavía estaba vacía.

**La idea.** Una reserva es una cuenta regresiva: los cajones se abren antes de que lleguen las lecturas de ese mes. Abrir uno vacío es instantáneo; partir una reserva con filas obliga a moverlas.

**Profundiza en:** `PLAN-2.md`, Fase 16, y `practica/rendimiento.sql`.

## 3. Borrar un mes: `DELETE` o soltar el cajón

```mermaid
flowchart TB
  subgraph DEL["Con DELETE"]
    D1["Recorre y borra<br/>fila por fila"] --> D2["Anota cada fila<br/>borrada en el binlog"] --> D3["El archivo queda<br/>del mismo tamaño"]
  end
  subgraph DROP["Con DROP PARTITION"]
    P1["Suelta el cajón<br/>completo"] --> P2["El archivo<br/>desaparece"]
  end
  classDef riesgo fill:#f8d7da,stroke:#c62828,color:#7f1d1d
  classDef ok fill:#d4edda,stroke:#2e7d32,color:#1b5e20
  class D3 riesgo
  class P2 ok
```

**Cómo leerlo.** Dos caminos para el mismo objetivo. El 16 de noviembre (Fase 11), borrar un mes de 2.422.937 filas con `DELETE` tardó 28,4 s, y soltar la partición, 3,9 s en Docker Desktop. En la prueba del caso 14, el `DELETE` de media partición tardó 6 s y el archivo siguió ocupando 88 MB; soltarla tardó 0,4 s y borró el archivo.

**La idea.** Para liberar espacio, se suelta el cajón; un `DELETE` masivo tarda, llena el binlog y no devuelve el espacio.

**Profundiza en:** `docs/rendimiento.md` y `docs/CRITERIO.md`, caso 14.

## 4. La deriva, y cómo se cierra

```mermaid
flowchart LR
  A["Cambio a mano en una base<br/>(abrir enero y febrero)"] --> B["Se anota en<br/>PROGRESO.md"]
  B --> C["La migración 0006<br/>lo escribe (Fase 16)"]
  C --> D["Toda base nueva<br/>queda igual a la tuya"]
  A -.->|"si no se anota"| E["Deriva: dos bases distintas<br/>y nadie sabe por qué"]
  classDef riesgo fill:#f8d7da,stroke:#c62828,color:#7f1d1d
  classDef ok fill:#d4edda,stroke:#2e7d32,color:#1b5e20
  class E riesgo
  class D ok
```

**Cómo leerlo.** El camino de arriba es el correcto: un cambio de emergencia se anota y después se formaliza. La flecha punteada es lo que pasa cuando no se anota.

**La idea.** Un cambio a mano es deriva hasta que una migración lo escribe.

**Profundiza en:** `PLAN-2.md`, Fase 16.

## 5. La misma versión en todas partes

```mermaid
flowchart LR
  subgraph PC["Tu equipo"]
    N1["Node 26<br/>npm test y scripts"]
  end
  subgraph DK["Contenedores"]
    N2["Imagen node:26<br/>API, gateway y tareas"]
  end
  subgraph UB["Ubuntu, Fase 13"]
    N3["Node 26<br/>servicios de systemd"]
  end
  N1 <-->|"misma versión"| N2
  N2 <-->|"misma versión"| N3
```

**Cómo leerlo.** Cada recuadro es un lugar donde corre tu código. La flecha doble dice que los dos extremos usan la misma versión de Node.

**La idea.** Si una prueba pasa en tu equipo, debe pasar en producción: es la paridad de entornos. Por eso `package.json` ahora exige Node 26 (`engines`).

**Profundiza en:** `PLAN-2.md`, Fase 25.

## 6. El servicio `tareas`: el reloj de la plataforma

```mermaid
flowchart LR
  P["Servicio tareas<br/>el programador"] -->|"cada mes"| T1["Abrir particiones<br/>(Fase 16)"]
  P -->|"cada 15 min"| T2["Lote de calidad<br/>y agregados por hora<br/>(Fase 20)"]
  P -->|"cada 15 min"| T3["Copia del binlog<br/>(Fase 24)"]
  P -->|"cada día"| T4["Respaldo completo<br/>(Fase 24)"]
  P -->|"cada minuto"| T5["Sonda<br/>(Fase 23)"]
  P --> L["Una línea de log<br/>por corrida"]
  T1 -.->|"se vigila con"| A1["ParticionesPorAgotarse"]
  T2 -.->|"se vigila con"| A4["AgregadosAtrasados"]
  T4 -.->|"se vigila con"| A2["RespaldoAntiguo"]
  T5 -.->|"se vigila con"| A3["SondaFallando"]
```

**Cómo leerlo.** Un solo servicio de Compose dispara todas las tareas periódicas, cada una con su frecuencia, y cada corrida deja una línea de log. Las flechas punteadas son las alertas de la Fase 23: no leen ese log, miran el efecto de la tarea (cuántos días de particiones quedan, la hora del último agregado, la edad del último respaldo, si la sonda informa). Así avisan tanto si la tarea falló como si nunca corrió.

**La idea.** En Windows no hay cron. Un servicio de Compose corre igual en tu equipo y en Linux, vive en Git y no superpone ejecuciones.

**Profundiza en:** `PLAN-2.md`, Fase 16, paso 6, y Fase 23 (las alertas).

## 7. La sonda y la alerta por ausencia

```mermaid
sequenceDiagram
  participant T as Servicio tareas
  participant S as Sonda (MTR-9999)
  participant B as Broker
  participant A as API y base
  participant M as Monitoreo
  T->>S: cada minuto
  S->>B: publica una lectura de prueba
  B->>A: la entrega y se guarda
  S->>A: ¿llegó?
  A-->>S: sí, en 2 s
  S->>M: informa: llegó en 2 s
  Note over T,M: Si el servicio tareas se detiene, la sonda no corre, y tampoco falla
  M->>M: 3 minutos sin informe: alerta SondaFallando
```

**Cómo leerlo.** Las columnas son los participantes, y el tiempo corre hacia abajo. La sonda se comporta como un equipo más: publica, y después comprueba que su dato llegó. La última línea es la clave: el monitoreo también alerta cuando la sonda deja de informar.

**La idea.** Algo que no corre no puede fallar. Por eso hay que alertar también por ausencia, no solo por error.

**Profundiza en:** `PLAN-2.md`, Fase 23, paso 4.

## 8. Permisos del broker: hoy y desde la Fase 27

**Hoy: un comodín por sitio**

```mermaid
flowchart TB
  G1["gw-norte"] -->|"escribe en"| T1["motores/norte/#<br/>todo el sitio"]
  T1 --- X1["telemetría"]
  T1 --- X2["estado"]
  T1 --- X3["alertas"]
  T1 --- X4["comandos (Fase 28)"]
  classDef riesgo fill:#f8d7da,stroke:#c62828,color:#7f1d1d
  class X3,X4 riesgo
```

**Desde la Fase 27: un permiso por tipo de tópico**

```mermaid
flowchart TB
  G2["gw-norte"] -->|"escribe"| Y1["telemetría y comunicación"]
  G2 -->|"escribe"| Y2["su estado y su salud"]
  G2 -.->|"solo lee"| Y4["comandos (Fase 28)"]
  API["API"] -->|"escribe"| Y3["alertas"]
  API -->|"escribe"| Y4
  classDef ok fill:#d4edda,stroke:#2e7d32,color:#1b5e20
  class Y1,Y2,Y3 ok
```

**Cómo leerlo.** El primer diagrama es el permiso de hoy: el gateway del sitio norte puede escribir en cualquier tópico del sitio, incluidas las alertas y, más adelante, los comandos (en rojo). El segundo es el de la Fase 27: cada gateway escribe solo lo suyo y solo lee sus comandos, y la API es la única que escribe alertas y comandos.

**La idea.** Permisos por puerta, no por edificio: si roban la credencial de un gateway, el daño queda acotado a lo que ese gateway necesita.

**Profundiza en:** `PLAN-2.md`, Fase 27, paso 5.

## 9. Las tres ausencias de un dato

```mermaid
flowchart TB
  Q{"¿Por qué no hay dato?"} --> A1["El gateway está caído<br/>o sin enlace"]
  Q --> A2["El equipo<br/>no responde"]
  Q --> A3["El sensor<br/>está en falla"]
  A1 --> S1["Señal: estado offline por el Last Will;<br/>todos sus equipos se callan"]
  A2 --> S2["Señal: el gateway sigue vivo<br/>y avisa sin_respuesta de ese equipo"]
  A3 --> S3["Señal: el equipo responde,<br/>pero esa variable llega como centinela"]
  S1 --> R1["Llamar a comunicaciones<br/>o al sitio"]
  S2 --> R2["Llamar a quien mantiene el<br/>controlador o la red del sitio"]
  S3 --> R3["Llamar a mantenimiento<br/>del grupo"]
```

**Cómo leerlo.** Se lee de arriba hacia abajo: la causa, la señal que deja y a quién se llama. Cada columna es un caso distinto.

**La idea.** "Sin dato" no es una sola cosa: cada ausencia deja una señal distinta y la atiende una persona distinta.

**Profundiza en:** `docs/OT-TI.md`, sección 5, y `PLAN-2.md`, fases 18 y 19.

## 10. La escalera del dato

```mermaid
flowchart TB
  C["1. Crudo<br/>lo que midió el equipo; no se toca"] --> Q["2. Calificado<br/>el crudo, con sus banderas de calidad"]
  Q --> K["3. Corregido<br/>en una capa aparte, con autor y motivo"]
  K --> AG["4. Agregado<br/>por minuto, hora o día, solo con lo bueno"]
  AG --> I["5. Indicador<br/>horas, energía, consumo y disponibilidad"]
  classDef base fill:#d4edda,stroke:#2e7d32,color:#1b5e20
  class C base
```

**Cómo leerlo.** Cada escalón se construye desde el anterior. El primero, en verde, es la base de todo.

**La idea.** Cada escalón se puede recalcular desde el de abajo. Por eso el crudo no se toca: si se daña, se cae toda la escalera.

**Profundiza en:** `docs/OT-TI.md`, sección 5, y `PLAN-2.md`, fases 19 a 21.

## 11. Cuántos puntos recibe un gráfico

```mermaid
flowchart LR
  F["El front pide un rango<br/>con max_puntos=1500"] --> A{"resolucion=auto<br/>la más fina que<br/>no pase de 1.500"}
  A -->|"2 horas"| R1["cruda, cada 5 s<br/>1.440 puntos"]
  A -->|"1 día"| R2["1m<br/>1.440 puntos"]
  A -->|"7 días"| R3["15m<br/>672 puntos"]
  A -->|"45 días"| R4["1h<br/>1.080 puntos"]
  A -->|"90 días"| R5["1d<br/>90 puntos"]
```

**Cómo leerlo.** A la izquierda, lo que pide el front. El rombo es la regla `auto`: prueba de la resolución más fina a la más gruesa y se queda con la primera que no pasa de 1.500 puntos. A la derecha, lo que recibe en cada caso. Un punto crudo trae el valor y su calidad; desde `1m`, cada punto es un resumen con promedio, mínimo y máximo, porque un promedio solo escondería los picos.

**La idea.** El servidor reduce y el front dibuja. En crudo, 7 días de una variable son unos 121.000 puntos y 90 días, más de 1,5 millones; un gráfico de 1.000 píxeles de ancho no puede mostrarlos.

**Profundiza en:** `PLAN-2.md`, Fase 22 (series con resolución).

## 12. El flujo de Git de la Parte 2

```mermaid
gitGraph
  commit id: "fase 14" tag: "v1.0.0"
  commit id: "docs: guía"
  commit id: "docs: Parte 2"
  branch revision-parte-2
  checkout revision-parte-2
  commit id: "build(node)"
  commit id: "docs(plan-2)"
  checkout main
  merge revision-parte-2
  branch fase-15-simulacros
  checkout fase-15-simulacros
  commit id: "simulacros"
  checkout main
  merge fase-15-simulacros tag: "fase-15"
```

**Cómo leerlo.** Cada punto es un commit, cada línea es una rama y las uniones son merges, hechos con un PR. Las etiquetas son tags: versiones a las que se puede volver.

**La idea.** `main` siempre funciona: cada cambio se hace en su rama, se revisa y recién entonces entra.

**Profundiza en:** `docs/GUIA.md`, sección 5.15, y `PLAN-2.md`, Fase 25.

---

## 13. Cómo crece el atlas

Cada fase de la Parte 2 deja al menos un diagrama en su apunte y una entrada aquí, con cómo leerlo, la idea y dónde se profundiza.

**Un buen diagrama:**
- explica una sola idea;
- tiene unas 10 cajas como máximo;
- usa los colores de la leyenda, siempre con el mismo significado;
- trae "Cómo leerlo" debajo;
- se comprobó que se dibuja.
