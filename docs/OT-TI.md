# OT/TI en la práctica

Guía de bolsillo para trabajar en una plataforma de datos industriales: qué se hace, qué no se hace y por qué. Acompaña a `PLAN-2.md`: cada fase practica una parte de lo que está aquí. Los términos de la Parte 1 (JWT, QoS, índice…) están en el glosario de `docs/GUIA.md`; los nuevos, al final de esta guía.

**Cómo usarla**
- Antes de una fase, lee el principio y la tabla de "hacer y no hacer" que le corresponden.
- Si un término no te queda claro, escribe `define <término>` en el chat del agente: te lo explica en tres niveles y lo agrega al glosario si falta.
- La sección 4 (el grupo electrógeno) y la 7 (las primeras semanas) sirven también fuera del proyecto, en el trabajo.
- Para decidir rápido en una situación concreta, usa `docs/CRITERIO.md`. Para saber cómo leer y estudiar el proyecto, `docs/COMO-ABORDAR.md`.

---

## 1. Dos mundos: OT y TI

**OT** (tecnología de operación) son los sistemas que miden y controlan un proceso físico: sensores, controladores, PLC, SCADA. **TI** (tecnología de la información) son los que manejan información: servidores, bases de datos, aplicaciones web. Tu plataforma es TI, pero lee datos de OT a través de los gateways. Por eso tienes que entender las reglas de los dos lados.

| Tema | OT | TI |
|---|---|---|
| Lo primero que se protege | Las personas, el equipo y la continuidad del proceso | La confidencialidad y la integridad de la información |
| Qué significa una caída | Un proceso detenido, energía que no llega o un riesgo físico | Un servicio que no responde |
| Vida útil de un equipo | 15 a 30 años, con firmware antiguo | 3 a 5 años |
| Parches y reinicios | Se planifican en ventanas y se prueban antes: reiniciar puede detener la planta | Frecuentes y muchas veces automáticos |
| Protocolos | Modbus, CAN, Profinet: pensados para redes cerradas, casi siempre sin clave ni cifrado | HTTP y TLS, con autenticación |
| Tiempos | Milisegundos y deterministas para controlar | Segundos tolerables |
| Quién decide | La operación de la planta | El área de TI |
| Cómo se cambia algo | Con permiso de trabajo y gestión del cambio | Con un ticket y un despliegue |

**Lo que significa para ti:** la plataforma observa; el controlador protege. Nada de lo que hagas en la plataforma puede poner en riesgo a una persona ni detener un equipo, y cualquier contacto con el lado OT se coordina con quien lo opera.

---

## 2. Diez principios

1. **La seguridad de las personas y del proceso va primero.** Las protecciones viven en el controlador, en terreno. La plataforma las registra y avisa, pero no las reemplaza ni las salta. *En el proyecto:* fases 21 y 28.
2. **Monitorear no es controlar.** Por defecto, todo se lee. Escribir hacia terreno es una excepción, con barreras: habilitación por equipo, aprobación, caducidad y confirmación. *Fases 18 y 28.*
3. **El dato crudo no se toca.** Se guarda como llegó, se califica con banderas y se corrige en una capa aparte, con autor y motivo. Es la contramuestra que permite rehacer cualquier cálculo. *Fases 19 y 20.*
4. **Todo dato lleva hora, unidad, calidad y origen.** La hora es la del equipo y en UTC, la unidad es la del catálogo, la calidad dice si se puede usar y el origen dice con qué perfil se leyó. Un número sin eso no sirve para decidir. *Fases 17 y 19.*
5. **La ausencia de dato no es cero ni es el último valor.** "Sin dato" se registra con su causa: gateway caído, equipo sin respuesta o sensor en falla. *Fases 18 y 19.*
6. **Nada se pierde en silencio.** Guardar antes de enviar, escribir de forma idempotente, apartar en cuarentena lo que no se puede recibir y alertar cuando algo se calla. Si algo se pierde, que quede contado y explicado. *Fases 15, 19 y 26.*
7. **Las conexiones salen del sitio, cada equipo tiene su identidad y las zonas están separadas.** Ningún puerto de entrada en una planta, ninguna clave compartida y ningún equipo con una pata en cada red. *Fase 27.*
8. **Ningún cambio sin permiso de trabajo.** Procedimiento, revisión, ensayo, ventana avisada y un camino de vuelta definido antes de empezar. *Fases 16 y 25.*
9. **Lo que no se mide no se controla.** Objetivos medibles desde el lado del usuario, alertas por síntoma, un procedimiento por alerta y alguien que vigile al vigilante. *Fase 23.*
10. **Lo que no está escrito no existe.** Actas, procedimientos, decisiones y postmortems. El sistema tiene que poder operarlo alguien que no lo construyó. *Fases 29 y 30.*

---

## 3. Hacer y no hacer

### En terreno y con los equipos

