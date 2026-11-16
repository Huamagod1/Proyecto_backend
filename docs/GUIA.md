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
├── docs/                     esta guía, apuntes por fase, decisiones, runbook, rendimiento
├── Dockerfile · docker-compose.yml · package.json · .env.example
└── README.md · PLAN.md · PROGRESO.md · AGENTS.md
```

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
| `"engines"` | `"node": ">=22.13"` | Versión mínima de Node |

| Opción de `node` | Qué hace |
|---|---|
| `--env-file=.env` | Carga las variables de `.env` en `process.env`, sin librerías |
| `--watch` | Reinicia el proceso al guardar un archivo |
| `--test` | Corre las pruebas de `node:test` |
| `--disable-warning=ExperimentalWarning` | Calla el aviso de `node:sqlite` en Node 24.4 y anteriores |

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
POST /api/motores HTTP/1.1                    ← método y ruta
Authorization: Bearer eyJhbGciOiJIUzI1Ni...   ← encabezados
Content-Type: application/json

{"codigo":"MTR-10","modelo":"12V4000","sitio_id":1}     ← cuerpo (body)

HTTP/1.1 201 Created                          ← código de estado
Location: /api/motores/MTR-10                 ← encabezado: dónde quedó el recurso nuevo
{"codigo":"MTR-10","modelo":"12V4000","sitio_id":1,"sitio":"norte"}
```

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
