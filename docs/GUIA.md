# Guía del proyecto · Plataforma de telemetría de motores

Esta guía explica **todo el proyecto desde cero**: de qué se trata, cómo está armado, qué hace cada
herramienta, su sintaxis mínima y por qué se tomó cada decisión. Está pensada para alguien que no
maneja el tema y quiere dominarlo rápido.

> **Diagramas.** Usan [Mermaid](https://mermaid.js.org): GitHub, Notion y VS Code (con la extensión
> *Markdown Preview Mermaid Support*) los dibujan solos. En un visor sin Mermaid, se ven como texto.

**Cómo leerla.**
- **En 30 minutos:** secciones 1 a 4. Sabrás qué hace el sistema y por dónde viaja un dato.
- **En una tarde:** suma la sección 5, una herramienta a la vez y con el archivo abierto al lado.
- **Para dominarlo:** sigue la ruta de la sección 12, que combina leer, ejecutar y romper a propósito.

### Cómo leer los diagramas

Todos siguen las mismas convenciones, y cada uno trae debajo su explicación paso a paso.

| Tipo | Cómo se lee |
|---|---|
| **Flujo** (cajas y flechas) | Una caja es un programa o un paso; un cilindro guarda datos; un rombo es una decisión; un recuadro con título agrupa lo que corre en un mismo lugar. La flecha indica hacia dónde va el dato, y su texto dice el protocolo o la condición. Una flecha punteada es un camino opcional. |
| **Secuencia** (columnas) | Cada columna es un participante y el tiempo corre hacia abajo. Flecha llena: un envío o un pedido. Flecha punteada: una respuesta. Flecha que vuelve a su columna: trabajo interno. `alt` muestra caminos alternativos y `loop`, algo que se repite. |
| **Entidad-relación** (tablas) | Cada caja es una tabla con sus columnas. Los extremos de las líneas dicen cuántos: una raya es "uno", una pata de gallo es "muchos". |
| **Estados** | Cada caja es un estado y cada flecha, un cambio de estado con su condición. El punto negro es el inicio. |
| **Git** | Cada punto es un commit, cada línea es una rama y las uniones son merges. Las etiquetas son tags (versiones). |
| **Dibujo de texto** (en un bloque de código) | Muestra cómo se arma un dato por dentro: un mensaje, un token o una trama. Las llaves `└──┘` agrupan una parte y la flecha `←` le pone nombre. |

## Índice