| Hacer | No hacer | Por qué |
|---|---|---|
| Coordinar con la operación cada conexión y cada prueba | Conectarte a un controlador en servicio sin avisar | Un sondeo mal configurado puede molestar a un equipo que está generando |
| Leer bloques documentados del mapa del fabricante | Barrer direcciones para "descubrir" el mapa | Algunos controladores responden con excepciones y otros se degradan |
| Un solo maestro por bus RS485 | Agregar un segundo lector al mismo bus | Las respuestas se cruzan y los dos leen basura |
| Respetar el selector local y los bloqueos de mantenimiento | Ofrecer un "forzar" remoto | El bloqueo existe para proteger a una persona que está trabajando en el equipo |
| Escanear la red OT solo con permiso y con herramientas pasivas | Pasar un escáner de red agresivo por la red de control | Hay controladores antiguos que se bloquean ante tráfico inesperado |

### Con los datos

| Hacer | No hacer | Por qué |
|---|---|---|
| Guardar y marcar lo dudoso | Rechazar lo que está fuera de rango | Un valor anormal puede ser justo la falla que había que ver |
| Registrar "sin dato" con su causa | Repetir el último valor bueno o guardar 0 | La línea plana parece una medición y engaña a todos |
| Dejar el valor como llegó | Recortarlo al máximo del rango | Un dato falso que parece verdadero es peor que un hueco |
| Convertir a la unidad del catálogo al decodificar | Guardar psi y kPa en la misma variable | Los promedios y las alarmas pierden sentido sin que nadie lo note |
| Restar los contadores, con manejo de vuelta y reinicio | Promediar un contador | Da energías negativas o gigantescas en los informes |
| Corregir en una capa aparte, con autor y motivo | `UPDATE` sobre los datos crudos | Se pierde el original y nadie puede auditar el cambio |
| Mostrar los huecos como huecos | Rellenar con interpolación sin marcarla | Un dato inventado termina en un informe como si fuera medido |

### Con la base de datos

| Hacer | No hacer | Por qué |
|---|---|---|
| Cambiar el esquema con migraciones versionadas | Hacer un `ALTER` a mano "solo esta vez" | Así nace la deriva entre bases |
| Probar cada migración en una copia con volumen real | Estrenar un `ALTER` en producción | En una tabla grande puede bloquear la ingesta por horas |
| Restaurar respaldos en una instancia aparte, cada mes | Dar por bueno un respaldo porque el archivo existe | Un respaldo que nunca se restauró es una suposición |
| Archivar, verificar y recién entonces borrar | Borrar a mano archivos del motor, como los binlogs | Rompes la base o la recuperación a un punto en el tiempo |
| Una cuenta por función, con lo mínimo | Usar root en scripts y en la aplicación | Un error o un robo de credenciales tiene el alcance de esa cuenta |

### Con la API y el front

| Hacer | No hacer | Por qué |
|---|---|---|
| Publicar un contrato (OpenAPI) y respetarlo | Renombrar un campo "porque quedó mejor" | El front se rompe en producción y tú no te enteras |
| Entregar la unidad, la calidad y la resolución con el dato | Dejar que el front calcule estados o adivine unidades | Dos lugares con la misma regla terminan mostrando cosas distintas |
| Reducir puntos en el servidor, con mínimo y máximo | Mandar decenas de miles de puntos a un gráfico | El navegador se arrastra y el gráfico no muestra más |
| Entregar las horas en UTC y la zona horaria del sitio | Guardar o entregar horas locales sin zona | Los cambios de horario duplican o borran una hora |
| Paginar todo lo que puede crecer | Devolver "todas las alarmas" | Funciona con 50 y se cae con 500.000 |

### Con la operación

| Hacer | No hacer | Por qué |
|---|---|---|
| Mirar antes de tocar: logs, métricas y estado | Reiniciar todo "por si acaso" | Borra la evidencia y puede perder lo que estaba en memoria |
| Anotar la hora de cada observación y de cada acción | Reconstruir la cronología de memoria | La secuencia exacta suele explicar la causa |
| Mitigar primero y buscar la causa raíz después | Investigar con el servicio caído si existe una vuelta atrás segura | El usuario espera mientras tú averiguas |
| Definir el criterio de retroceso antes del cambio | Decidir en el momento si se vuelve atrás | Bajo presión se insiste de más |
| Alertar por síntomas, con un procedimiento por alerta | Alertar por cada causa posible | Las alertas sin acción entrenan a ignorarlas |
| Escribir el postmortem sin buscar culpables | Cerrar el incidente sin aprender | El mismo incidente vuelve |

### Con la seguridad

| Hacer | No hacer | Por qué |
|---|---|---|
| Que el gateway inicie la conexión hacia afuera, cifrada | Abrir un puerto de entrada en el sitio | Es una puerta para cualquiera que la encuentre |
| Un certificado o una credencial por equipo | Compartir una clave entre sitios | Si se filtra, hay que cambiar todas y no sabes quién fue |
| Rotar y revocar como rutina ensayada | Aprender a revocar el día del robo | Con el incidente encima no hay tiempo para leer el manual |
| Guardar los secretos fuera del código y del repositorio | Dejar una clave "temporal" en un archivo | Lo temporal se queda, y el repositorio se copia |
| Revisar quién tiene acceso, al menos una vez al año | Dejar cuentas de personas que ya se fueron | Las cuentas olvidadas son la entrada más común |