1. [La idea en un minuto](#1-la-idea-en-un-minuto)
2. [Arquitectura](#2-arquitectura)
3. [El viaje de una lectura](#3-el-viaje-de-una-lectura)
4. [Mapa del repositorio](#4-mapa-del-repositorio)
5. [Las herramientas, una por una](#5-las-herramientas-una-por-una)
6. [Modelo de datos](#6-modelo-de-datos)
7. [Seguridad por capas](#7-seguridad-por-capas)
8. [Por qué no se pierden datos](#8-por-qué-no-se-pierden-datos)
9. [Rendimiento con millones de filas](#9-rendimiento-con-millones-de-filas)
10. [Operación](#10-operación)
11. [Comandos de uso diario](#11-comandos-de-uso-diario)
12. [Ruta para dominarlo](#12-ruta-para-dominarlo)
13. [Glosario](#13-glosario)

---

## 1. La idea en un minuto

Un **grupo electrógeno** (un motor diésel que mueve un generador) en una faena remota mide siete
cosas: velocidad (rpm), temperatura del refrigerante, presión de aceite, voltaje de batería, carga,
horas de operación y una palabra de alarmas. Esta plataforma hace seis trabajos con esos datos:

1. **Leerlos en terreno:** por Modbus TCP desde el controlador del motor, o por CAN J1939 desde su ECU.
2. **Transportarlos sin perderlos,** aunque se corte internet: buffer local más MQTT.
3. **Validarlos y guardarlos** en MySQL, sin duplicados.
4. **Mostrarlos en vivo,** a cada usuario solo lo de su faena: dashboard con WebSocket.
5. **Entregarlos a otros sistemas** (SCADA, EMS) por una API segura.
6. **Avisar** cuando un motor deja de enviar datos.

Si vienes del mundo industrial, piensa en un **PI System hecho a mano** con herramientas web:

| Pieza del proyecto | Qué hace | En una planta sería... |
|---|---|---|
| Simulador Modbus | Hace de controlador de dos motores | El PLC del grupo electrógeno |
| Gateway | Lee Modbus, guarda en disco y publica por MQTT | El RTU o concentrador de la faena |
| Mosquitto (broker MQTT) | Reparte mensajes por canales (tópicos) | Una radio troncal con canales |
| API Node.js | Recibe, valida, guarda y sirve los datos | El servidor del historiador y su interfaz |
| MySQL | Guarda la historia y el último valor | El archivo del historiador |
| Dashboard | Muestra los datos en vivo | La pantalla HMI de la sala de control |
| Node-RED | El mismo gateway, armado con bloques | Programar en bloques (FBD) en vez de texto |
| Docker, systemd y nginx | Ejecutan, reinician y protegen todo | El tablero eléctrico, con sus protecciones y una sola puerta |

---

## 2. Arquitectura

```mermaid
flowchart LR
  subgraph terreno["Terreno (faena)"]
    SIM["Simulador Modbus TCP<br/>MTR-01 y MTR-02"]
    LOG["Log CAN J1939<br/>MTR-03"]
    GW["Gateway<br/>+ buffer SQLite"]
    NR["Node-RED<br/>(MTR-02 en bloques)"]
    DEC["can-a-mqtt.js<br/>decodificador J1939"]
    SIM -->|"Modbus TCP<br/>función 03"| GW
    SIM -->|"Modbus TCP"| NR
    LOG --> DEC
  end
  subgraph transporte["Transporte"]
    BRK[("Mosquitto<br/>broker MQTT")]
  end
  subgraph plataforma["Plataforma (servidor)"]
    API["API Node.js + Express 5<br/>validación, JWT, roles,<br/>auditoría y loteador"]
    DB[("MySQL 8.4<br/>lecturas, estado<br/>y auditoría")]
  end
  subgraph consumidores["Quién usa los datos"]
    DASH["Dashboard web"]
    EXT["SCADA / EMS"]
  end
  GW -->|"MQTT QoS 1"| BRK
  NR -->|"MQTT QoS 1"| BRK
  DEC -->|"MQTT QoS 1"| BRK
  BRK -->|"sesión persistente"| API
  API <-->|"SQL"| DB
  API -->|"WebSocket"| DASH
  API -->|"REST con X-API-Key"| EXT
  BRK -.->|"MQTT de solo lectura"| EXT
```

**Cómo leer este diagrama.** Se lee de izquierda a derecha, en el sentido en que viajan los datos.
Los cuatro recuadros son **zonas** (dónde corre cada cosa); las cajas son **programas**; los
cilindros **guardan datos**; y el texto de cada flecha es el **protocolo**, el idioma con que se
hablan dos piezas. La flecha punteada es un camino opcional.

**El recorrido, tramo por tramo:**
1. El gateway y Node-RED **preguntan** al simulador por Modbus; el decodificador CAN **lee** el log J1939.
2. Los tres **publican** cada lectura en Mosquitto por MQTT.
3. Mosquitto se la **entrega** a la API, que la valida y la guarda en MySQL.
4. La API la **empuja** al dashboard por WebSocket y la **sirve** a SCADA o EMS con una API REST.
   Un EMS también podría escuchar MQTT directo.

**Qué es cada pieza:**

| Pieza | Qué es | Qué hace aquí |
|---|---|---|
| Simulador Modbus TCP | Un programa que imita el controlador (PLC) de dos motores | Responde 8 registros por motor cuando le preguntan |
| Log CAN J1939 | Un archivo grabado del bus CAN de un tercer motor | Es la fuente de datos de MTR-03 |
| Gateway | El traductor de la faena | Lee Modbus cada 5 s, guarda en su buffer y publica por MQTT |
| Buffer SQLite | Una base de datos en un archivo, dentro del gateway | Guarda cada mensaje hasta que el broker confirma que lo recibió |
| Node-RED | Una herramienta para programar con bloques | Hace lo mismo que el gateway para MTR-02, armado visualmente |
| can-a-mqtt.js | Un script de Node | Traduce las tramas J1939 a mensajes MQTT |
| Mosquitto | Un broker MQTT: el servidor de mensajería | Recibe mensajes por tópico y los reparte a quien esté suscrito |
| API Node.js + Express 5 | El servidor central, escrito en JavaScript | Valida, guarda, controla el acceso, audita y avisa |
| MySQL 8.4 | Una base de datos relacional | Guarda la historia, el último valor, los usuarios y la auditoría |
| Dashboard web | Una página en el navegador | Muestra los valores en vivo |
| SCADA / EMS | Sistemas externos. SCADA supervisa y controla la planta; un EMS (Energy Management System) gestiona la energía, por ejemplo cuántos grupos encender | Consumen los datos de la plataforma |

**Los protocolos de las flechas:**
- **Modbus TCP, función 03:** pregunta y respuesta para leer registros de un equipo industrial.
- **MQTT QoS 1:** publicar un mensaje en un tópico, con acuse de recibo; llega al menos una vez.
- **Sesión persistente:** el broker guarda los mensajes mientras la API está desconectada.
- **SQL:** el lenguaje para leer y escribir en MySQL.
- **WebSocket:** una conexión que queda abierta para empujar datos al navegador.
- **REST con X-API-Key:** peticiones HTTP normales, autenticadas con una clave por sistema.

**Las cuatro capas, de izquierda a derecha:**

- **Terreno.** Los datos nacen en los equipos. El gateway pregunta cada 5 segundos, traduce los
  registros a valores con unidades y guarda cada mensaje en un archivo SQLite antes de enviarlo.
- **Transporte.** MQTT desacopla a quien produce de quien consume. El gateway no sabe que existe la API:
  publica en un tópico y el broker se lo entrega a quien esté suscrito.
- **Plataforma.** La API es la única puerta a los datos: valida, aplica permisos, guarda en lotes,
  audita cada acceso y avisa en vivo. MySQL es el historiador.
- **Consumidores.** El dashboard (personas) y los sistemas externos (máquinas), cada uno con su forma
  de autenticarse.

**Puertos que vas a ver:**

| Servicio | Puerto | Dónde corre |
|---|---|---|
| API y dashboard | 3000 | `npm run api` o contenedor `api` |
| MySQL | 3306 | contenedor `mysql` |
| MQTT | 1883 | contenedor `mosquitto` |
| Simulador Modbus | 5020 | `npm run simulador` o contenedor `simulador` |
| Node-RED | 1880 | contenedor `nodered` (solo desde tu equipo) |

---

## 3. El viaje de una lectura

Así viaja **una** lectura de rpm desde el registro de un PLC hasta la pantalla:

```mermaid
sequenceDiagram
  autonumber
  participant S as Simulador (PLC)
  participant G as Gateway
  participant L as Buffer SQLite
  participant B as Mosquitto
  participant A as API (ingesta MQTT)
  participant T as Loteador
  participant D as MySQL
  participant W as Dashboard
  G->>S: Lee 8 registros (Unit 1, función 03)
  S-->>G: [1500, 852, 420, 2685, 64, h0, h1, 0]
  G->>G: Decodifica (int16, escalas, float CDAB)
  G->>L: Guarda el mensaje JSON antes de publicar
  G->>B: PUBLISH motores/norte/MTR-01/telemetria (QoS 1)
  B-->>G: PUBACK (el broker lo tiene)
  G->>L: Borra el mensaje confirmado
  B->>A: Entrega el mensaje (sesión persistente)
  A->>A: Valida la forma (zod) y cada lectura (evaluarLectura)
  A->>T: Agrega las filas válidas
  T->>D: Un INSERT por lote y el upsert del estado, en una transacción
  D-->>T: Commit
  T->>W: Difunde por WebSocket solo a quien puede ver ese sitio
```

**Cómo leer este diagrama.** Es un diagrama de secuencia: cada columna es un participante y el
tiempo corre hacia abajo. Una flecha llena es un envío; una punteada, una respuesta; una que vuelve a
su propia columna, trabajo interno. Los números marcan el orden.

**El recorrido en cinco etapas:**
1. **Leer (pasos 1 a 3).** El gateway le pide 8 registros al PLC y recibe 8 números crudos (`h0` y `h1`
   son las dos mitades del valor de horas). Luego los **decodifica**: aplica escalas (852 → 85,2 °C),
   el signo y el formato del float.
2. **Asegurar (4 a 7).** Antes de enviar, guarda el mensaje en su buffer SQLite. Publica y espera el
   **PUBACK**, el acuse de recibo del broker. Recién entonces lo borra: si algo falla en medio, el
   mensaje sigue guardado.
3. **Recibir (8 y 9).** El broker se lo entrega a la API, que revisa la forma con **zod** y cada lectura
   con **evaluarLectura** (motor, sitio, variable, hora y rango).
4. **Guardar (10 a 12).** El **loteador** junta filas y las escribe en un solo INSERT, más el **upsert**
   del último valor, dentro de una **transacción**. El **commit** confirma que todo quedó guardado.
5. **Mostrar (13).** Solo después del commit, la API envía el dato por WebSocket a los dashboards que
   pueden ver ese sitio.

**Lo que aparece:**
- **PUBLISH y PUBACK:** el envío de un mensaje MQTT y su acuse de recibo.
- **QoS 1:** el nivel de entrega "al menos una vez": sin PUBACK, se reenvía.
- **zod:** la librería que revisa que los datos tengan la forma esperada.
- **evaluarLectura:** la regla del proyecto que decide si una lectura se guarda.
- **Loteador:** junta muchas filas para escribirlas de una vez.
- **Upsert:** insertar o, si ya existe, actualizar.
- **Transacción y commit:** varias escrituras que se confirman juntas (commit) o se deshacen juntas.

| Pasos | Archivo | Qué aprender ahí |
|---|---|---|
| 1 a 3 | `src/gateway/gateway.js`, `src/comun/decodificacion.js` | Modbus, complemento a dos, orden de palabras de un float |
| 4 a 7 | `src/gateway/buffer-local.js` | Store-and-forward: guardar antes de enviar |
| 5 a 8 | `mosquitto/`, `src/api/ingesta-mqtt.js` | QoS 1, sesión persistente, ACL |
| 9 | `src/comun/validacion.js` | Validación en dos niveles: forma y contenido |
| 10 a 12 | `src/api/loteador.js`, `src/api/repositorio.js` | Lotes, idempotencia y transacciones |
| 13 | `src/api/tiempo-real.js` | WebSocket y filtro por sitio |

**El mensaje que viaja por MQTT** (docs/topicos.md):

```json
{ "motor": "MTR-01", "gateway": "gw-norte", "ts": "2026-11-16T13:07:58.828Z",
  "lecturas": { "rpm": 1500, "temp_refrigerante": 85.2, "presion_aceite": 420 } }
```

Cada mensaje dice de qué motor es, qué gateway lo envió, cuándo se midió y cuánto valió cada variable.
La hora (`ts`) va en UTC: la `Z` final significa hora universal. La API convierte cada mensaje en una
fila por variable.

**Hay un segundo camino, por HTTP:** un gateway que no habla MQTT puede mandar un lote con
`POST /api/lecturas`. Pasa por la misma validación (`evaluarLectura`) y el mismo guardado (`guardarLote`).

---

## 4. Mapa del repositorio

```
Proyecto_backend/
├── src/
│   ├── api/                  la API (un proceso de Node)
│   │   ├── server.js         arranque y apagado ordenado: conecta todas las piezas
│   │   ├── app.js            la cadena de middlewares de Express
│   │   ├── db.js             pool de conexiones a MySQL
│   │   ├── auth.js           JWT, roles y permiso por sitio
│   │   ├── auditoria.js      anota cada acceso en la base
│   │   ├── catalogo.js       motores y variables en memoria (caché de 60 s)
│   │   ├── repositorio.js    INSERT idempotente y estado actual, en una transacción
│   │   ├── loteador.js       junta filas y escribe por lotes
│   │   ├── ingesta-mqtt.js   suscripción MQTT y validación de cada mensaje
│   │   ├── tiempo-real.js    WebSocket del dashboard
│   │   ├── silencio.js       detector de motores sin datos
│   │   ├── claves-api.js     X-API-Key para SCADA y EMS
│   │   └── rutas/            auth, motores, lecturas, auditoria, operacion, integracion
│   ├── comun/                config, zod, validacion, errores, log, decodificacion (Modbus), j1939 (CAN)
│   ├── gateway/              gateway.js y buffer-local.js
│   ├── simulador/            motor-modbus.js
│   └── scripts/              sembrar usuarios, claves MQTT, volumen, CAN, Node-RED, clave de API
├── public/                   dashboard: index.html, app.js, estilos.css (sin frameworks)
├── sql/                      esquema que se crea solo al iniciar MySQL (001 a 005)
├── practica/                 consultas y mediciones para estudiar
├── test/                     68 pruebas automáticas (node:test + supertest)
├── mosquitto/                mosquitto.conf y acl (passwd se genera y no se sube)
├── flows/                    flujo de Node-RED y su nodo function
├── deploy/                   systemd, nginx, respaldo y despliegue en Linux
├── docs/
│   ├── README.md             índice de toda la documentación: qué leer según lo que necesitas
│   ├── GUIA.md               esta guía
│   ├── COMO-ABORDAR.md       cómo leer y estudiar el proyecto: niveles de zoom y cinco mapas
│   ├── CRITERIO.md           cómo decidir rápido: principios, tablas y casos
│   ├── OT-TI.md              qué hacer y qué no en OT/TI, el grupo electrógeno y el glosario
│   ├── decisiones.md         por qué se hizo así cada cosa importante
│   ├── RUNBOOK.md            qué hacer cuando algo falla
│   ├── rendimiento.md        cuánto tardan las consultas, antes y después de optimizar
│   ├── topicos.md · j1939.md · rs485.md   referencia de MQTT y de los protocolos de terreno
│   ├── apuntes/              un apunte por fase (fase-00 a fase-14)
│   └── simulacros/           guion del agente para los simulacros (trae las respuestas: no lo abras)
├── Dockerfile · docker-compose.yml · package.json · .env.example
├── README.md · PROGRESO.md   cómo levantar el sistema, y en qué vas
├── PLAN.md · PLAN-2.md       el plan: Parte 1 (fases 0 a 14) y Parte 2 (fases 15 a 30)
└── AGENTS.md · CLAUDE.md · PROMPTS.md   reglas del agente (CLAUDE.md las importa) y los prompts
```

**Cómo leer este mapa.** Cada línea es una carpeta (termina en `/`) o un archivo; las rayas `├──` y
`└──` muestran qué va dentro de qué, y a la derecha está para qué sirve. De `src/` salen **tres
programas** que corren por separado: la API (`src/api`), el gateway (`src/gateway`) y el simulador
(`src/simulador`). `src/comun` es el código que comparten, y `src/scripts`, las herramientas que se
ejecutan a mano.

`.env` (tus claves) y `datos/` (buffer, respaldos y claves de API) viven solo en tu equipo: Git los ignora.

---

## 5. Las herramientas, una por una

Cada herramienta trae lo mismo: **qué es**, **de qué se compone**, **la sintaxis mínima** para leer el
proyecto, **dónde aparece** y los **errores típicos** (OJO).

### 5.1 JavaScript y Node.js

**Qué es.** JavaScript es el lenguaje; **Node.js** es el programa que lo ejecuta fuera del navegador,
en un servidor. Node usa **un solo hilo** con un **event loop**: mientras espera a la base o a la
red, atiende otras cosas. Es un cocinero que nunca se queda mirando el horno: lo pone, atiende otro
pedido y vuelve cuando suena la alarma.

```mermaid
flowchart LR
  P["Tu código"] -->|"pide algo lento:<br/>consulta, red, archivo"| SO["Sistema operativo<br/>(libuv)"]
  SO -->|"cuando termina,<br/>deja el aviso"| C["Cola de eventos"]
  C -->|"el event loop toma<br/>el siguiente aviso"| P
```

**Cómo leer este diagrama.** Es un ciclo que se repite sin parar:
1. Tu código pide algo lento: una consulta a MySQL, un mensaje por la red o leer un archivo.
2. **libuv** se encarga por debajo, junto al sistema operativo, y Node sigue atendiendo otras cosas.
3. Cuando lo lento termina, deja un aviso en la **cola de eventos**.
4. El **event loop** toma los avisos de a uno y continúa el código que esperaba (lo que sigue a un `await`).

**Lo que aparece:**
- **Hilo:** una línea de ejecución. Node usa uno solo para tu código.
- **I/O (entrada y salida):** red, disco y base de datos. Es lo lento.
- **Event loop:** el ciclo que reparte el turno entre todo lo pendiente.

**Por qué importa:** con un solo hilo, la API atiende cientos de peticiones mientras espera a MySQL.
Pero un cálculo largo sin pausas (un bucle de millones de vueltas) sí lo bloquea todo.

**De qué se compone:**
- **V8:** el motor que ejecuta JavaScript (el mismo de Chrome).
- **libuv:** la capa que hace la red y los archivos sin bloquear.
- **npm:** el gestor de paquetes. Descarga librerías a `node_modules/`.
- **package.json:** la ficha del proyecto: dependencias, scripts y versión mínima de Node.
- **package-lock.json:** las versiones exactas instaladas. `npm ci` lo respeta al pie de la letra.

| Campo de `package.json` | Ejemplo del proyecto | Para qué sirve |
|---|---|---|
| `"type": "module"` | — | Permite usar `import` y `export` |
| `"scripts"` | `"api": "node --env-file=.env src/api/server.js"` | Atajos: `npm run api` |
| `"dependencies"` | `express`, `mysql2`, `zod`, `mqtt`, `ws`... | Lo que necesita en producción |
| `"devDependencies"` | `supertest` | Solo para las pruebas |
| `"engines"` | `"node": ">=26"` | Versión mínima de Node |

| Opción de `node` | Qué hace |
|---|---|
| `--env-file=.env` | Carga las variables de `.env` en `process.env`, sin librerías |
| `--watch` | Reinicia el proceso al guardar un archivo |
| `--test` | Corre las pruebas de `node:test` |

**Sintaxis mínima de JavaScript** (todo esto aparece en el proyecto):

```js
// Variables
const limite = 500;                   // no se reasigna (lo normal)
let intentos = 0;                     // sí se reasigna
intentos += 1;

// Funciones
function suma(a, b) { return a + b; }
const doble = (n) => n * 2;           // función flecha: forma corta

// Objetos y arreglos
const motor = { codigo: 'MTR-01', rpm: 1500 };
const { codigo } = motor;             // desestructurar: saca una propiedad a una variable
const lista = [1, 2, 3];
const copia = [...lista, 4];          // spread: copia y agrega → [1, 2, 3, 4]
const altos = lista.filter((n) => n > 1).map((n) => n * 10);  // → [20, 30]

// Valores que pueden faltar
const sitio = usuario?.sitio;         // ?. no falla si usuario es undefined
const pagina = consulta.pagina ?? 1;  // ?? usa 1 si el valor es null o undefined

// Texto con variables (template literal, con comillas invertidas)
const texto = `Motor ${codigo} a ${motor.rpm} rpm`;

// Módulos (ES modules)
import { pool } from './db.js';       // traer algo de otro archivo
export function crearApp() {}         // ofrecerlo a otros archivos

// Asincronía: una promesa es "un resultado que llegará después"
async function leer() {
  try {
    const [filas] = await pool.query('SELECT 1');   // espera sin bloquear el proceso
    return filas;
  } catch (err) {                                    // si la promesa falla
    console.error(err.message);
  }
}

// Clases (pocas en el proyecto)
class ErrorHttp extends Error {
  constructor(estado, mensaje) { super(mensaje); this.estado = estado; }
}
```

**OJO:**
- `await` solo funciona dentro de una función `async` (o en el nivel superior de un módulo).
- Olvidar `await` deja la promesa "colgando": el código sigue sin esperar el resultado.
- Una promesa rechazada que nadie atrapa (`.catch` o `try`) tumba el proceso.

### 5.2 Express 5 (la API HTTP)

**Qué es.** Un framework mínimo para APIs HTTP. Recibe peticiones, las pasa por una **cadena de
middlewares** y responde JSON.

**Anatomía de una petición y su respuesta:**

```
── petición: la envía el cliente ─────────────
POST /api/motores HTTP/1.1                    ← método, ruta y versión
Authorization: Bearer eyJhbGciOiJIUzI1Ni...   ← encabezados, uno por línea
Content-Type: application/json
                                              ← línea en blanco: fin de los encabezados
{"codigo":"MTR-10","modelo":"12V4000","sitio_id":1}     ← cuerpo (body)

── respuesta: la devuelve la API ─────────────
HTTP/1.1 201 Created                          ← versión y código de estado
Location: /api/motores/MTR-10                 ← encabezado: dónde quedó el recurso nuevo
Content-Type: application/json; charset=utf-8

{"codigo":"MTR-10","modelo":"12V4000","sitio_id":1,"sitio":"norte"}
```

**Cómo leer este dibujo.** Arriba va la petición y abajo, la respuesta. Las dos tienen las mismas
cuatro partes, en el mismo orden:
1. **La primera línea.** En la petición: el **método** (qué quieres hacer), la **ruta** (sobre qué
   recurso) y la versión del protocolo (`HTTP/1.1`). En la respuesta: la versión y el **código de
   estado** (cómo salió).
2. **Los encabezados (headers).** Datos sobre el mensaje, uno por línea, con la forma `Nombre: valor`.
   `Authorization` lleva el token y `Content-Type` dice en qué formato viene el cuerpo.
3. **Una línea en blanco**, que marca el fin de los encabezados.
4. **El cuerpo (body).** Los datos en sí, en **JSON**: texto con pares `"nombre": valor` entre llaves.
   Una petición `GET` no lleva cuerpo.

**Los métodos que usa el proyecto:** `GET` lee, `POST` crea, `PUT` actualiza y `DELETE` borra. En los
motores, `DELETE` hace una **baja lógica**: marca el motor como inactivo y conserva su historia.

**Los códigos de estado que usa el proyecto:**

| Código | Significa | Ejemplo en el proyecto |
|---|---|---|
| 200 | OK | Listar motores |
| 201 | Creado | `POST /api/motores`, `POST /api/lecturas` |
| 204 | Hecho, sin cuerpo | Dar de baja un motor |
| 400 | La petición está mal formada | JSON roto |
| 401 | No sé quién eres | Sin token, token vencido o alterado |
| 403 | Sé quién eres, pero no puedes | Un lector intenta crear un motor |
| 404 | No existe (o no es tuyo) | Un motor de otro sitio |
| 409 | Choca con lo que existe | Código de motor repetido |
| 422 | Se entendió, pero no es válido | `codigo: "X"`, lote vacío |
| 429 | Demasiados intentos | El sexto login fallido |
| 500 | Error del servidor | Un error inesperado (el detalle va al log) |
| 503 | No puedo atender ahora | `/api/listo` sin base o sin broker |

**De qué se compone:**
- **`app`:** la aplicación.
- **Middleware:** una función `(req, res, next)` por la que pasa la petición.
- **Router:** un grupo de rutas con un prefijo.
- **`req` y `res`:** la petición y la respuesta.
- **Manejador de errores:** un middleware con cuatro parámetros, que va al final.

**La cadena de este proyecto** (`src/api/app.js`). El orden importa, como en una fila de filtros:

```mermaid
flowchart TD
  R(["Petición HTTP"]) --> H["helmet<br/>encabezados de seguridad"]
  H --> S{"¿Es un archivo<br/>de public/?"}
  S -->|"sí"| F(["Responde el archivo"])
  S -->|"no"| AU["registrarAcceso<br/>(anota al terminar)"]
  AU --> J["express.json<br/>el cuerpo pasa a req.body"]
  J --> RT["Rutas /api/..."]
  RT -->|"todo bien"| OK(["Respuesta JSON"])
  RT -->|"ninguna calza"| N4(["404 en JSON"])
  RT -->|"se lanzó un error"| ER["Manejador de errores<br/>(cuatro parámetros)"]
  ER --> RE(["400, 401, 403, 404, 409,<br/>422, 429 o 500"])
```

**Cómo leer este diagrama.** Se lee de arriba hacia abajo. Las cajas redondeadas son la entrada y las
salidas posibles; las rectangulares, los pasos; el rombo, una decisión. Cada petición recorre los pasos
en orden, hasta que alguno responde.

**Qué hace cada paso:**
1. **helmet:** agrega encabezados de seguridad a la respuesta, por ejemplo qué scripts puede ejecutar el navegador.
2. **express.static:** si se pide un archivo del dashboard (`index.html`, `app.js`), lo entrega y la cadena termina ahí.
3. **registrarAcceso:** deja preparada la anotación de la auditoría, que se escribe cuando la respuesta termina.
4. **express.json:** convierte el texto JSON del cuerpo en un objeto (`req.body`). Si el JSON está roto,
   salta directo al manejador de errores (400).
5. **Rutas:** cada grupo de rutas tiene sus propios pasos: `autenticar` (el token), `autorizar` (el rol)
   y `validar` (zod). Al final viene la lógica.
6. **404:** si ninguna ruta coincidió.
7. **Manejador de errores:** recibe cualquier error lanzado y lo traduce al código HTTP correcto. Un error
   inesperado sale como 500, y el detalle va al log.

**Lo que aparece:**
- **Middleware:** una función por la que pasa cada petición; con `next()` deja pasar al paso siguiente.
- **Encabezados (headers):** datos extra de una petición o de una respuesta, como `Authorization` o `Content-Type`.

**Sintaxis mínima:**

```js
import express from 'express';
const app = express();
app.use(express.json());                        // middleware global: parsea el JSON del cuerpo

app.get('/api/motores/:codigo', async (req, res) => {
  const { codigo } = req.params;                // parte de la ruta: /api/motores/MTR-01
  const { variable } = req.query;               // query string: ?variable=rpm
  const motor = await buscar(codigo);
  if (!motor) throw new ErrorHttp(404, 'No existe');  // Express 5 lo manda solo al manejador de errores
  res.status(200).json(motor);                  // responde JSON
});

// Middleware propio: hace su trabajo y llama a next() para seguir.
function autenticar(req, res, next) { /* revisa el token */ next(); }

// Router: rutas agrupadas bajo un prefijo.
const router = express.Router();
router.use(autenticar);                         // vale para todas las rutas del router
router.get('/', async (req, res) => res.json([]));
app.use('/api/motores', router);

// Manejador de errores: CUATRO parámetros, y al final de todo.
app.use((err, req, res, next) => res.status(500).json({ error: 'Error interno' }));

app.listen(3000);
```

**Todas las rutas de la API:**

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `GET /api/salud` | cualquiera | El proceso está vivo |
| `GET /api/listo` | cualquiera | Base y broker conectados (503 si no) |
| `GET /api/metricas` | admin | Contadores de ingesta, loteador, WebSocket y memoria |
| `POST /api/auth/login` | cualquiera | Usuario y clave → token JWT de 15 min |
| `GET /api/motores` | autenticado | Motores de su sitio |
| `GET /api/motores/:codigo` | autenticado | Un motor (404 si es de otro sitio) |
| `POST /api/motores` | admin, ingeniero | Crea un motor |
| `PUT /api/motores/:codigo` | admin, ingeniero | Cambia modelo y sitio |
| `DELETE /api/motores/:codigo` | admin, ingeniero | Baja lógica (`activo = FALSE`) |
| `POST /api/lecturas` | gateway, admin | Ingesta HTTP de un lote (de 1 a 1000) |
| `GET /api/motores/:codigo/lecturas` | autenticado | Serie de una variable (máximo 7 días) |
| `GET /api/motores/:codigo/estado` | autenticado | Último valor de cada variable |
| `GET /api/auditoria` | admin | Registro de accesos, paginado por clave (`?antesDe=`) |
| `GET /api/integracion/estado?sitio=` | clave de API | Último estado del sitio, en formato plano |
| `WS /ws?token=` | autenticado | Lecturas, gateways y alertas en vivo |

**OJO:**
- Un manejador de errores con tres parámetros no es un manejador de errores: Express lo trata como un middleware normal.
- En Express 4 había que atrapar los errores `async` a mano; en Express 5 llegan solos al manejador.

### 5.3 zod (validar lo que llega)

**Qué es.** Una librería para describir la forma que deben tener los datos y comprobarlo. Todo lo que
viene de afuera (body, query, variables de entorno, mensajes MQTT) pasa por un esquema.

```js
import { z } from 'zod';

const esquema = z.object({
  codigo: z.string().regex(/^MTR-\d{2,4}$/),    // texto con formato
  sitio_id: z.number().int().positive(),        // entero mayor que 0
  ts: z.iso.datetime({ offset: true }),         // fecha ISO 8601 con zona: ...Z o ...-03:00
  pagina: z.coerce.number().default(1),         // coerce: convierte "2" (texto) en 2
  nota: z.string().optional(),                  // puede faltar
});

const r = esquema.safeParse(req.body);          // safeParse no lanza: devuelve un resultado
if (!r.success) console.log(z.flattenError(r.error).fieldErrors);  // { codigo: ['...'] }
else guardar(r.data);                           // r.data: datos limpios y con el tipo correcto
```

**Dos niveles de validación en la ingesta** (`src/comun/validacion.js`):
1. **Forma** (zod). Si un valor llega como texto, el lote entero es un error del cliente: **422**.
2. **Contenido** (`evaluarLectura`). Si el motor no existe, es de otro sitio, la variable no existe
   o la hora es absurda, se rechaza **solo esa lectura** y se guarda el resto. Un valor fuera de
   rango no se rechaza: se guarda con `calidad = 1`, porque puede ser una falla real.

### 5.4 MySQL y SQL (el historiador)

**Qué es.** Una base de datos relacional: tablas con columnas de tipo fijo y relaciones entre ellas.
Se le habla en **SQL**.

**De qué se compone:**
- **Servidor** (`mysqld`): el proceso que guarda y responde.
- **InnoDB:** el motor de almacenamiento, con transacciones y bloqueo por fila.
- **Bases:** `telemetria` (la real) y `telemetria_test` (la de las pruebas).
- **Tablas, columnas y filas.**
- **PK:** la clave primaria, que identifica cada fila.
- **Índices:** "índices de libro" para buscar sin recorrer todo.
- **FK:** claves foráneas, que obligan a que una referencia exista.
- **Usuarios y GRANT:** quién puede hacer qué.
- **Transacciones, eventos y particiones.**

**La idea más importante: el índice agrupado.** En InnoDB, la tabla se guarda físicamente ordenada por
su PK. `lecturas` tiene PK `(motor_id, variable_id, ts)`, así que las lecturas de un mismo motor y
variable quedan juntas y ordenadas por hora:

```
lecturas, ordenada en disco por (motor_id, variable_id, ts):

 motor  variable  ts                    valor
   1       1      2026-11-15 10:00:00   1500  ┐
   1       1      2026-11-15 10:00:10   1502  │ "rpm de MTR-01 entre 10:00 y 11:00"
   1       1      2026-11-15 10:00:20   1498  │ es un tramo CONTIGUO: se lee de corrido
   ...                                        ┘
   1       2      2026-11-15 10:00:00   85.2    (temperatura de MTR-01, más abajo)
   2       1      ...                           (el motor 2, más abajo todavía)
```

Esa misma PK da la **idempotencia**: no puede haber dos filas con el mismo motor, variable y hora,
así que una lectura repetida choca en vez de duplicarse.

**Tipos de datos del proyecto:**

| Tipo | Guarda | Ejemplo |
|---|---|---|
| `SMALLINT UNSIGNED` | Entero de 0 a 65.535 (2 bytes) | `motor_id` |
| `INT` y `BIGINT UNSIGNED` | Enteros más grandes | `auditoria_accesos.id` |
| `DOUBLE` | Número con decimales (8 bytes) | `valor` |
| `VARCHAR(n)` y `CHAR(n)` | Texto de largo variable o fijo | `codigo`, `password_hash CHAR(60)` |
| `DATETIME(3)` | Fecha y hora con milisegundos (en UTC) | `ts` |
| `BOOLEAN` | Verdadero o falso | `activo` |
| `ENUM(...)` | Uno de una lista cerrada | `rol` |

**SQL en 10 recetas** (todas están en `sql/` y `practica/`):

```sql
-- 1. Crear una tabla, con su PK
CREATE TABLE lecturas (
  motor_id SMALLINT UNSIGNED NOT NULL,
  variable_id SMALLINT UNSIGNED NOT NULL,
  ts DATETIME(3) NOT NULL,
  valor DOUBLE NOT NULL,
  calidad TINYINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (motor_id, variable_id, ts)
) ENGINE=InnoDB;

-- 2. Insertar sin duplicar (idempotente): si la PK ya existe, no hace nada
INSERT INTO lecturas (motor_id, variable_id, ts, valor, calidad)
VALUES (1, 1, '2026-11-15 10:00:00', 1500, 0)
ON DUPLICATE KEY UPDATE valor = valor;

-- 3. Upsert: inserta o actualiza. "AS nuevo" nombra la fila que llega
INSERT INTO estado_actual (motor_id, variable_id, ts, valor, calidad)
VALUES (1, 1, '2026-11-15 10:00:10', 1502, 0) AS nuevo
ON DUPLICATE KEY UPDATE valor = nuevo.valor, ts = nuevo.ts;

-- 4. Leer uniendo tablas (JOIN) y filtrando (WHERE)
SELECT l.ts, l.valor
FROM lecturas l
JOIN motores m ON m.id = l.motor_id AND m.codigo = 'MTR-01'
WHERE l.ts >= UTC_TIMESTAMP() - INTERVAL 1 HOUR
ORDER BY l.ts;

-- 5. Agrupar: promedio por minuto
SELECT DATE_FORMAT(ts, '%H:%i') AS minuto, AVG(valor) AS promedio, COUNT(*) AS n
FROM lecturas WHERE motor_id = 1 AND variable_id = 1
GROUP BY minuto;

-- 6. LEFT JOIN y HAVING: motores sin datos en 5 minutos, incluidos los que nunca enviaron
SELECT m.codigo, MAX(e.ts) AS ultimo
FROM motores m LEFT JOIN estado_actual e ON e.motor_id = m.id
GROUP BY m.id, m.codigo
HAVING ultimo IS NULL OR ultimo < UTC_TIMESTAMP() - INTERVAL 5 MINUTE;

-- 7. Ver el plan de una consulta
EXPLAIN SELECT ...;            -- lo que MySQL piensa hacer
EXPLAIN ANALYZE SELECT ...;    -- lo que hizo, con tiempos reales

-- 8. Transacción: todo o nada
START TRANSACTION;
INSERT INTO lecturas ...;
INSERT INTO estado_actual ...;
COMMIT;                        -- o ROLLBACK si algo falló

-- 9. Permisos mínimos para la aplicación
CREATE USER 'telemetria_app'@'%' IDENTIFIED BY '...';
GRANT SELECT, INSERT ON telemetria.auditoria_accesos TO 'telemetria_app'@'%';

-- 10. Índice, partición y tarea programada (Fase 11)
CREATE INDEX ix_lecturas_calidad_ts ON lecturas (calidad, ts);
ALTER TABLE lecturas PARTITION BY RANGE COLUMNS (ts) (PARTITION p2026_11 VALUES LESS THAN ('2026-12-01'), ...);
CREATE EVENT ev_lecturas_hora ON SCHEDULE EVERY 1 HOUR DO INSERT INTO lecturas_hora ...;
```

**Cómo leer un `EXPLAIN`.** Mira tres columnas: `type`, `key` y `rows`.

| `type` | Qué significa | ¿Bueno? |
|---|---|---|
| `const` | Una sola fila por clave única | Excelente |
| `ref` | Varias filas por un índice | Bueno |
| `range` | Un tramo de un índice | Bueno: es el caso de las series |
| `index` | Recorre todo un índice | Regular |
| `ALL` | Recorre toda la tabla (*full scan*) | Malo con millones de filas |

### 5.5 mysql2 (cómo habla Node con MySQL)

```js
import mysql from 'mysql2/promise';

// Pool: 10 conexiones abiertas que se prestan a cada consulta.
const pool = mysql.createPool({ host, user, password, database, connectionLimit: 10, timezone: 'Z' });

// execute: sentencia preparada. Los ? se mandan aparte: un valor nunca se ejecuta como SQL.
const [filas] = await pool.execute('SELECT * FROM motores WHERE codigo = ?', ['MTR-01']);

// query: escapa en el cliente; sirve para expandir arreglos (un INSERT de 5000 filas).
await pool.query('INSERT INTO lecturas (motor_id, variable_id, ts, valor, calidad) VALUES ?', [filas5000]);

// Transacción: una sola conexión para todos los pasos.
const cx = await pool.getConnection();
try {
  await cx.beginTransaction();
  await cx.query('...');
  await cx.commit();
} catch (e) {
  await cx.rollback();
  throw e;
} finally {
  cx.release();                // devuelve la conexión al pool, pase lo que pase
}
```

| | `execute` | `query` |
|---|---|---|
| Cómo manda los valores | Aparte (sentencia preparada) | Escapados dentro del texto |
| Seguro contra inyección SQL | Sí | Sí |
| Expande arreglos (`VALUES ?`) | No | Sí |
| `LIMIT ?` | Falla en MySQL 8 (lo manda como decimal) | Funciona |

**OJO:** `affectedRows` cambia de significado con el flag `-FOUND_ROWS` (`src/api/db.js`). Sin él,
cuenta las filas encontradas; con él, solo las cambiadas. Así `affectedRows` dice cuántas lecturas eran nuevas.

### 5.6 SQLite (el cuaderno del gateway)

**Qué es.** Una base de datos dentro de **un archivo**, sin servidor. Node la trae incluida (`node:sqlite`).
El gateway la usa como buffer: si el enlace se corta, los mensajes esperan ahí.

```js
import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('./datos/buffer.sqlite');      // ':memory:' en las pruebas
db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;');
const insertar = db.prepare('INSERT INTO pendientes (topico, payload, creado_en) VALUES (?, ?, ?)');
insertar.run('motores/norte/MTR-01/telemetria', '{"...":1}', new Date().toISOString());
const siguientes = db.prepare('SELECT * FROM pendientes ORDER BY id LIMIT ?').all(50);
```

- **WAL:** las escrituras van a un registro aparte; leer y escribir no se bloquean entre sí.
- **`synchronous = FULL`:** cada commit se fuerza a disco. Es más lento, pero el buffer existe para sobrevivir a un corte.

### 5.7 Seguridad: JWT, bcrypt y roles

**Tres preguntas distintas** (es lo que más se confunde en una entrevista):

| Pregunta | Nombre | Cómo se resuelve aquí | Si falla |
|---|---|---|---|
| ¿Quién eres? | Autenticar | JWT firmado (`autenticar`) | 401 |
| ¿Qué puede hacer tu rol? | Autorizar | `autorizar('admin', 'ingeniero')` | 403 |
| ¿Este objeto es tuyo? | Permiso por recurso | El sitio dentro de cada SQL (`filtroSitio`) | 404 |

El tercer punto evita **BOLA** (Broken Object Level Authorization), el riesgo número 1 del OWASP API
Top 10: tener el rol correcto no basta, cada consulta debe preguntar si ese objeto es del usuario.

**Anatomía de un JWT.** Tres partes en base64url separadas por puntos. El contenido **no está
cifrado**, solo firmado: cualquiera lo lee, pero nadie lo cambia sin el secreto.

```
eyJhbGciOiJIUzI1NiIs...  .  eyJ1c3VhcmlvIjoiaW5nLW5vcnRlIiwicm9s...  .  q2J8vX...
└──── encabezado ─────┘     └────────────── contenido ──────────────┘     └ firma ┘
{"alg":"HS256",             {"usuario":"ing-norte","rol":"ingeniero",      HMAC-SHA256(encabezado.contenido,
 "typ":"JWT"}                "sitio":1,"sub":"2","exp":1794834222}                     JWT_SECRETO)
```

**Cómo leer este dibujo.** La primera fila es el token tal como viaja. La segunda nombra sus tres
partes y la tercera muestra qué hay dentro de cada una:
1. **Encabezado:** con qué algoritmo se firmó (`HS256`) y qué tipo de token es.
2. **Contenido (payload):** los datos, que se llaman *claims*. `usuario`, `rol` y `sitio` son del
   proyecto. `sub` (*subject*) es el id del usuario, y `exp`, el vencimiento, en segundos desde el
   1 de enero de 1970 (hora Unix).
3. **Firma:** un **HMAC-SHA256**, una huella de las dos primeras partes calculada con `JWT_SECRETO`,
   que solo conoce la API. Si alguien cambia una letra del contenido (por ejemplo, para darse
   `"rol":"admin"`), la firma deja de calzar y la API responde 401.

**base64url** escribe cualquier dato con letras, números, `-` y `_`, para que viaje sin problemas en
una URL o un encabezado. Es una **codificación**, no un cifrado: se revierte sin clave. Por eso un JWT
nunca lleva secretos.

**Login y uso del token:**

```mermaid
sequenceDiagram
  participant N as Navegador
  participant A as API
  participant D as MySQL
  N->>A: POST /api/auth/login con usuario y clave
  A->>D: SELECT del hash bcrypt del usuario
  A->>A: bcrypt.compare(clave, hash)
  A-->>N: 200 con el token (vence en 15 min)
  N->>A: GET /api/motores con Authorization Bearer
  A->>A: autenticar verifica la firma y el vencimiento
  A->>A: autorizar revisa el rol y el SQL filtra por sitio
  A-->>N: 200 con los motores de su sitio
```

**Cómo leer este diagrama.** Hay dos momentos: arriba el **login** (una vez) y abajo **cada petición** posterior.
1. El navegador manda usuario y clave a `/api/auth/login`.
2. La API busca en MySQL el **hash** guardado de ese usuario. Nunca guarda ni lee la clave en sí.
3. `bcrypt.compare` calcula el hash de la clave recibida y lo compara con el guardado.
4. Si coinciden, la API responde un **token JWT** que vence en 15 minutos.
5. En cada petición siguiente, el navegador manda el token en el encabezado `Authorization: Bearer <token>`.
6. **autenticar** revisa la firma y el vencimiento del token. Así sabe quién eres sin volver a la base.
7. **autorizar** revisa tu rol, y el SQL agrega el filtro de tu sitio.
8. La respuesta trae solo lo tuyo.

**Lo que aparece:**
- **Hash:** una huella de una sola vía: de la clave sale el hash, pero del hash no se puede volver a la clave.
- **bcrypt:** el algoritmo de hash para contraseñas; es lento a propósito, para frenar los ataques.
- **Token JWT:** un "pase" firmado por la API que dice quién eres, tu rol y tu sitio.
- **Bearer:** "portador": quien presenta el token lo usa.

**Las piezas:**
- **bcrypt (costo 12):** guarda una huella lenta y con sal de cada contraseña. SHA-256 sirve para
  claves de API largas y aleatorias, pero no para contraseñas humanas: es demasiado rápido de atacar.
- **El mismo 401** para usuario inexistente o clave mala, y un hash señuelo: ni el mensaje ni el
  tiempo de respuesta revelan qué usuarios existen.
- **Límite de intentos:** 5 logins fallidos cada 15 minutos por IP; el sexto responde 429.
- **helmet:** encabezados de seguridad. La **CSP** solo deja correr scripts propios, por eso el
  dashboard no tiene JavaScript dentro del HTML.
- **Auditoría:** cada acceso queda en `auditoria_accesos`, y la aplicación solo puede insertar ahí.

```js
// Firmar y verificar (src/api/auth.js)
const token = jwt.sign({ usuario, rol, sitio }, secreto, { algorithm: 'HS256', expiresIn: 900, subject: String(id) });
const datos = jwt.verify(token, secreto, { algorithms: ['HS256'] });   // lista explícita: rechaza "alg: none"
```

### 5.8 MQTT y Mosquitto (el transporte)

**Qué es.** Un protocolo de **publicar y suscribir**. Los clientes no hablan entre sí: publican en un
**tópico** y el **broker** (Mosquitto) entrega cada mensaje a los suscritos. Es una radio con canales.

```mermaid
flowchart LR
  G1["gw-norte"] -->|"publica en<br/>motores/norte/MTR-01/telemetria"| B[("Broker<br/>Mosquitto")]
  G2["gw-sur"] -->|"publica en<br/>motores/sur/MTR-03/telemetria"| B
  B -->|"suscrita a<br/>motores/+/+/telemetria"| API["API"]
  B -->|"suscrito a todo<br/>lo del sitio norte"| EMS["EMS del norte"]
```

**Cómo leer este diagrama.** A la izquierda están los que **publican**, al centro el **broker** y a la
derecha los **suscritos**. El texto de cada flecha es un tópico: hacia el broker, dónde se publica;
desde el broker, a qué se suscribió cada uno.

**La idea clave:** los gateways no saben quién los escucha, y la API no sabe quién publica. Solo
comparten los tópicos. Por eso se pueden agregar consumidores (un EMS) o fuentes (Node-RED) sin tocar
las demás piezas. Eso es el **desacoplamiento**.

**Lo que aparece:**
- **Publicar:** enviar un mensaje a un tópico.
- **Suscribirse:** pedirle al broker los mensajes de uno o más tópicos.
- **Broker (Mosquitto):** el intermediario que recibe y reparte; también aplica los usuarios y permisos (ACL).
- **`+`:** comodín de un nivel del tópico: `motores/+/+/telemetria` calza con la telemetría de cualquier sitio y motor.

**Conceptos:**

| Concepto | Qué es | En el proyecto |
|---|---|---|
| Tópico | Una ruta de texto con niveles | `motores/norte/MTR-01/telemetria` |
| `+` | Comodín de un nivel | `motores/+/+/telemetria` = la telemetría de todo |
| `#` | Comodín de todo lo que sigue (va al final) | `motores/norte/#` = todo el sitio norte |
| Retenido | El broker guarda el último mensaje y se lo da a cada suscriptor nuevo | Estado de los gateways y alertas |
| Last Will | Mensaje que el broker publica si el cliente cae sin avisar | `offline` del gateway |
| Sesión persistente | Con `clientId` fijo y `clean: false`, el broker guarda los QoS 1 mientras estás desconectado | La API (`api-ingesta`) |
| ACL | Lista de qué tópicos puede leer o escribir cada usuario | `mosquitto/acl` |

**Los tres niveles de QoS:**

| QoS | Garantía | Viajes | Uso |
|---|---|---|---|
| 0 | A lo más una vez (puede perderse) | 1 | Datos que no importa perder |
| **1** | **Al menos una vez** (puede repetirse) | 2 | **El proyecto**: la PK absorbe los repetidos |
| 2 | Exactamente una vez (hasta el broker) | 4 | Rara vez vale lo que cuesta |

```mermaid
sequenceDiagram
  participant P as Gateway (publica)
  participant B as Broker
  participant S as API (suscrita)
  P->>B: PUBLISH QoS 1 (id 7)
  B-->>P: PUBACK id 7
  B->>S: PUBLISH QoS 1
  S-->>B: PUBACK
  Note over P,B: Si el PUBACK no llega, el gateway reenvía y puede haber un duplicado. La base lo absorbe.
```

**Cómo leer este diagrama.** Hay dos tramos independientes, cada uno con su propio acuse de recibo:
del gateway al broker, y del broker a la API.
1. El gateway publica con **QoS 1** y un número de mensaje (id 7).
2. El broker responde **PUBACK** con el mismo id: "lo tengo".
3. El broker reenvía el mensaje a cada suscrito, también con QoS 1.
4. La API responde su propio PUBACK.

**Lo que aparece:**
- **QoS (Quality of Service):** el nivel de garantía de entrega. Con QoS 1, si no llega el acuse, se reenvía.
- **Id del mensaje:** un número que empareja cada envío con su acuse.
- **Duplicado:** si se pierde el PUBACK, el mensaje ya había llegado y se reenvía igual. Por eso la base
  tiene que ser **idempotente**: la PK ignora la lectura repetida.

**La sesión persistente, en acción** (probado: 20 mensajes con la API apagada, llegaron los 20):

```mermaid
sequenceDiagram
  participant G as Gateway
  participant B as Broker
  participant A as API (clientId fijo, clean false)
  A->>B: CONNECT y SUBSCRIBE con QoS 1
  Note over A: La API se cae o se reinicia
  G->>B: PUBLISH de 20 mensajes QoS 1
  B->>B: Los guarda para la sesión api-ingesta
  A->>B: CONNECT con el mismo clientId
  B-->>A: CONNACK, sesión presente
  B->>A: Entrega los 20 mensajes guardados
```

**Cómo leer este diagrama.**
1. La API se conecta con un **clientId** fijo (`api-ingesta`) y `clean: false`, que significa
   "recuérdame", y se suscribe con QoS 1.
2. La nota marca el problema: la API se cae o se reinicia.
3. El gateway sigue publicando. El broker ve que `api-ingesta` está suscrita pero desconectada, y
   **guarda** los mensajes en la cola de esa sesión (y en disco, por `persistence true`).
4. La API vuelve con el mismo clientId. El **CONNACK** dice "sesión presente": el broker la recordó.
5. El broker entrega todo lo guardado, en orden.

**Lo que aparece:**
- **clientId:** el nombre con que el broker reconoce a un cliente. Si dos procesos usan el mismo, se expulsan entre sí.
- **CONNECT y CONNACK:** el pedido de conexión y la respuesta del broker.
- **Cola de la sesión:** los mensajes que esperan a un cliente desconectado. El tope es
  `max_queued_messages` (100.000 en este proyecto).

**Configuración de Mosquitto** (`mosquitto/mosquitto.conf` y `mosquitto/acl`):

```
# mosquitto.conf (OJO: los comentarios van en su propia línea)
# Escuchar en el puerto 1883, sin anónimos
listener 1883
allow_anonymous false
# Usuarios y hashes (plugin de la 2.1)
plugin /usr/lib/mosquitto_password_file.so
plugin_opt_password_file /mosquitto/config/passwd
# Permisos por tópico
plugin /usr/lib/mosquitto_acl_file.so
plugin_opt_acl_file /mosquitto/config/acl
# Sesiones y mensajes pendientes a disco
persistence true

# acl: lista blanca por usuario; lo que no está escrito, está prohibido
user gw-norte
topic write motores/norte/#
```

**Cliente MQTT en Node** (`mqtt.js`):

```js
import mqtt from 'mqtt';
const cliente = mqtt.connect('mqtt://127.0.0.1:1883', {
  clientId: 'api-ingesta', clean: false,        // sesión persistente
  username: 'api', password: process.env.MQTT_CLAVE,
  will: { topic: '.../estado', payload: 'offline', qos: 1, retain: true },   // Last Will (en el gateway)
});
cliente.on('connect', () => cliente.subscribe({ 'motores/+/+/telemetria': { qos: 1 } }));
cliente.on('message', (topico, payload) => procesar(topico, JSON.parse(payload)));
await cliente.publishAsync('motores/norte/MTR-01/telemetria', JSON.stringify(msg), { qos: 1 });
```

**Usuarios del broker:** `api` (lee todo y publica solo `motores/+/alertas`), `gw-norte` (escribe en
su sitio), `gw-sur` (escribe en sur), `nodered` (escribe un solo tópico). Ver `docs/topicos.md`.

### 5.9 Modbus (hablar con el PLC)

**Qué es.** El protocolo industrial más usado. Un **maestro** (el gateway) pregunta y un **esclavo**
(el controlador) responde. Nadie habla sin que le pregunten: es pasar lista.

**De qué se compone:**
- **Unit ID:** el número de cada equipo (1 = MTR-01, 2 = MTR-02).
- **Código de función:** qué se pide; 03 = leer holding registers.
- **Dirección:** desde qué registro; 0 es el "40001" de los manuales.
- **Cantidad:** cuántos registros.
- **Registros:** de 16 bits sin signo, de 0 a 65.535.

| Tipo de dato | Tamaño | Acceso | Función para leer | Ejemplo |
|---|---|---|---|---|
| Coil | 1 bit | lectura y escritura | 01 | Arrancar o parar |
| Discrete input | 1 bit | solo lectura | 02 | Un contacto |
| Input register | 16 bits | solo lectura | 04 | Una medición |
| **Holding register** | **16 bits** | **lectura y escritura** | **03** | **El proyecto usa estos** |

**Una pregunta y su respuesta en Modbus TCP**, en bytes:

```
Pregunta: "Unit 1, función 03, desde la dirección 0, 8 registros"
┌─────────── encabezado MBAP ───────────┐┌─────────── PDU ───────────┐
│ transacción │ protocolo │ largo │ unit ││ función │ dirección │ cant. │
│    00 01    │   00 00   │ 00 06 │  01  ││   03    │   00 00   │ 00 08 │

Respuesta: función 03, 16 bytes de datos (8 registros × 2 bytes)
│ ... │ 01 ││ 03 │ 10 │ 05 DC │ 03 54 │ 01 A4 │ 0A 7D │ 00 40 │ E6 AE │ 46 40 │ 00 00 │
                        1500    852     420    2685    64     reg5    reg6    alarmas
```

**Cómo leer este dibujo.** Cada par de caracteres es un **byte** (8 bits: un número de 0 a 255)
escrito en **hexadecimal**, la base 16, que usa los dígitos 0 a 9 y las letras A a F (`0A` = 10,
`10` = 16, `FF` = 255). El prefijo `0x` marca un número hexadecimal. Un registro ocupa dos bytes:
`05 DC` = `0x05DC` = 1500.
- **Encabezado MBAP** (*Modbus Application Protocol*), que solo existe en Modbus TCP. La
  **transacción** empareja cada respuesta con su pregunta; el **protocolo** siempre es 0 (Modbus); el
  **largo** cuenta los bytes que vienen después, incluido el unit (aquí, 6); y el **unit** es el
  Unit ID del equipo.
- **PDU** (*Protocol Data Unit*): la pregunta en sí, igual en TCP y en RS485. Lleva la función (03),
  la dirección de inicio (0) y la cantidad de registros (8).
- **La respuesta** empieza con el mismo MBAP (resumido como `...`), repite el unit y la función, dice
  cuántos bytes de datos trae (`10` = 16) y entrega los 8 registros, de dos bytes cada uno. Debajo va
  cada valor en decimal. Los registros 5 y 6 se leen juntos, porque forman el float32 de las horas, y
  el 7 trae las alarmas (0 = ninguna).

**El mapa de registros del proyecto:**

| Registro | Variable | Tipo | Escala | Ejemplo |
|---|---|---|---|---|
| 0 | rpm | uint16 | ×1 | 1500 → 1500 rpm |
| 1 | temp_refrigerante | int16 con signo | ×0,1 | 852 → 85,2 °C |
| 2 | presion_aceite | uint16 | ×1 | 420 → 420 kPa |
| 3 | voltaje_bateria | uint16 | ×0,01 | 2685 → 26,85 V |
| 4 | carga | uint16 | ×1 | 64 → 64 % |
| 5 y 6 | horas_motor | float32, palabras invertidas (CDAB) | — | 12.345,67 h |
| 7 | alarmas | 16 bits, uno por alarma | — | 0b101 = sobretemperatura y sobrevelocidad |

`0x7FFF` (32.767) en un registro significa "sin dato" (un sensor cortado): esa lectura se omite.

**Los dos trucos de los datos:**

```
1. Números negativos (complemento a dos): de 0x8000 en adelante, el registro es negativo.
   −5,0 °C × 10 = −50  →  65.536 − 50 = 65.486 en el registro  →  65.486 − 65.536 = −50 → −5,0 °C

2. Un float32 ocupa dos registros (4 bytes: A B C D). 12.345,67 = 46 40 E6 AE
   ABCD: registro 5 = 0x4640, registro 6 = 0xE6AE
   CDAB: registro 5 = 0xE6AE, registro 6 = 0x4640     ← así lo manda el simulador
   Leer CDAB como si fuera ABCD da −4,1 × 10²³, sin ningún error: el bug clásico.
```

**En simple:**
- Un registro solo guarda enteros de 0 a 65.535. Para enviar negativos, el equipo y quien lo lee
  acuerdan que la mitad de arriba (32.768 a 65.535) representa del −32.768 al −1. Ese acuerdo es el
  **complemento a dos**, y el tipo se llama **int16**.
- Un **float32** (un número con decimales, de 4 bytes) no cabe en un registro, así que viaja en dos, y
  cada fabricante elige en qué orden van las mitades. El manual del equipo dice cuál usa; si no lo
  dice, se prueba con un valor conocido.

**Sintaxis** (`modbus-serial`):

```js
import ModbusRTU from 'modbus-serial';
const cliente = new ModbusRTU();
await cliente.connectTCP('127.0.0.1', { port: 5020 });
cliente.setID(1);                                         // Unit ID
const { data } = await cliente.readHoldingRegisters(0, 8); // función 03: dirección 0, 8 registros
// data = [1500, 852, 420, 2685, 64, 59054, 17984, 0]
```

**Por RS485** (Modbus RTU, `docs/rs485.md`): mismo protocolo, pero por un cable serie. Cambian el
puerto (`/dev/ttyUSB0`), los baudios y la paridad, la terminación de 120 Ω, la polaridad A/B, y
solo puede haber un maestro.

### 5.10 CAN y J1939 (escuchar a la ECU del motor)

**Qué es.** CAN es un bus donde todos transmiten sin que nadie pregunte: la ECU anuncia sus datos
varias veces por segundo. Si dos hablan a la vez, gana el identificador más bajo (más prioritario).
**J1939** es el "diccionario" de los motores diésel sobre CAN.

**El identificador de 29 bits**, con el ejemplo `0x0CF00400`:

```
 prioridad │ R │ DP │    PF    │    PS    │ origen (SA)
    011    │ 0 │ 0  │ 11110000 │ 00000100 │  00000000
     3                  240         4           0
PF ≥ 240 → el mensaje es para todos y el PGN incluye a PS:
PGN = 0xF0 × 256 + 0x04 = 0xF004 = 61444 → EEC1 (velocidad del motor)
```

**Cómo leer este dibujo.** El identificador `0x0CF00400` es un número de 29 bits que se reparte en
seis campos, de izquierda a derecha. La primera fila nombra cada campo; la segunda, sus bits; y la
tercera, su valor en decimal.
- **Prioridad** (3 bits): de 0 a 7; mientras más bajo, más urgente. Aquí, 3.
- **R y DP** (1 bit cada uno): un bit reservado y la página de datos. Aquí, ambos en 0.
- **PF** (*PDU Format*) y **PS** (*PDU Specific*), de 8 bits cada uno: juntos dicen qué mensaje es.
- **SA** (*Source Address*, 8 bits): quién lo envía. 0 es el motor.

Si PF es 240 o más, el mensaje es un **anuncio para todos** (broadcast) y PS forma parte del número
del mensaje, el **PGN**. Si PF es menor, PS es la dirección del destinatario.

| Término | Qué es | Ejemplo |
|---|---|---|
| PGN | Qué mensaje es | 61444 = EEC1, 65262 = ET1 |
| SPN | Qué variable va dentro, en qué bytes y con qué escala | 190 = rpm, 110 = temperatura del refrigerante |
| SA | Quién lo envía | 0 = motor 1 |
| Little-endian | El byte bajo va primero | `E0 2E` se lee `0x2EE0` |

**Decodificar las rpm de una trama EEC1:**

```
datos:   F0  7D  7D  E0  2E  FF  FF  FF
índice:   0   1   2   3   4   5   6   7
SPN 190 = bytes 4 y 5 (índices 3 y 4) = E0 2E → little-endian → 0x2EE0 = 12.000
12.000 × 0,125 rpm/bit = 1500 rpm      (0xFFFF = "no disponible" → null)
```

**Cómo leerlo.** Una trama CAN trae hasta 8 bytes de datos. J1939 define en qué bytes va cada
variable (su SPN) y cuánto vale cada unidad:
1. **Ubicar** los bytes: la norma los cuenta desde 1 y el código desde 0. Por eso los "bytes 4 y 5"
   son los índices 3 y 4.
2. **Juntarlos al revés**, porque J1939 es little-endian: `E0 2E` → `0x2EE0`.
3. **Pasar** de hexadecimal a decimal: `0x2EE0` = 12.000.
4. **Multiplicar** por la escala de la norma, 0,125 rpm por unidad: 1500 rpm.

**El formato de `candump`** (`practica/candump-ejemplo.log`):

```
(1794744000.000000) can0 0CF00400#F07D7DE02EFFFFFF
 └ hora (segundos) ┘ └┬┘ └── id ─┘ └── 8 bytes ──┘
                   interfaz
```

En Linux, una interfaz CAN se maneja con **SocketCAN**: `candump` graba y `canplayer` reproduce.

### 5.11 WebSocket (datos en vivo al navegador)

**Qué es.** HTTP es mandar cartas: el navegador pregunta y el servidor responde. **WebSocket** es una
llamada telefónica abierta: después de un saludo HTTP (el *upgrade*), el servidor puede hablar
cuando quiera.

```mermaid
sequenceDiagram
  participant N as Navegador
  participant X as nginx (en producción)
  participant A as API
  N->>X: GET /ws?token=... con Upgrade websocket
  X->>A: Reenvía con los encabezados Upgrade y Connection
  A->>A: Verifica el JWT ANTES de aceptar
  alt token válido
    A-->>N: 101 Switching Protocols
    A-)N: Mensajes JSON cada vez que hay datos nuevos
    loop cada 30 s
      A->>N: ping
      N-->>A: pong
    end
  else token inválido o vencido
    A-->>N: 401 y cierra el socket
  end
```

**Cómo leer este diagrama.** El bloque `alt` muestra dos caminos posibles (token válido o no) y el
bloque `loop`, algo que se repite. La flecha de punta abierta es un envío que no espera respuesta.
1. El navegador hace un GET normal a `/ws`, con el encabezado `Upgrade: websocket` ("cambiemos de
   protocolo") y el token en la URL.
2. En producción, nginx lo reenvía conservando los encabezados `Upgrade` y `Connection`. Sin ellos, el
   cambio fallaría.
3. La API verifica el token **antes** de aceptar.
4. **Si es válido,** responde **101 Switching Protocols**. Desde ahí la conexión queda abierta y la API
   envía datos cada vez que hay algo nuevo. Cada 30 s manda un **ping** y el navegador responde
   **pong**; quien no responde se da por desconectado.
5. **Si no es válido,** responde 401 y cierra.

**Lo que aparece:**
- **Upgrade:** el pedido para pasar de HTTP a WebSocket en la misma conexión.
- **101 Switching Protocols:** la respuesta que acepta el cambio.
- **Ping y pong:** el latido que detecta las conexiones muertas.
- **nginx:** el servidor que va delante de la API en producción (sección 5.14).

**Los mensajes que recibe el dashboard:** `bienvenida` (quién eres), `lecturas` (últimos valores de un
motor), `gateway` (`online` u `offline`) y `alerta` (un motor se calló o volvió).

```js
// Servidor (src/api/tiempo-real.js), con la librería ws
const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
servidorHttp.on('upgrade', (req, socket, head) => {
  // verificar el token; si no sirve: escribir "HTTP/1.1 401" y socket.destroy()
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});
ws.send(JSON.stringify({ tipo: 'lecturas', motor: 'MTR-01', lecturas: [] }));

// Navegador (public/app.js)
const socket = new WebSocket(`ws://${location.host}/ws?token=${token}`);
socket.addEventListener('message', (e) => pintar(JSON.parse(e.data)));
```

**Detalles que importan:**
- Se autentica en el *upgrade*: no hay sockets abiertos de desconocidos.
- Cada mensaje se filtra por el sitio del usuario.
- La conexión se cierra (código 4001) cuando vence el token.
- El ping de cada 30 s detecta conexiones muertas.

### 5.12 Node-RED (el gateway en bloques)

**Qué es.** Programación visual: **nodos** unidos por cables, y por los cables viaja un objeto **`msg`**
(con `msg.payload` dentro). Es como programar un PLC en bloques: se ve el flujo completo de un vistazo.

```mermaid
flowchart LR
  I["inject<br/>cada 2 s<br/>(payload: la hora)"] --> M["Modbus Getter<br/>Unit 2, FC3,<br/>dirección 0, 8 reg."]
  M -->|"msg.payload =<br/>8 registros"| F["function<br/>decodificar"]
  F -->|"msg.payload =<br/>JSON del mensaje"| Q["mqtt out<br/>motores/norte/MTR-02/telemetria<br/>QoS 1"]
```

**Cómo leer este diagrama.** Cada caja es un **nodo**, y cada cable lleva un objeto **`msg`**. El texto
de los cables dice qué trae `msg.payload` en ese tramo.
1. **inject:** un reloj que dispara un mensaje cada 2 s. Su payload es la hora; sin payload, el nodo
   siguiente lo ignoraría.
2. **Modbus Getter:** al recibir el mensaje, lee 8 holding registers del Unit 2 (MTR-02) con la
   función 03, y deja los 8 números en `msg.payload`.
3. **function:** código JavaScript que decodifica los registros y arma el JSON del mensaje.
4. **mqtt out:** publica ese JSON en el tópico de MTR-02, con QoS 1.

**Lo que aparece:**
- **Nodo:** un bloque que hace una sola cosa.
- **`msg` y `msg.payload`:** el objeto que viaja por los cables y su contenido principal.
- **Nodos de configuración:** el cliente Modbus (`simulador:5020`) y el broker (`mosquitto:1883`). No se
  dibujan en el lienzo, pero los nodos los usan para conectarse.
- **Desplegar (deploy):** activar el flujo en el servidor de Node-RED.

```js
// Nodo function (flows/funcion-decodificar.js): recibe msg y devuelve el msg que sigue
const r = msg.payload;                                  // los 8 registros
msg.payload = { motor: 'MTR-02', gateway: 'node-red', ts: new Date().toISOString(), lecturas: { rpm: r[0] } };
return msg;                                             // return null corta el flujo
```

**Detalles:**
- El flujo se despliega con `npm run nodered:desplegar`, por la Admin API (`POST /flows`), y las credenciales MQTT se inyectan en ese momento.
- *Modbus Read* sondea solo; con un inject se usa *Modbus Getter*. El inject debe mandar un payload: el Getter descarta en silencio los mensajes sin él.
- El editor no tiene contraseña: por eso el puerto 1880 escucha solo en `127.0.0.1`.

### 5.13 Docker y Docker Compose (todo en cajas iguales)

**Qué es.** Docker empaqueta una aplicación con todo lo que necesita (sistema, Node, librerías) en una
**imagen**, y la ejecuta como **contenedor**. Es un equipo que llega armado de fábrica: funciona igual
en cualquier lugar.

```mermaid
flowchart LR
  DF["Dockerfile<br/>(la receta)"] -->|"docker build"| IMG["Imagen telemetria-app<br/>(plantilla de solo lectura)"]
  IMG -->|"compose up"| API["Contenedor api"]
  IMG --> GWC["Contenedor gateway"]
  IMG --> SIMC["Contenedor simulador"]
  GWC --- VG[("Volumen<br/>datos-gateway")]
  MY["Contenedor mysql<br/>(imagen oficial)"] --- VM[("Volumen<br/>datos-mysql")]
```

**Cómo leer este diagrama.** Se lee de izquierda a derecha: de la receta al programa corriendo. La línea
sin punta de flecha une un contenedor con su volumen.
1. El **Dockerfile** es la receta: qué sistema base usar, qué copiar y qué comando ejecutar.
2. `docker build` sigue la receta y produce una **imagen**, una plantilla de solo lectura.
3. De una misma imagen salen **tres contenedores**: la API, el gateway y el simulador. Solo cambia el
   comando con que arranca cada uno.
4. Los **volúmenes** guardan lo que debe sobrevivir a un contenedor: el buffer del gateway y los datos de MySQL.
5. MySQL usa una **imagen oficial** ya hecha (`mysql:8.4`), así que no necesita un Dockerfile propio.

| Concepto | Qué es | En el proyecto |
|---|---|---|
| Imagen | Plantilla de solo lectura, en capas | `telemetria-app` (desde `node:26-trixie-slim`) |
| Contenedor | Una imagen en ejecución; su escritura se pierde al borrarlo | `telemetria-api-1`, `telemetria-mysql-1`... |
| Volumen | Disco que sobrevive al contenedor | `datos-mysql`, `datos-gateway`, `datos-nodered` |
| Red | DNS interno: cada servicio es un nombre | La API llega a `mysql:3306` y `mosquitto:1883` |
| Compose | Un archivo que describe todos los servicios | `docker-compose.yml` |
| Perfil | Un grupo de servicios que se levanta solo si se pide | `completo` y `nodered` |

**El Dockerfile, línea por línea:**

```dockerfile
FROM node:26-trixie-slim                 # base: Debian 13 con Node 26, sin compiladores
WORKDIR /app                             # carpeta de trabajo dentro de la imagen
COPY package.json package-lock.json ./   # primero solo las dependencias...
RUN npm ci --omit=dev                    # ...así esta capa queda en caché si el código cambia
COPY src ./src                           # después el código
COPY public ./public
USER node                                # no corre como root
CMD ["node", "src/api/server.js"]        # forma exec: node recibe el SIGTERM de docker stop
```

**Un servicio de Compose:**

```yaml
api:
  build: .                               # construye con el Dockerfile
  profiles: ["completo"]                 # solo con --profile completo
  environment:
    DB_HOST: mysql                       # el nombre del servicio, no 127.0.0.1
    DB_CLAVE: ${DB_CLAVE}                # Compose la toma de tu .env
  ports: ["3000:3000"]                   # puerto de tu equipo : puerto del contenedor
  depends_on:
    mysql: { condition: service_healthy }  # espera a que MySQL esté sano
```

| Comando | Qué hace |
|---|---|
| `docker compose up -d --wait` | Levanta la base (MySQL y Mosquitto) y espera a que estén sanos |
| `docker compose --profile completo up -d --build` | Todo el sistema, reconstruyendo la imagen |
| `docker compose ps` / `logs -f api` | Estado y logs |
| `docker compose restart api` | Reinicia un servicio (apagado ordenado con SIGTERM) |
| `docker compose exec mysql mysql -u telemetria_app -p telemetria` | Entra al cliente de MySQL del contenedor |
| `docker compose down` | Borra contenedores y redes; **los volúmenes quedan** |
| `docker compose down -v` | **También borra los volúmenes: se pierde la base** |

### 5.14 Linux: systemd, nginx, journald y cron (el despliegue)

**Qué es.** En producción, la API y el gateway corren como **servicios de systemd** detrás de **nginx**.
MySQL y Mosquitto siguen en Docker.

```mermaid
flowchart LR
  U["Usuario"] -->|"80 / 443"| FW["ufw<br/>firewall"]
  FW --> NG["nginx<br/>proxy inverso"]
  NG -->|"127.0.0.1:3000"| API["telemetria-api<br/>(systemd)"]
  GWS["telemetria-gateway<br/>(systemd)"] -->|"MQTT"| MQ[("Mosquitto<br/>en Docker")]
  API --> DB[("MySQL<br/>en Docker")]
  API --> MQ
  CR["cron 03:00"] -->|"respaldo.sh"| BK[("/var/backups")]
```

**Cómo leer este diagrama.** Se lee desde el usuario, a la izquierda, hacia adentro del servidor.
1. Toda conexión pasa primero por **ufw**, el firewall, que solo deja entrar los puertos web (80 y 443) y el de SSH.
2. **nginx** recibe la petición y la reenvía a la API, que solo escucha en `127.0.0.1:3000`. No se puede
   llegar a la API sin pasar por nginx.
3. La API y el gateway son dos **servicios de systemd**: si caen, systemd los levanta de nuevo.
4. MySQL y Mosquitto siguen corriendo en **Docker**.
5. Cada día a las 03:00, **cron** ejecuta `respaldo.sh`, que deja una copia comprimida de la base en `/var/backups`.

**Lo que aparece:**
- **Firewall:** el filtro que decide qué conexiones pueden entrar al servidor.
- **Proxy inverso:** un servidor que recibe en nombre de otro y le reenvía. Centraliza TLS, límites y logs.
- **`127.0.0.1`:** la dirección "este mismo equipo". Lo que escucha ahí no es visible desde la red.
- **Servicio de systemd:** un programa que Linux arranca, supervisa y reinicia solo.
- **cron:** el programador de tareas de Linux.

| Pieza | Qué hace | Archivo |
|---|---|---|
| systemd | Arranca, reinicia (a los 5 s) y encierra el servicio | `deploy/telemetria-api.service` |
| journald | Junta los logs de los servicios | `journalctl -u telemetria-api -f` |
| nginx | Única puerta: reenvía HTTP y WebSocket a la API | `deploy/nginx-telemetria.conf` |
| ufw | Firewall: solo SSH, 80 y 443 | — |
| cron | Tareas programadas (el respaldo diario) | `deploy/respaldo.sh` |
| Enlace simbólico | `/opt/telemetria/actual` → la versión vigente; volver atrás = cambiar el enlace | `deploy/desplegar.sh` |

```ini
# Unidad de systemd (resumen). OJO: comentarios solo en su propia línea.
[Service]
User=telemetria
WorkingDirectory=/opt/telemetria/actual
EnvironmentFile=/etc/telemetria/api.env
ExecStart=/usr/bin/node src/api/server.js
Restart=always
RestartSec=5
NoNewPrivileges=true
ProtectSystem=strict
```

```nginx
# nginx: el WebSocket necesita HTTP/1.1 y estos dos encabezados
location /ws {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

### 5.15 Git (la bitácora del código)

**Qué es.** El control de versiones: cada **commit** es una intervención anotada con autor, fecha y
motivo. Una **rama** es trabajo en el taller que no toca el equipo en operación hasta el **merge**,
y un **tag** marca una versión. El flujo recomendado para las próximas fases:

```mermaid
gitGraph
  commit id: "docs: plan"
  commit id: "chore: esqueleto" tag: "fase-01"
  branch fase-02-mysql
  checkout fase-02-mysql
  commit id: "feat(db): esquema"
  commit id: "feat(db): consultas"
  checkout main
  merge fase-02-mysql tag: "fase-02"
  commit id: "feat(api): base de Express" tag: "fase-03"
```

**Cómo leer este diagrama.** Cada punto es un **commit**, y el tiempo avanza de izquierda a derecha. La
línea principal es `main`; la que se separa es una **rama** de trabajo (`fase-02-mysql`). Donde
vuelven a juntarse hay un **merge**, y las etiquetas son **tags** que marcan versiones.
1. En `main` quedan el plan y el esqueleto, con el tag `fase-01`.
2. Se abre la rama `fase-02-mysql` y se trabaja ahí sin tocar `main`.
3. Se revisa en GitHub con un **PR** (pull request) y se integra con un merge, que recibe el tag `fase-02`.
4. Se sigue con la fase siguiente.

**Lo que aparece:**
- **Commit:** una foto del código, con autor, fecha y mensaje.
- **Rama:** una línea de trabajo paralela.
- **Merge:** traer los commits de una rama a otra.
- **PR (pull request):** la solicitud de revisión antes del merge.
- **Tag:** un nombre fijo para un commit, como `v1.0.0`.

| Tipo de commit (Conventional Commits) | Para qué |
|---|---|
| `feat:` | Una función nueva |
| `fix:` | Un arreglo |
| `docs:` | Documentación |
| `test:` | Pruebas |
| `refactor:` | Cambiar el código sin cambiar lo que hace |
| `perf:` | Rendimiento |
| `build:` / `chore:` / `ops:` | Construcción, mantenimiento y operación |

```bash
git switch -c fase-15-mejora        # rama nueva
git add -p                          # elegir qué cambios van al commit
git commit -m "feat: ..."           # el commit
git push -u origin fase-15-mejora   # subirla y abrir el PR en GitHub
git tag -a fase-15 -m "..."         # marcar la versión
git push --follow-tags              # subir los tags
```

### 5.16 Pruebas automáticas

**Qué es.** Código que prueba el código. `npm test` corre las 68 pruebas con el runner que trae Node
(`node:test`), las comparaciones de `node:assert` y `supertest`, que le habla a Express sin abrir un puerto.

```js
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

const app = crearApp();
after(() => cerrarPool());                          // sin esto, el proceso de pruebas no termina

test('POST con un código repetido responde 409', async () => {
  const res = await request(app).post('/api/motores').set(admin).send({ codigo: 'MTR-01', modelo: 'X', sitio_id: 1 });
  assert.equal(res.status, 409);
});
```

| Archivo | Pruebas | Qué cubre |
|---|---|---|
| `motores.test.js` | 11 | CRUD: 200, 201, 204, 400, 404, 409, 422 |
| `seguridad.test.js` | 15 | Token alterado o vencido, `alg: none`, roles, sitio, 429, auditoría, trust proxy |
| `ingesta.test.js` | 10 | Lote mixto, idempotencia, estado que no retrocede |
| `loteador.test.js` | 6 | Lotes, una escritura a la vez, reintento en orden, tope de memoria |
| `decodificacion.test.js` | 7 | Complemento a dos, float32 en los dos órdenes, 0x7FFF |
| `buffer.test.js` | 2 | Orden de llegada, confirmar y tope |
| `j1939.test.js` | 9 | Id de 29 bits, EEC1, ET1, candump |
| `tiempo-real.test.js` | 3 | 401 en el upgrade y filtro por sitio |
| `operacion.test.js` | 5 | `/api/listo`, `/api/metricas`, claves de API y alertas |

---

## 6. Modelo de datos

```mermaid
erDiagram
  SITIOS ||--o{ MOTORES : "tiene"
  SITIOS ||--o{ USUARIOS : "agrupa"
  SITIOS ||--o{ CLAVES_API : "limita"
  MOTORES ||--o{ LECTURAS : "mide (sin FK)"
  VARIABLES ||--o{ LECTURAS : "describe (sin FK)"
  MOTORES ||--o{ ESTADO_ACTUAL : "último valor"
  VARIABLES ||--o{ ESTADO_ACTUAL : "de cada variable"
  MOTORES ||--o{ LECTURAS_HORA : "promedio por hora"
  SITIOS {
    smallint id PK
    varchar codigo UK "norte, sur"
    varchar nombre
  }
  MOTORES {
    smallint id PK
    varchar codigo UK "MTR-01"
    varchar modelo
    smallint sitio_id FK
    boolean activo "baja lógica"
  }
  VARIABLES {
    smallint id PK
    varchar codigo UK "rpm, temp_refrigerante"
    varchar unidad
    double minimo
    double maximo
  }
  USUARIOS {
    int id PK
    varchar usuario UK
    char password_hash "bcrypt"
    enum rol "admin, ingeniero, lector, gateway"
    smallint sitio_id FK "NULL = todos"
  }
  LECTURAS {
    smallint motor_id PK
    smallint variable_id PK
    datetime ts PK "UTC con milisegundos"
    double valor
    tinyint calidad "0 buena, 1 fuera de rango"
  }
  ESTADO_ACTUAL {
    smallint motor_id PK
    smallint variable_id PK
    datetime ts
    double valor
  }
  LECTURAS_HORA {
    smallint motor_id PK
    smallint variable_id PK
    datetime hora PK
    double promedio
    int n
  }
  AUDITORIA_ACCESOS {
    bigint id PK
    datetime ts
    varchar usuario
    varchar recurso
    smallint estado_http
  }
  CLAVES_API {
    int id PK
    varchar nombre UK
    char hash_clave UK "SHA-256"
    smallint sitio_id FK
  }
```

**Cómo leer este diagrama.** Cada caja es una **tabla**, con sus columnas: tipo, nombre y una marca.
Las líneas entre cajas son **relaciones**, y sus extremos dicen cuántos:
- `||` (dos rayas): exactamente uno.
- `o{` (círculo y pata de gallo): cero o muchos.

Así, `SITIOS ||--o{ MOTORES` se lee: "cada motor pertenece a exactamente un sitio, y un sitio tiene
cero o muchos motores".

**Las marcas de las columnas:**
- **PK (clave primaria):** identifica cada fila y no se repite. Si una tabla tiene varias PK, la clave
  es la **combinación**: en `LECTURAS`, el motor, la variable y la hora juntos.
- **FK (clave foránea):** apunta a la PK de otra tabla, y la base impide que apunte a algo que no existe.
- **UK (clave única):** no se repite, pero no es la PK (por ejemplo, el código `MTR-01`).
- El texto entre comillas es una nota.

**"Sin FK"** significa que la relación existe en los datos, pero la base no la obliga. Con millones de
filas, revisarla en cada INSERT costaría demasiado, y las tablas particionadas no admiten FK. La API
valida esa relación con su catálogo.

| Tabla | Para qué existe | Detalle clave |
|---|---|---|
| `sitios`, `motores`, `variables` | El catálogo: qué existe y su rango válido | La API lo guarda en memoria (caché de 60 s) |
| `lecturas` | La historia completa (millones de filas) | PK `(motor, variable, ts)`; sin FK; particionada por mes |
| `estado_actual` | El último valor, para el dashboard | Un upsert que solo avanza en el tiempo |
| `lecturas_hora` | Promedios por hora, para gráficos largos | La llena un `EVENT` cada hora |
| `usuarios` | Quién entra y con qué rol y sitio | Contraseñas en bcrypt |
| `auditoria_accesos` | Quién hizo qué y cuándo | La aplicación solo puede insertar |
| `claves_api` | Sistemas externos (SCADA, EMS) | Solo el SHA-256 de la clave |

**Todas las fechas van en UTC:** no tiene horario de verano, así que no hay horas repetidas ni
faltantes. Se convierten a hora local solo al mostrarlas.

---

## 7. Seguridad por capas

Ninguna defensa sola alcanza; cada capa cubre lo que la anterior deja pasar:

```mermaid
flowchart TD
  A["Internet"] --> B["ufw: solo SSH, 80 y 443"]
  B --> C["nginx: una sola entrada, sin versión,<br/>sin el token del WebSocket en los logs"]
  C --> D["helmet y CSP: encabezados de seguridad"]
  D --> E["Límite de logins: 5 cada 15 min por IP real"]
  E --> F["JWT HS256 de 15 min: ¿quién eres?"]
  F --> G["Rol: ¿qué puedes hacer?"]
  G --> H["Sitio dentro del SQL: ¿este objeto es tuyo?"]
  H --> I["MySQL: usuario sin DELETE;<br/>auditoría de solo inserción"]
```

**Cómo leer este diagrama.** Va de afuera (arriba) hacia adentro (abajo). Cada caja es una barrera que
tiene que cruzar quien quiera llegar a los datos. Es la **defensa en profundidad**: si una capa falla,
la siguiente sigue protegiendo.
1. **ufw:** el firewall del servidor; cierra todos los puertos salvo SSH, 80 y 443.
2. **nginx:** la única puerta de entrada; no anuncia su versión ni guarda el token del WebSocket en sus logs.
3. **helmet y CSP:** encabezados que le ordenan al navegador, por ejemplo, ejecutar solo los scripts del propio sitio.
4. **Límite de logins:** frena a quien prueba claves al azar (fuerza bruta).
5. **JWT:** prueba quién eres en cada petición.
6. **Rol:** decide qué acciones puedes hacer.
7. **Sitio dentro del SQL:** decide sobre qué datos (evita BOLA).
8. **Permisos de MySQL:** aunque roben la clave de la API, con ella no se puede borrar ni alterar la auditoría.

| Amenaza | Defensa | Dónde |
|---|---|---|
| Inyección SQL | Parámetros `?`; nunca concatenar valores | Todo el SQL de `src/api/` |
| Robo de la tabla de usuarios | bcrypt de costo 12 | `src/scripts/sembrar-usuarios.js` |
| Token robado | 15 minutos de vida; el WebSocket se cierra al vencer | `src/api/auth.js`, `tiempo-real.js` |
| Token falsificado o `alg: none` | Firma HS256 con `algorithms` explícito | `src/api/auth.js` |
| Ver datos de otra faena (BOLA) | Filtro por sitio dentro de cada SQL; 404 y no 403 | `src/api/rutas/motores.js` |
| Fuerza bruta en el login | 5 intentos cada 15 minutos por IP | `src/api/rutas/auth.js` |
| Un gateway publicando en otra faena | Usuarios y ACL en Mosquitto | `mosquitto/acl` |
| XSS en el dashboard | CSP sin scripts en línea; `textContent` en vez de `innerHTML` | `public/` |
| Secretos en el repositorio público | `.env` ignorado; claves generadas por scripts | `.gitignore`, `src/scripts/` |
| Alguien explota la app | Usuario `node` en Docker; systemd endurecido (exposición 3,0) | `Dockerfile`, `deploy/` |
| Borrar el rastro | Auditoría sin `UPDATE` ni `DELETE` para la API | `sql/003_usuario_app.sh` |

---

## 8. Por qué no se pierden datos

La confiabilidad sale de **cuatro garantías encadenadas**:

```mermaid
flowchart LR
  E["Equipo"] --> G["Gateway"]
  G -->|"corte de enlace:<br/>buffer SQLite"| B[("Broker")]
  B -->|"API caída:<br/>sesión persistente"| A["API"]
  A -->|"MySQL caída:<br/>el loteador reintenta"| D[("MySQL")]
  B -.->|"mensaje repetido:<br/>la PK lo absorbe"| D
```

**Cómo leer este diagrama.** Es el camino de un dato, de izquierda a derecha. El texto de cada flecha
dice qué falla puede ocurrir en ese tramo y qué la cubre. La flecha punteada muestra el efecto
secundario de reenviar: pueden llegar duplicados, y la base los absorbe.
- **Buffer SQLite (store-and-forward):** si se corta el enlace, el gateway guarda y reenvía después.
- **Sesión persistente:** si la API no está, el broker le guarda los mensajes.
- **Reintento del loteador:** si MySQL no responde, las filas esperan en memoria y se escriben en orden al volver.
- **PK idempotente:** cada protección puede reenviar, así que un mensaje puede llegar dos veces. La PK
  impide guardarlo dos veces.

| Si falla... | Qué pasa | Quién lo cubre | ¿Probado? |
|---|---|---|---|
| El enlace de la faena | El gateway guarda en SQLite y drena en orden al volver | `buffer-local.js`, `gateway.js` | Sí: cortes de 30 y 61 s sin huecos; un corte de 10,5 h |
| El broker | Igual que arriba; el broker además guarda sus sesiones en disco | `persistence true` | Sí |
| La API (reinicio) | El broker guarda los mensajes QoS 1 de su sesión | `clientId` fijo y `clean: false` | Sí: 20 de 20 |
| MySQL | El loteador conserva las filas y reintenta en orden (hasta 50.000) | `loteador.js` | Sí, en las pruebas |
| Un mensaje llega dos veces | Se ignora sin error | PK `(motor, variable, ts)` | Sí: `nuevas: 0` |
| Llega una lectura atrasada | No pisa al último valor | `IF(nuevo.ts > ...)` en `repositorio.js` | Sí |
| La API muere de golpe | Se pierde lo que el loteador tenía en memoria (hasta 1 s) | Límite conocido | Mejora: confirmar después de escribir |
| El gateway se apaga | No hay datos: nadie lee los equipos | El Last Will avisa `offline` y el detector de silencio alerta | Sí |

---

## 9. Rendimiento con millones de filas

Medido con **2.419.200 lecturas** (`npm run volumen`, en 21 s) y `EXPLAIN ANALYZE`:

| Consulta | Antes | Después | Qué cambió |
|---|---|---|---|
| Serie de rpm de un motor en 24 h | 3,5 ms | — | Nada: la PK ya calzaba |
| Promedio por hora del sitio en 7 días | 268 ms | **1,2 ms** | Tabla `lecturas_hora` |
| Últimas 50 lecturas fuera de rango | 330 ms | **0,47 ms** | Índice `(calidad, ts)` |
| Borrar un mes (2,4 M filas) | 28,4 s | **3,9 s** | `DROP PARTITION` |
| Auditoría, página 4000 | 61,7 ms | **0,03 ms** | Paginación por clave |

```
Índice (calidad, ts): las fuera de rango juntas y ordenadas por hora

 calidad  ts                    → fila
   0      ...                     (2,4 millones de filas buenas, que no se tocan)
   1      2026-11-09 08:12:30   ┐
   1      ...                   │ "las últimas 50 fuera de rango":
   1      2026-11-16 12:40:10   ┘ entra por el final y se detiene en la fila 50

Particiones por mes: un archivo por mes
┌────────────┬────────────┬────────────┬────────────┐
│ p2026_10   │ p2026_11   │ p2026_12   │ p_futuro   │
└────────────┴────────────┴────────────┴────────────┘
 "WHERE ts en noviembre" → solo abre p2026_11 (poda)
 "borrar octubre"        → DROP PARTITION p2026_10 (suelta el archivo entero)
```

**Cómo leer este dibujo.** Muestra las dos técnicas de la tabla que más se notan:
- **Arriba, el índice `(calidad, ts)`.** Un índice es una lista aparte y ordenada que apunta a cada
  fila, como el índice alfabético de un libro. Este ordena primero por calidad y después por hora, así
  que las lecturas fuera de rango (calidad 1) quedan juntas y en orden. Para "las últimas 50", MySQL
  entra por el final de ese grupo, lee 50 filas y se detiene, sin tocar los 2,4 millones de lecturas buenas.
- **Abajo, las particiones.** La tabla se divide en un archivo por mes. Una consulta de noviembre abre
  solo ese archivo: eso es la **poda** (*partition pruning*). Borrar octubre es soltar su archivo
  completo, en vez de borrar fila por fila como hace un `DELETE`.

**Las otras dos mejoras de la tabla:**
- **`lecturas_hora`:** un `EVENT` de MySQL (una tarea programada dentro de la base) guarda cada hora
  el promedio, el mínimo y el máximo de cada motor y variable. Un promedio de 7 días lee 168 filas por
  motor y variable, en vez de 60.480 (una cada 10 s).
- **Paginación por clave:** con `OFFSET`, la página 4000 obliga a recorrer 200.000 filas para entregar
  50. Con la clave se pide "las 50 anteriores al último id que viste": MySQL entra directo por la PK y
  lee solo esas 50.

**La regla:** primero se mide (slow query log y `EXPLAIN ANALYZE`) y después se corrige. Más detalle
en [rendimiento.md](rendimiento.md).

---

## 10. Operación

| Endpoint | Pregunta que responde | Quién lo usa |
|---|---|---|
| `GET /api/salud` | ¿El proceso está vivo? | Docker (healthcheck) |
| `GET /api/listo` | ¿Puedo atender? (base y broker) | `desplegar.sh`, un balanceador |
| `GET /api/metricas` | ¿Cómo estoy? (ingesta, loteador, WebSocket, memoria) | El admin |

**Logs estructurados:** una línea JSON por evento, que se filtra por campo.

```json
{"ts":"2026-11-16T13:27:08.926Z","nivel":"aviso","evento":"motor_en_silencio","motor":"MTR-01","sitio":"norte","ultimo_dato":"2026-11-16T13:21:28.245Z"}
```

```bash
docker compose logs api --no-log-prefix | jq 'select(.nivel == "aviso")'
```

**El detector de silencio** revisa cada minuto y avisa solo cuando algo cambia:

```mermaid
stateDiagram-v2
  [*] --> ConDatos
  ConDatos --> EnSilencio : 5 min sin datos
  EnSilencio --> ConDatos : vuelve a enviar
  note right of EnSilencio
    log motor_en_silencio
    alerta por WebSocket
    resumen retenido en MQTT
  end note
```

**Cómo leer este diagrama.** Las cajas son los **estados** de cada motor, y las flechas, los **cambios
de estado** con su condición. El punto negro marca el inicio.
1. Todo motor parte en **ConDatos**.
2. Si pasan 5 minutos sin una lectura nueva, cambia a **EnSilencio**. En ese cambio, y solo ahí, se
   escribe el log, se manda la alerta al dashboard y se publica el resumen retenido en MQTT (la nota).
3. Cuando vuelve a enviar datos, regresa a **ConDatos** y se avisa `motor_recuperado`.

**Por qué se avisa solo en el cambio:** un motor callado durante una hora generaría 60 alertas iguales
si se avisara en cada revisión, y la gente aprendería a ignorarlas.

**Lo que aparece:**
- **Mensaje retenido:** el broker guarda el último resumen de cada sitio y se lo entrega al instante a
  quien se suscriba después (por ejemplo, un EMS).

Cuando algo falla: [RUNBOOK.md](RUNBOOK.md) tiene los cuatro procedimientos (un sitio sin datos, la
API caída, la base lenta y restaurar un respaldo).

---

## 11. Comandos de uso diario

| Para... | Comando |
|---|---|
| Levantar todo en contenedores | `docker compose --profile completo up -d --build` |
| Levantar solo la base (para desarrollar) | `docker compose up -d --wait` |
| API en tu equipo, con reinicio al guardar | `npm run api:dev` |
| Simulador, gateway y CAN | `npm run simulador` · `npm run gateway` · `npm run can` |
| Pruebas | `bash src/scripts/preparar-db-test.sh && npm test` |
| Usuarios de la API | `npm run sembrar` |
| Usuarios del broker | `bash src/scripts/claves-mqtt.sh` |
| Escuchar MQTT | `docker compose exec mosquitto mosquitto_sub -u api -P "$MQTT_CLAVE" -t 'motores/#' -v` |
| Entrar a MySQL | `docker compose exec mysql mysql -u telemetria_app -p telemetria` |
| Ver logs | `docker compose logs -f api` |
| Clave de API para un SCADA | `npm run clave-api -- scada-norte norte` |
| Datos de volumen | `npm run volumen` |
| Respaldo | `DESTINO=./datos/respaldos bash deploy/respaldo.sh` |
| Apagar todo (sin borrar datos) | `docker compose --profile completo --profile nodered stop` |

---

## 12. Ruta para dominarlo

**El método, en cada paso:**
1. **Lee** el apunte de la fase (`docs/apuntes/fase-NN.md`).
2. **Ejecuta** su verificación.
3. **Rompe algo a propósito** y mira qué pasa.
4. **Explícalo en voz alta** en un minuto.

Con el agente: `explica <archivo>`, `por qué <algo>`, `pregúntame` y `ejercicio`.

| Día | Tema | Lee | Haz |
|---|---|---|---|
| 1 | El panorama y la base | Secciones 1 a 4 y 6; apuntes 0 a 2 | `docker compose up -d --wait` y `practica/consultas.sql` |
| 2 | La API y la seguridad | Secciones 5.1 a 5.3 y 5.7; apuntes 3 y 4; `app.js`, `auth.js`, `rutas/motores.js` | Las pruebas de `seguridad.test.js`; alterar un token |
| 3 | La ingesta | 5.4, 5.5 y 5.8; apuntes 5 y 6; `validacion.js`, `repositorio.js`, `loteador.js`, `ingesta-mqtt.js` | Mandar dos veces el lote de ejemplo; apagar la API y publicar |
| 4 | El terreno | 5.6, 5.9 y 5.10; apuntes 7 y 8; `decodificacion.js`, `gateway.js`, `j1939.js` | Cortar el broker 60 s; decodificar una trama EEC1 a mano |
| 5 | Tiempo real y Node-RED | 5.11 y 5.12; apuntes 9 y 10 | Abrir el dashboard con dos usuarios; editar el flujo |
| 6 | Volumen y Docker | 5.13 y la sección 9; apuntes 11 y 12 | `npm run volumen`, un `EXPLAIN ANALYZE`, `docker compose restart api` |
| 7 | Linux y operación | 5.14 y las secciones 7, 8 y 10; apuntes 13 y 14 | Detener el simulador y esperar la alerta; simulacro de entrevista (`PROMPTS.md`, prompt 6) |

**Experimentos para entenderlo rompiéndolo:**

| Haz esto | Y observa |
|---|---|
| `docker compose stop mosquitto` 60 s con el gateway andando | El buffer crece; al volver, drena sin huecos |
| Mata el gateway (`taskkill /F /PID <pid>`) | El estado retenido pasa a `offline` (Last Will) |
| Manda dos veces `practica/lote-ejemplo.json` | La segunda vez `nuevas` es 0 (idempotencia) |
| Cambia una letra del token y llama a `/api/motores` | 401: la firma ya no calza |
| Pide `MTR-03` con el token de `ing-norte` | 404: el motor es de otro sitio (BOLA) |
| `docker compose stop simulador` y espera 6 minutos | La alerta `motor_en_silencio` |
| `EXPLAIN` antes y después de borrar el índice `(calidad, ts)` (en `telemetria_test`) | `range` contra `ALL` |

---

## 13. Glosario

| Término | En una línea |
|---|---|
| ACL | Lista de qué tópicos puede leer o escribir cada usuario del broker |
| API | La interfaz por la que otros programas piden o envían datos |
| Auditoría | El registro de quién hizo qué y cuándo |
| bcrypt | Hash lento y con sal para guardar contraseñas |
| BOLA | Acceder a objetos ajenos con un rol válido; se evita filtrando cada consulta |
| Broker | El servidor MQTT que reparte los mensajes (Mosquitto) |
| CAN | Bus de vehículos y motores donde cada ECU transmite sola |
| Catálogo | Motores y variables en memoria para validar sin consultar la base |
| Complemento a dos | Cómo se guardan los negativos en binario (65.486 = −50 en 16 bits) |
| Contenedor | Un programa aislado que corre desde una imagen de Docker |
| CSP | Política del navegador que dice qué scripts puede ejecutar la página |
| EXPLAIN | El plan con que MySQL ejecuta una consulta |
| float32 | Número decimal de 4 bytes; en Modbus ocupa dos registros |
| Gateway | El equipo que traduce de un protocolo a otro (Modbus → MQTT) |
| Healthcheck | Una prueba periódica de que un servicio está sano |
| Holding register | Registro Modbus de 16 bits de lectura y escritura (función 03) |
| Idempotencia | Repetir una operación deja el mismo resultado que hacerla una vez |
| Imagen | La plantilla de solo lectura de un contenedor |
| Índice | Estructura que permite buscar sin recorrer toda la tabla |
| InnoDB | El motor de MySQL: transacciones y tabla ordenada por la PK |
| J1939 | El "diccionario" de los motores diésel sobre CAN |
| JWT | Token firmado que dice quién eres; vence en 15 minutos |
| Last Will | Mensaje que el broker publica si un cliente cae sin avisar |
| Little-endian | El byte bajo va primero (J1939) |
| Loteador | Junta filas y las escribe de a muchas en un solo INSERT |
| Middleware | Función por la que pasa cada petición en Express |
| Modbus | Protocolo industrial de pregunta y respuesta (maestro y esclavo) |
| MQTT | Protocolo de publicar y suscribir por tópicos |
| nginx | Servidor web que hace de única puerta (proxy inverso) |
| Node.js | El programa que ejecuta JavaScript en el servidor |
| Node-RED | Herramienta para armar flujos con bloques |
| Partición | Un trozo de una tabla (un mes) guardado en su propio archivo |
| PGN y SPN | Qué mensaje es y qué variable lleva dentro (J1939) |
| PK | Clave primaria: identifica cada fila y, en InnoDB, ordena la tabla |
| Pool | Conexiones a la base abiertas y reutilizadas |
| QoS | Nivel de garantía de entrega en MQTT (0, 1 o 2) |
| Rate limiting | Tope de intentos en una ventana de tiempo |
| Retenido | Mensaje que el broker guarda y entrega a cada suscriptor nuevo |
| Sesión persistente | El broker recuerda al cliente y le guarda los mensajes |
| SQLite | Base de datos en un archivo, sin servidor |
| Store-and-forward | Guardar en disco antes de enviar y reenviar al volver el enlace |
| systemd | El supervisor de servicios de Linux |
| Tópico | La "dirección" de un mensaje MQTT, con niveles separados por `/` |
| Transacción | Varias escrituras que se confirman o se deshacen juntas |
| Unit ID | El número de un equipo Modbus |
| Upsert | Insertar o, si ya existe, actualizar |
| UTC | Hora universal, sin horario de verano |
| Volumen | Disco de Docker que sobrevive al contenedor |
| WebSocket | Conexión abierta en la que el servidor habla cuando quiere |
| zod | Librería que valida la forma de los datos |