### Con las personas

| Hacer | No hacer | Por qué |
|---|---|---|
| Decir "todavía no sé" y qué vas a revisar | Dar una causa sin evidencia | Un diagnóstico falso manda a todos en la dirección equivocada |
| Avisar antes de un cambio a quien opera | Sorprender a la operación | Quien opera es quien recibe las llamadas |
| Preguntar quién es dueño de cada pieza | Arreglar lo que es de otro equipo sin avisar | Se duplican los cambios y nadie sabe qué pasó |
| Dejar por escrito lo que aprendiste | Ser la única persona que sabe cómo funciona algo | El día que no estés, el sistema queda a ciegas |

---

## 4. El grupo electrógeno en una página

### Sus partes

| Parte | Qué hace |
|---|---|
| Motor | Diésel o gas. Entrega el giro |
| Gobernador (regulador de velocidad) | Ajusta el combustible para mantener las rpm, y con ellas la frecuencia |
| Alternador sincrónico | Convierte el giro en electricidad trifásica |
| AVR (regulador automático de voltaje) | Ajusta la excitación del alternador para mantener el voltaje |
| Controlador del grupo | Arranca, detiene, protege, mide y comunica. Es el equipo al que le hablas por Modbus |
| ECU del motor | La computadora del motor: inyección, sensores y fallas. Habla J1939 por CAN |
| Interruptor del generador | Conecta o desconecta el grupo de la carga |
| Tablero de transferencia (ATS) | Conmuta la carga entre la red y el grupo |
| Baterías y cargador | Dan el arranque. Una batería débil es la causa más común de un arranque fallido |
| Combustible | Estanque diario, a veces estanque principal, y su medición de nivel |
| Refrigeración | Radiador y, en los de emergencia, un calefactor que mantiene el motor tibio para que arranque y tome carga en segundos |

### Cómo opera

- **Modos del controlador:** apagado, manual, automático y prueba. En automático, el grupo de emergencia parte solo cuando cae la red. Si queda en manual o apagado, no parte: por eso existe la alerta `no_en_automatico`.
- **Secuencia de emergencia:**
  1. cae la red;
  2. el grupo arranca y estabiliza voltaje y frecuencia;
  3. la transferencia pasa la carga al grupo;
  4. vuelve la red y se espera a que esté estable;
  5. la carga regresa a la red;
  6. el grupo funciona un rato sin carga para enfriarse, y se detiene.
- **En isla o en paralelo:** en isla, el grupo alimenta solo a su carga. En paralelo, se conecta con la red o con otros grupos. Antes de cerrar el interruptor hay que **sincronizar** (igualar voltaje, frecuencia y fase), y después se **reparte la carga** entre los grupos.
- **Microrred:** grupos, paneles solares y baterías que operan juntos, conectados a la red o aislados. Un **EMS** (sistema de gestión de energía) decide cuánto aporta cada fuente para minimizar el combustible y mantener la estabilidad. Su control es local; la plataforma monitorea y, a lo más, envía consignas.

### Regímenes (ISO 8528-1)

| Régimen | Para qué | Uso típico |
|---|---|---|
| ESP (emergencia) | Respaldo cuando cae la red | Pocas horas al año, típicamente hasta 200 |
| LTP (tiempo limitado) | Carga constante por períodos acotados | Hasta unas 500 horas al año |
| PRP (servicio principal) | Fuente principal con carga variable | Horas ilimitadas, con carga promedio acotada |
| COP (continuo) | Carga constante sin límite de horas | Generación base |

El régimen cambia lo que es "normal": un grupo de emergencia con 2.000 horas al año está mal usado, y uno de servicio principal con 20 horas está detenido.

### Las variables y lo que cuentan

Los valores son de referencia para el laboratorio. Los reales salen de la hoja de datos del equipo y de los ajustes de su controlador.

| Variable | Normal de referencia | Lo que suele indicar si se sale |
|---|---|---|
| Velocidad | 1500 rpm a 50 Hz con 4 polos (1800 rpm a 60 Hz) | Problemas del gobernador o del combustible |
| Frecuencia | 50 Hz, con caídas breves al tomar carga | Carga mayor de lo que el motor entrega, o un gobernador mal ajustado |
| Temperatura del refrigerante | 80 a 95 °C en marcha | Alta: sobrecarga, radiador sucio o falta de refrigerante. Baja en reposo: calefactor apagado |
| Presión de aceite | Sube con las rpm; 0 con el motor detenido | Baja en marcha: nivel bajo o desgaste. Distinta de 0 detenido: sensor en falla |
| Voltaje de batería (sistema de 24 V) | Unos 26 a 28 V con el cargador | Una caída fuerte al arrancar delata una batería débil |
| Voltajes del generador | 380 V entre fases y 220 V a neutro en baja tensión en Chile | Un problema del AVR, o una fase con falla |
| Corrientes por fase | Parecidas entre sí | Desbalance de carga o una falla en una fase |
| Potencia activa | Porcentaje de la nominal | Bajo el 30 % por mucho tiempo, un diésel acumula combustible sin quemar en el escape (*wet stacking*) |
| Factor de potencia | 0,8 a 1 | Muy bajo: cargas inductivas sin compensar |
| Consumo | Unos 0,2 a 0,3 L/kWh a carga media o alta | Si sube con la misma carga: inyección, filtros o un sensor mal calibrado |
| Nivel de combustible | Baja solo con el motor en marcha | Una caída con el motor detenido: fuga o robo |
| Horas y arranques | Crecen | Base del mantenimiento por horas. Muchos arranques fallidos: baterías o combustible |

### Fórmulas que se usan todos los días

| Qué | Fórmula | Ejemplo |
|---|---|---|
| Frecuencia | f = rpm × polos / 120 | 1500 × 4 / 120 = 50 Hz |
| Potencia aparente (kVA) | S = √3 × V × I / 1000 | 380 V y 570 A → 375 kVA |
| Potencia activa (kW) | P = S × FP | 375 × 0,8 = 300 kW |
| Potencia reactiva (kVAr) | Q = √(S² − P²) | √(375² − 300²) = 225 kVAr |
| Corriente | I = P × 1000 / (√3 × V × FP) | 300 kW a 380 V y FP 0,8 → 569,8 A |
| Factor de carga | Energía / (potencia nominal × horas) | 1.800 kWh / (400 kW × 6 h) = 75 % |
| Consumo específico | Litros / kWh | 62,5 L/h / 300 kW = 0,208 L/kWh |
| Disponibilidad | Horas disponibles / horas del período | Excluye las detenciones programadas, si así se acuerda |

Caso de control: un grupo de 500 kVA con factor de potencia 0,8 tiene 400 kW nominales. Al 75 % entrega 300 kW, 375 kVA, 225 kVAr y 569,8 A por fase.

### Alarmas típicas

| Alarma | Clase habitual |
|---|---|
| Alta temperatura del refrigerante | Aviso y, si sigue subiendo, parada |
| Baja presión de aceite | Parada |
| Sobrevelocidad | Parada inmediata |
| Falla de arranque | Parada (el grupo no logra partir tras varios intentos) |
| Bajo o alto voltaje, baja o alta frecuencia | Disparo eléctrico |
| Sobrecorriente | Disparo eléctrico |
| Potencia inversa (el generador trabaja como motor; en paralelo) | Disparo eléctrico |
| Bajo nivel de combustible | Aviso |
| Batería baja o falla del cargador | Aviso |
| Parada de emergencia | Parada inmediata |
| No en automático | Aviso |

**Aviso:** el grupo sigue. **Disparo eléctrico:** abre el interruptor y el motor se enfría antes de detenerse. **Parada:** se detiene de inmediato. Las clases exactas las define el ajuste de cada controlador.

### Cómo hablan

- **El controlador del grupo:** casi siempre **Modbus**, RTU por RS485 o TCP por Ethernet. Cada fabricante publica su mapa de registros, y a veces cambia según el firmware. Deep Sea Electronics, por ejemplo, usa la norma GenComm: direcciones por páginas (página × 256 + desplazamiento) y valores reservados para "no implementado", "sobre rango" o "falla del transductor".
- **La ECU del motor:** **J1939** sobre CAN. Las variables se identifican por PGN y SPN, y las fallas activas viajan en el mensaje DM1 como un par SPN y FMI. J1939-75 define los mensajes propios de los grupos electrógenos.
- **En microrredes y subestaciones** aparecen además OPC UA, IEC 61850 y, a veces, DNP3.
- **Algunos fabricantes de controladores:** ComAp, Deep Sea Electronics, Woodward y SmartGen, además de los propios de cada marca de motor. En el trabajo, pregunta qué modelos y qué firmware hay en la flota: de eso depende cada perfil.

---

## 5. Calidad de datos: el mapa

### Las seis dimensiones

| Dimensión | Pregunta | Cómo se mide aquí |
|---|---|---|
| Completitud | ¿Llegó todo lo que debía llegar? | Mensajes recibidos sobre esperados, por equipo y día; huecos con `LAG` |
| Validez | ¿El valor es posible? | Rangos físicos y de operación, enumeraciones y centinelas |
| Exactitud | ¿El valor es verdadero? | Prueba punto a punto en la puesta en servicio y coherencia entre variables |
| Consistencia | ¿Las variables se contradicen? | Reglas de coherencia: frecuencia contra rpm, potencia contra V × I × FP |
| Puntualidad | ¿Llegó a tiempo? | Retraso entre la hora del dato y su llegada; desfase de reloj |
| Unicidad | ¿Está una sola vez? | La PK y la escritura idempotente; saltos y repeticiones de `seq` |

### La escalera del dato

1. **Crudo:** lo que midió el equipo, en la unidad del catálogo, con su hora. Nunca se modifica.
2. **Calificado:** el crudo más sus banderas de calidad. Se califica al entrar y se vuelve a calificar en lote.
3. **Corregido:** una capa aparte, con autor, motivo y aprobación, para los errores conocidos.
4. **Agregado:** promedios, mínimos, máximos e incrementos por minuto, hora o día, calculados solo con lo bueno y con la cantidad de datos usados.
5. **Indicador:** lo que se informa y se decide: horas de marcha, energía, consumo, disponibilidad, factor de carga.

Cada escalón se puede recalcular desde el anterior. Por eso el crudo es sagrado.

### Las tres ausencias

| Ausencia | Señal que deja | Quién la atiende |
|---|---|---|
| El gateway está caído o sin enlace | El estado retenido pasa a `offline` (Last Will) y todos sus equipos se callan | Comunicaciones o el sitio |
| El equipo no responde | El gateway sigue vivo y publica `sin_respuesta` para ese equipo | Quien mantiene el controlador o la red del sitio |
| El sensor está en falla | El equipo responde, pero esa variable llega como centinela | Mantenimiento del grupo |

### Reglas de oro

- No inventar: un hueco es un hueco.
- No recortar: un valor imposible se marca, no se ajusta.
- No borrar: lo que no se puede recibir va a cuarentena, con su motivo.
- Informar con cuántos datos se calculó cada número.
- Corregir con nombre, motivo y aprobación.

---

## 6. Mantener un sistema que no se cae

### El ciclo

| Etapa | Qué incluye | Fases |
|---|---|---|
| Prevenir | Cambios con procedimiento, migraciones, cálculo de capacidad y retención | 16, 25, 26 |
| Detectar | Alertas por síntoma, sonda de punta a punta y vigilante | 23 |
| Diagnosticar | El método de seis pasos, con evidencia | 15 |
| Mitigar | Volver atrás, conmutar o reiniciar sabiendo qué se pierde | 15, 24, 25 |
| Resolver | La causa raíz | 15 |
| Aprender | Postmortem, procedimiento nuevo o mejorado y simulacro | 15, 25 |

### Cuando suena una alerta

Para decidir qué hacer en cada caso, usa la tarjeta de bolsillo y las tablas de `docs/CRITERIO.md`. El orden general es:

1. Anota la hora y lo que ves exactamente.
2. Define el alcance: un equipo, un sitio o todo.
3. Pregunta qué cambió: un despliegue, una configuración, una clave o un corte.
4. Sigue el dato por su camino, empezando por la mitad: equipo → gateway → broker → ingesta → base → API → pantalla.
5. Mitiga y comprueba que volvió.
6. Comunica.
7. Deja la ficha o el postmortem.

### Cómo comunicar un incidente

Cuatro líneas, cada 30 minutos mientras dure:
- **Qué pasa:** "Desde las 14:05 no llegan datos del sitio norte."
- **A quién afecta:** "Al dashboard y a la integración con el SCADA del cliente. Los equipos siguen operando normalmente."
- **Qué estamos haciendo:** "El gateway perdió el enlace; el buffer local guarda los datos y se enviarán al volver."
- **Próxima actualización:** "14:45."

Separa siempre el estado de los equipos del estado de la plataforma: "no vemos los datos" no es lo mismo que "el grupo está detenido".

---

## 7. Las primeras semanas en un sistema real

### Preguntas para hacer

**Inventario**
- ¿Qué sitios, equipos, controladores y firmware hay?
- ¿Qué gateways, y dónde corre cada servicio?

**Responsables**
- ¿Quién es dueño de cada pieza: la red del sitio, el controlador, el gateway, el enlace, la plataforma y el front?
- ¿A quién se llama en cada caso?

**Cambios**
- ¿Cómo se despliega, y quién aprueba?
- ¿Hay entorno de pruebas, y qué tan parecido es a producción?

**Datos**
- ¿Dónde están los respaldos, y cuándo se restauró uno por última vez?
- ¿Qué retención se acordó con los clientes?

**Vigilancia**
- ¿Qué alertas existen, quién las recibe y fuera de horario quién responde?
- ¿Cuáles fueron los últimos tres incidentes y qué se aprendió?

**OT**
- ¿Qué está permitido tocar y qué no?
- ¿Cuáles son las ventanas de mantenimiento, y quién autoriza una conexión a terreno?

**Regulación**
- ¿Algún cliente es un servicio esencial bajo la Ley 21.663 (por ejemplo, de generación, transmisión o distribución eléctrica)?
- Si es así, ¿qué obligaciones de reporte de incidentes alcanzan a la empresa?

### Lo que no se hace en las primeras semanas

- Cambiar producción sin el procedimiento de la empresa, aunque el arreglo parezca obvio.
- Reiniciar un servicio sin saber qué tiene en memoria.
- Conectar un equipo o una herramienta propia a una red OT.
- Escanear la red de control.
- "Limpiar" tablas, datos o archivos que parecen viejos.
- Crear accesos remotos propios.

### Cómo leer un sistema heredado

El método completo, con los cinco mapas y un plan de 30, 60 y 90 días, está en `docs/COMO-ABORDAR.md`. En corto:

1. Sigue un dato de punta a punta, desde el equipo hasta la pantalla, con el código abierto.
2. Dibuja tu propio mapa: servicios, colas, tablas y quién escribe en cada una.
3. Busca las configuraciones: variables de entorno, archivos de configuración del broker y tareas programadas.
4. Arma un laboratorio donde reproducir. Nunca experimentes en producción.
5. Anota cada duda con quién podría responderla.

---

## 8. Normas y referencias

| Norma o documento | De qué trata | Cuándo te sirve |
|---|---|---|
| IEC 62443 | Seguridad de sistemas de automatización: zonas, conductos y niveles de seguridad | Al diseñar redes y accesos (Fase 27) |
| ISA-95 / IEC 62264 y el modelo de Purdue | Niveles de una planta y su integración con los sistemas de gestión | Para ubicar cada pieza en su nivel |
| ISA-18.2 / IEC 62682 | Gestión de alarmas: ciclo de vida, racionalización, avalanchas | Al diseñar alarmas y avisos (Fase 21) |
| ISO 8528 | Grupos electrógenos: regímenes, desempeño y pruebas | Para entender la placa y el uso esperado de un grupo |
| SAE J1939 (-71, -73 y -75) | Mensajes del motor, diagnósticos (DM1) y grupos electrógenos | Al decodificar la ECU (fases 8 y 18) |
| Especificación Modbus | Funciones, excepciones y Modbus sobre línea serie | Al leer controladores (fases 7 y 18) |
| IEC 62541 (OPC UA) | Integración industrial con modelo de información y seguridad | Al integrar SCADA y EMS |
| IEC 61850 | Comunicaciones de subestaciones y protecciones | Si la microrred conversa con una subestación |
| MQTT 5.0 (OASIS) y Eclipse Sparkplug | Mensajería y su perfil industrial | Transporte y estado de equipos |
| NIST SP 800-82 | Guía de seguridad para OT | Referencia general de buenas prácticas |
| OpenAPI 3.1 y RFC 9457 | Contratos de API y formato de errores | Fase 22 |
| Ley 21.663 (Chile) | Marco de ciberseguridad. Incluye la generación, transmisión y distribución eléctrica, y los servicios de TI gestionados por terceros, entre los servicios esenciales, con reporte de incidentes al CSIRT nacional en un plazo máximo de 3 horas para la alerta temprana | Si la empresa o sus clientes caen en su alcance; confírmalo con el área legal o de seguridad |
| Ley 21.719 (Chile) | Protección de datos personales | Para los datos de personas que maneja la plataforma: usuarios y registros de acceso |

Esto es orientación técnica, no asesoría legal: el alcance de cada ley en la empresa lo confirma su área legal.

---

## 9. Glosario de la Parte 2 y de OT

| Término | Definición |
|---|---|
| Acta de puesta en servicio | Documento con las pruebas, los resultados y las firmas de la entrada en operación de un sitio. Es su línea base |
| Alarma (aviso, disparo, parada) | Condición anormal del equipo. El aviso no detiene nada; el disparo abre el interruptor; la parada detiene el motor |
| Alarma intermitente | La que se activa y se normaliza muchas veces en poco tiempo |
| Alerta accionable | La que exige que alguien haga algo ahora. Si no hay nada que hacer, no debería ser alerta |
| Archivo de datos | Sacar datos antiguos de la base a un almacenamiento más barato, de forma recuperable |
| Arranque | El período entre que el motor parte y se detiene, con su resumen de horas, energía y combustible |
| Artefacto inmutable | La imagen construida una vez por versión, que pasa igual de pruebas a producción |
| ATS | Tablero de transferencia automática: conmuta la carga entre la red y el grupo |
| AVR | Regulador automático de voltaje del alternador |
| Avalancha de alarmas | Tantas alarmas en poco tiempo que nadie distingue la importante. ISA-18.2 da como referencia más de 10 alarmas en 10 minutos por operador |
| Bandeja de salida (*outbox*) | El aviso se guarda en la base junto con el evento, y otro proceso lo envía y reintenta |
| Banda muerta | Cambio mínimo para volver a publicar un valor |
| Bandera de calidad | Un bit que marca un problema de un dato. Varias banderas se combinan en un número |
| Baja de equipo | Retiro ordenado: inactivo, credenciales revocadas y datos conservados según la retención |
| Binlog | Registro de todos los cambios de MySQL, en orden. Permite replicar y recuperar a un punto en el tiempo |
| C4 (modelo) | Cuatro niveles para describir un sistema: contexto, contenedores, componentes y código |
| CA (autoridad certificadora) | Quien firma los certificados. Confiar en la CA es confiar en lo que firma |
| Caducidad | Plazo después del cual una orden ya no vale |
| Cambio incompatible | Quitar o renombrar un campo, o cambiar su tipo, su unidad o su significado |
| Capacidad y holgura | Cuánto procesa el sistema antes de degradarse, y qué margen se deja libre |
| Catálogo canónico | La lista única de variables, con nombre, unidad, tipo y rangos, que usa toda la plataforma |
| Causa raíz | Por qué pudo ocurrir la falla, más allá de qué falló |
| Centinela | Valor reservado que significa "no hay medición" y no un número |
| CI (integración continua) | Pruebas y construcción automáticas en cada cambio propuesto |
| Clase de muestreo | Grupo de variables que se leen con el mismo período |
| Coherencia cruzada | Que las variables de un mismo instante cumplan entre sí las leyes de la física |
| Comando y consigna | El comando pide una acción; la consigna fija un valor objetivo |
| Compatibilidad hacia atrás | Lo nuevo sigue funcionando con la versión anterior de quien lo usa |
| Conducto | El único camino permitido entre dos zonas de red |
| Conexión saliente | La que inicia el sitio hacia afuera; el sitio no acepta conexiones entrantes |
| Consumo específico | Litros de combustible por kWh generado |
| Contador (vuelta y reinicio) | Variable acumulada que solo crece. Da la vuelta al llegar a su tope y se reinicia si cambian el controlador |
| Contador, medidor e histograma | Tipos de métrica: solo sube; sube y baja; reparte observaciones en tramos para calcular percentiles |
| Contrapresión | Cuando una etapa no da abasto, frena a la anterior en vez de perder datos |
| Contrato de API | El documento que fija qué recibe y qué devuelve cada ruta |
| Corrección como capa | El valor corregido se guarda aparte, con autor y motivo, sin tocar el crudo |
| CORS | Permiso que el servidor da al navegador para que una página de otro origen llame a la API |
| Cuarentena | Lugar donde se guarda lo que no se pudo recibir, con su motivo, para revisarlo y reprocesarlo |
| Cuatro ojos | Una persona pide y otra aprueba |
| Dato crudo | Lo que midió el equipo, tal como llegó |
| DDL en línea | Cambio de esquema que no bloquea la tabla mientras se aplica |
| Deriva | Dos bases o servidores que deberían ser iguales y no lo son |
| Desfase de reloj | Diferencia entre la hora de un equipo y la hora real |
| Diario local | Archivo donde la API guarda cada mensaje antes de confirmarlo, para no perderlo si se cae |
| Diátaxis | Marco que separa la documentación en cuatro tipos: aprender, resolver, consultar y entender |
| DM1, SPN y FMI | En J1939: el mensaje de fallas activas; la variable afectada; el modo de falla |
| DMZ industrial | Zona intermedia entre la planta y el resto. Los dos lados llegan a ella y ninguno la atraviesa |
| ECU | Unidad de control electrónico del motor |
| EMS | Sistema de gestión de energía: decide cuánto aporta cada fuente en una microrred |
| Enclavamiento | Condición que debe cumplirse para que una acción se permita |
| Entorno | Una copia completa del sistema con un propósito: desarrollo, pruebas o producción |
| Expandir y contraer | Cambiar en dos tiempos: primero se agrega lo nuevo y después se quita lo viejo |
| Factor de carga | Energía generada sobre la que se habría generado a potencia nominal en las mismas horas |
| Factor de potencia | Potencia activa sobre aparente. Indica cuánto de la corriente hace trabajo útil |
| Fallo seguro | Ante la duda o la pérdida de comunicación, quedar en el estado menos peligroso |
| FAT y SAT | Prueba en fábrica, con señales simuladas, y prueba en sitio, con el equipo real |
| Gobernador | Regulador de velocidad del motor |
| Informe por excepción | Publicar un valor solo cuando cambió más que la banda muerta |
| Isla y paralelo | En isla, el grupo alimenta solo a su carga; en paralelo, comparte con la red u otros grupos |
| Latido | Publicación periódica aunque nada cambie, para distinguir "sin cambios" de "sin comunicación" |
| Línea base | Cómo se ve el sistema sano, o el esquema desde el que se cuentan las migraciones |
| Linaje | Poder decir de dónde salió cada número y qué se le hizo |
| LOTO (bloqueo y etiquetado) | Procedimiento que impide energizar un equipo mientras alguien lo interviene |
| Medición y evento | La medición es un valor en un instante; el evento, un hecho con inicio y fin |
| Microrred | Fuentes y cargas que operan juntas, conectadas a la red o aisladas |
| Migración | Cambio de esquema en un archivo numerado que se aplica una sola vez y en orden |
| Mitigar y resolver | Devolver el servicio; eliminar la causa |
| Modelo de amenazas | Lista ordenada de qué puede salir mal, por dónde y qué lo cubre |
| Modelo de Purdue | Niveles de una planta, del sensor (0) a la red corporativa (4 y 5) |
| MTTD y MTTR | Tiempo medio hasta detectar una falla y hasta recuperarse |
| Número de secuencia | Contador por equipo que crece con cada mensaje. Delata pérdidas y duplicados |
| OpenAPI | Formato estándar para describir una API HTTP |
| OT y TI | Tecnología de operación (procesos físicos) y de la información (datos) |
| Paginación por cursor | Pedir "los siguientes después de este" en vez de "la página N" |
| Paridad de entornos | Que pruebas se parezca a producción en versiones, permisos y configuración |
| Percentil 95 | El valor bajo el cual queda el 95 % de las mediciones |
| Perfil de equipo | La descripción, como datos, de cómo leer un modelo de controlador |
| Persistencia del broker | Mosquitto guarda en disco sus sesiones y mensajes al apagarse en orden y cada `autosave_interval` (30 minutos por defecto). Una caída abrupta pierde lo posterior. La señal SIGUSR1 fuerza un guardado |
| Pico aislado | Una muestra que se aleja de sus dos vecinas más rápido de lo físicamente posible |
| Postmortem sin culpables | Análisis escrito de un incidente que busca qué lo permitió, no quién lo causó |
| Potencia activa, reactiva y aparente | kW: hace trabajo útil. kVAr: va y vuelve entre la fuente y las cargas inductivas o capacitivas. kVA: la combinación de las dos, que dimensiona al alternador |
| Potencia inversa | El generador absorbe potencia y trabaja como motor; es una protección en paralelo |
| *Premortem* | Antes de un cambio grande, imaginar que salió mal y anotar por qué, para prevenirlo |
| Presupuesto de error | Cuánto puedes fallar en un período sin incumplir el objetivo |
| Prueba punto a punto | Comparar cada señal, una por una, entre el equipo y la plataforma |
| Puertas de una vía y de dos vías | Decisiones irreversibles y reversibles. Las primeras se toman despacio y con respaldo; las segundas, rápido |
| Puesta en servicio | Pruebas que demuestran que lo instalado funciona como se diseñó |
| Punto | Entrada de un perfil: una variable con su dirección, tipo y escala |
| Radio de impacto | A cuántos sitios, equipos o usuarios afecta una falla |
| Rango físico y de operación | Fuera del físico, el valor es imposible; fuera del de operación, es posible pero anormal |
| Reconocer una alarma | Declarar que se vio. No la apaga: termina cuando la condición se normaliza |
| Recuperación a un punto en el tiempo | Restaurar un respaldo y aplicar el binlog hasta justo antes de un accidente |
| Reducción de puntos | Entregar una serie con menos puntos, sin esconder los extremos |
| Régimen (ESP, LTP, PRP, COP) | Para qué se dimensionó un grupo según ISO 8528 |
| Renovación de sesión | Un token de vida larga, revocable, que solo sirve para pedir tokens de acceso nuevos |
| Retención | Cuánto tiempo se conserva cada nivel de detalle |
| Retroceso exponencial | Tras cada fallo, esperar el doble antes de reintentar, hasta un tope |
| Revocación | Anular una credencial o un certificado antes de que venza |
| Rodilla de la curva | El punto donde, al subir la carga, el retraso se dispara |
| RPO y RTO | Cuántos datos puedes perder, medido en tiempo, y cuánto puedes tardar en volver |
| SIGTERM y SIGKILL | Señales para detener un proceso. SIGTERM le pide terminar en orden (`docker compose stop` o `restart`); SIGKILL lo mata sin aviso (`docker compose kill`) |
| Sincronización | Igualar voltaje, frecuencia y fase antes de conectar un grupo en paralelo |
| SLI y SLO | El indicador que mides y el objetivo que te comprometes a cumplir |
| Sonda de caja negra | Prueba que usa el sistema desde fuera, como un cliente |
| TLS mutuo | El cliente valida al servidor y el servidor exige un certificado al cliente |
| Valor pegado | Señal que repite exactamente el mismo valor mientras el equipo funciona |
| Ventana de mantenimiento | Horario acordado con la operación para hacer un cambio |
| Versión semántica | mayor.menor.parche; el número mayor sube cuando se rompe la compatibilidad |
| Vigilante | Alerta siempre encendida: si deja de llegar, lo caído es el monitoreo |
| Volver atrás y corregir hacia adelante | Ante la falla de un despliegue: regresar a la versión anterior, o desplegar un arreglo |
| *Wet stacking* | Combustible sin quemar que se acumula en el escape de un diésel que trabaja mucho tiempo con poca carga |
| Zona | Grupo de equipos con el mismo nivel de exigencia de seguridad |
