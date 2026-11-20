# Criterio para decidir rápido

El criterio no es saber todas las respuestas. Es saber qué preguntar primero, qué no se puede deshacer y cuándo pedir ayuda. Es lo que hace un buen operador de sala de control ante una alarma: primero asegura, después entiende y al final corrige.

**Cómo usarlo**
- Léelo completo una vez.
- Después, ten a mano la **tarjeta de bolsillo** (sección 1).
- Las tablas de la sección 3 resuelven los dilemas que se repiten.
- Los casos de la sección 4 son para estudiar. Para practicar, escribe `caso` en el chat del agente: te pone variaciones que no están aquí, para que decidas y no recuerdes.

Las cifras de los casos se midieron en el laboratorio: MySQL 8 con 3 millones de filas y un broker Mosquitto. Los mapas que se nombran (el camino del dato, el estado, los contratos) están en `docs/COMO-ABORDAR.md`.

---

## 1. Tarjeta de bolsillo

**El orden de prioridades.** Cuando dos chocan, gana la de más arriba.
1. Las personas.
2. Los equipos y el proceso del cliente.
3. La integridad de los datos: no perderlos ni corromperlos.
4. La disponibilidad del servicio.
5. La rapidez y la comodidad.

**Antes de actuar**
- ¿Se puede deshacer?
- ¿A quién afecta?
- ¿Qué evidencia tengo?
- ¿Dónde están los datos ahora mismo, y qué los destruye? Antes de reiniciar algo, pregúntate qué tiene en memoria o en cola.

**Antes de tocar producción**
- ¿Qué puede salir mal?
- ¿Cómo me daré cuenta?
- ¿Cómo vuelvo atrás?
- ¿Quién debe saberlo?
- ¿Respaldé lo que voy a tocar?

**Si dudas**
- No borres.
- No escribas hacia terreno.
- Respalda primero.
- Mitiga y después investiga.
- Pregunta, con una propuesta.

**Al diseñar cualquier pieza**
- ¿Qué pasa si se cae?
- ¿Y si el dato llega dos veces?
- ¿Y si llega tarde o desordenado?
- ¿Quién se entera?
- ¿Y con diez veces más volumen?

**Escala de inmediato si**
- hay riesgo para personas;
- se están perdiendo datos ahora;
- vas a hacer algo irreversible;
- un cliente está sin servicio;
- llevas 15 minutos sin una hipótesis.

---

## 2. Los principios, explicados

### 2.1 El orden de prioridades

La lista de la tarjeta no es arbitraria:
- **Las personas y los equipos van primero** porque la plataforma nunca protege a nadie, pero sí puede dañar: si escribe hacia terreno, o si un aviso que debía llegar no llega.
- **La integridad va antes que la disponibilidad** porque una plataforma caída, con los buffers funcionando, se recupera sola al volver. Un dato perdido o corrompido no vuelve. Por eso, ante un certificado robado, se revoca aunque el sitio quede unos días sin datos (caso 25): el buffer del gateway guarda lo que se mida, y los datos falsos no se pueden separar después.
- **La rapidez va al final,** pero no es irrelevante: cuando las cuatro de arriba están a salvo, lo rápido gana.

### 2.2 Puertas de una vía y de dos vías

Una decisión reversible se toma rápido. Una irreversible, despacio. Para reconocerlas, pregúntate: si me equivoco, ¿cómo vuelvo? Si la respuesta es "no se puede" o "con mucho trabajo", es una puerta de una vía.

| Reversible: decide en minutos, con un criterio de vuelta atrás | Irreversible, o casi: frena, respalda y pide una segunda opinión |
|---|---|
| Reiniciar un servicio sin datos en memoria | `DELETE`, `DROP`, `TRUNCATE` o `PURGE BINARY LOGS` sin un respaldo verificado |
| Desplegar una versión con vuelta atrás probada | Escribir hacia terreno |
| Asignar otra versión de un perfil | Reiniciar la API con datos en memoria, o matar el broker con su cola sin guardar |
| Cambiar el umbral de una alerta | Enviar un comunicado a un cliente |
| Silenciar avisos por un tiempo acotado | Revocar el certificado de un gateway que no puedes reinstalar a distancia |
| Crear un índice | Publicar un contrato de API que otros empiezan a usar |

### 2.3 Mitiga primero, entiende después

En un incidente, cada minuto lo paga el usuario. Primero devuelve el servicio (volver atrás, reiniciar si es seguro, aislar lo que falla) y después busca la causa raíz, sin apuro.

| Vuelve atrás si… | Corrige hacia adelante si… |
|---|---|
| El problema empezó con un cambio | Volver atrás es más riesgoso que el problema: por ejemplo, una migración ya aplicada que la versión anterior no entiende |
| Existe una versión anterior sana | El arreglo es pequeño, está probado y se despliega en minutos |
| El cambio no tocó contratos ni el esquema de forma incompatible | El problema no empeora con el tiempo |

### 2.4 Decide con evidencia, y di cuánta tienes

Separa tres cosas cuando hablas: lo que sabes, lo que crees y lo que no sabes todavía.

> "Sé que el gateway de norte está `offline` desde las 02:48. Creo que es un corte de energía del sitio, porque cayó sin despedirse. No sé todavía si los grupos arrancaron."

Una hipótesis dicha como un hecho manda a todos en la dirección equivocada.

### 2.5 Acota el tiempo

- **15 minutos sin una hipótesis:** escala, con lo que ya descartaste.
- **30 minutos sin mitigar:** pasa al plan B. Vuelve atrás, aísla el sitio que falla o avisa.
- **No decidir también es una decisión:** si esperas, di hasta cuándo y por qué.

### 2.6 Los hechos y las interpretaciones van separados

"El sensor indica que el nivel bajó del 80 % al 50 % en 10 minutos con el grupo detenido" es un hecho. "Robo de combustible" es una interpretación. Al cliente se le comunica el hecho, ahora, y la interpretación, cuando esté confirmada.

### 2.7 Lo que no se escribe, se pierde

Una decisión rápida se escribe después, en dos minutos: qué decidiste, con qué información y qué harías distinto. Las decisiones de diseño van en `docs/decisiones.md` y los incidentes, en un postmortem. Sin eso, la misma discusión se repite cada seis meses.

---

## 3. Tablas de decisión

### 3.1 Un dato raro: ¿marcar, apartar o corregir?

| Si el dato… | Haz | Nunca |
|---|---|---|
| Es imposible para la física | Guárdalo con bandera de dato malo | Recortarlo o borrarlo |
| Es posible pero anormal | Guárdalo con bandera de dato dudoso y mira si coincide con una alarma | Rechazarlo |
| Llega como centinela, o "sin dato" | Registra la ausencia con su motivo | Guardar 0 o repetir el último valor |
| No se puede interpretar (equipo desconocido, JSON roto) | Apártalo en cuarentena, con el contenido y el motivo | Descartarlo en silencio |
| Tiene un error sistemático conocido (unidad o escala) en una ventana acotada | Corrígelo en una capa aparte, con autor y aprobación | Un `UPDATE` sobre el crudo |
| Falta: hay un hueco | Muéstralo como hueco | Interpolar sin marcarlo |

### 3.2 Un incidente: ¿reiniciar, volver atrás o esperar?

| Si… | Entonces |
|---|---|
| Los datos muestran un riesgo para personas (una alarma de incendio o una fuga) | Avisa de inmediato al contacto de emergencia del sitio, según el protocolo. El diagnóstico de la plataforma espera |
| Un cambio reciente coincide con el inicio | Vuelve atrás ese cambio |
| Un proceso no responde y no tiene datos en memoria | Reinícialo |
| Un proceso tiene datos en memoria (hoy, el loteador de la API) | Primero arregla la dependencia (la base o el broker). Reinicia solo si aceptas perder lo pendiente |
| Un servicio tiene datos en cola (el broker) | Fuerza el guardado (`docker compose kill -s SIGUSR1 mosquitto`) y reinícialo en orden |
| La causa es externa (el enlace o la energía del sitio) | Registra, avisa al responsable y vigila que el buffer no se llene |
| Llevas 15 minutos sin saber qué pasa | Escala, con lo que ya descartaste |

### 3.3 Un pedido: ¿sí, sí pero distinto, o no por ahora?

| Pregunta | Si la respuesta es sí |
|---|---|
| ¿Rompe un contrato que otros usan? | Se hace agregando, o con una versión nueva |
| ¿Cambia la capacidad (más frecuencia, más datos, más tiempo guardado)? | Se calcula antes de aceptar |
| ¿Toca la seguridad o el terreno (accesos, escritura, puertos)? | Pasa por el procedimiento y la aprobación de quien opera |
| ¿Necesita una definición que no existe (un indicador, una regla)? | Primero se acuerda la definición |
| ¿Es reversible y barato? | Se hace rápido, con un criterio de vuelta atrás |

"Sí, pero distinto" casi siempre sirve más que un "no": responde al objetivo de quien pide, sin el costo que no vio.

### 3.4 ¿Dónde va esta lógica?

| Lógica | Va en | Por qué |
|---|---|---|
| Protecciones y control rápido | El controlador del grupo | Funciona aunque se corte todo lo demás |
| Traducción de protocolo, horas y buffer | El gateway | Es lo más cercano al equipo que todavía es software tuyo |
| Integraciones rápidas en terreno | Node-RED | Se ajusta sin programar, pero cuesta probarlo y versionarlo |
| Validación y calidad en la entrada | La ingesta de la API | Un solo lugar, igual para todos los gateways |
| Agregados y reglas sobre la serie completa | La base y el lote de calidad | Necesitan ver muchas filas a la vez |
| Estados derivados: alarmas, arranques, indicadores | El backend | Una sola definición para todas las pantallas e informes |
| Formato, colores y unidades de visualización | El front | Es presentación: no decide qué es verdad |

### 3.5 ¿Qué tan grave es, y a quién se avisa?

| Gravedad | Cuándo | Qué haces | A quién y cuándo |
|---|---|---|---|
| Crítica | Riesgo para personas, pérdida de datos en curso o un cliente sin servicio | Mitigar ya | Al responsable de turno, ahora. Al cliente, según el contrato |
| Alta | Servicio degradado sin pérdida: atraso en la ingesta, un sitio a ciegas | Mitigar en horas | Al canal del equipo, ahora. Al cliente, si dura más de lo acordado |
| Media | Un riesgo con fecha: disco al 85 %, un certificado que vence en 15 días | Planificar esta semana | Un ticket con responsable y fecha |
| Baja | Una mejora | Al backlog | — |

Los nombres y los plazos los fija cada empresa. Esta tabla es una base para pensar.

### 3.6 ¿Lo hago yo o lo escalo?

| Lo haces tú si… | Lo escalas si… |
|---|---|
| Es reversible | Es irreversible |
| Está dentro de tu área (la plataforma) | Está fuera de tu área: la red del sitio, el controlador o el enlace |
| Existe un procedimiento | No hay procedimiento y el impacto es alto |
| No afecta a clientes, o el procedimiento ya prevé cómo avisar | Afecta a un cliente y nadie le ha avisado |

Escalar no es rendirse: llega con lo que ya revisaste, tu hipótesis y una propuesta.

---

## 4. Casos reales

Situaciones típicas de una plataforma de telemetría de grupos electrógenos y microrredes. Cada caso trae:
- la situación, con datos parciales, como en la vida real;
- lo que se revisa en los primeros 5 minutos;
- la decisión y el porqué;
- lo que no harías;
- lo que cambiaría la decisión;
- la fase del plan donde se practica.

### A. Terreno y comunicaciones

#### 1. Un sitio minero se calla a las 03:10

**Situación.** 03:10. Alerta de silencio: los cuatro grupos de un sitio minero no envían datos desde las 02:48. El estado retenido del gateway dice `offline`, publicado por su Last Will. Los demás sitios están normales.

**Primeros 5 minutos**
- ¿Es solo ese sitio? Sí: la plataforma está bien; el problema está del gateway hacia el sitio.
- ¿Qué mostraban los últimos datos? Revisa `red_disponible`, los estados y las alarmas entre las 02:40 y las 02:48.
- ¿Había un mantenimiento o un corte informado en ese sitio?

**Decisión.** Depende del último dato:
- **Si la red estaba normal,** lo más probable es un corte del enlace o de la energía del gateway. Gravedad alta: registra, avisa al contacto del sitio según el contrato y vigila. Si el gateway sigue con energía, su buffer guarda los datos.
- **Si la red estaba cayendo,** puede haber una emergencia en curso y estás a ciegas. Sube la gravedad y avisa ahora al contacto de turno del sitio.

**Por qué.** El mismo síntoma cambia de gravedad según el contexto. Un Last Will significa que el gateway se fue sin despedirse: un corte, no un apagado ordenado.

**No harías.** Despertar a todos sin mirar el último dato, ni reiniciar nada en la plataforma: la plataforma está sana.

**Cambiaría si…** varios sitios se callan a la vez. Entonces el problema está en la plataforma o en un enlace compartido.

**Practica en:** fases 15, 18 y 23.

#### 2. Cae el combustible a las 02:00, con el grupo detenido

**Situación.** 02:04. El nivel de combustible de un grupo de emergencia bajó del 80 % al 50 % en 10 minutos. El grupo está detenido.

**Primeros 5 minutos**
- ¿La calidad del dato es buena, o ese sensor tiene antecedentes?
- ¿Fue un escalón instantáneo (típico de un sensor o un conector) o una bajada continua (típica de una fuga o una extracción)?
- ¿Las demás variables del sitio se ven normales?

**Decisión.** Avisa ahora al cliente, según el protocolo acordado, con hechos: "El sensor indica una baja del 80 % al 50 % en 10 minutos con el grupo detenido. Aún no confirmamos la causa".

**Por qué.** Si es una fuga o una extracción, el tiempo importa, y hay personas y bienes en juego. Pero la causa no está probada: los hechos se comunican, y las interpretaciones se marcan como tales.

**No harías.** Esperar a estar seguro para avisar, ni escribir "robo de combustible".

**Cambiaría si…** el escalón coincidió con una falla de comunicación o con un cambio de calidad. Entonces es más probable el sensor, y el aviso lo dice.

**Practica en:** fases 19, 20 y 21.

#### 3. 400 alarmas en una hora

**Situación.** Un sitio generó 400 eventos de alarma en la última hora, y el canal de avisos está saturado.

**Primeros 5 minutos.** ¿Es un mismo código que se activa y se normaliza una y otra vez (una alarma intermitente), o son muchos códigos a la vez (una causa común, como la energía del sitio o la comunicación)?

**Decisión.** Silencia los avisos de ese sitio o de ese código por un tiempo acotado (por ejemplo, 2 horas), con un responsable y una nota, mientras se sigue registrando todo. Avisa al sitio y busca la causa.

**Por qué.** Una avalancha esconde la alarma que importa. Silenciar el aviso no es borrar el evento: el historial es justamente el diagnóstico.

**No harías.** Desactivar la alarma para siempre, ni borrar eventos.

**Cambiaría si…** entre las 400 hay una alarma de parada: esa se atiende primero, sin importar el ruido.

**Practica en:** Fase 21.

#### 4. Un firmware nuevo y la frecuencia marca 500 Hz

**Situación.** El proveedor actualizó ayer los controladores de un sitio. Desde entonces, la frecuencia de esos grupos marca 500 Hz, y la potencia sigue normal.

**Primeros 5 minutos.** ¿Afecta solo a los equipos actualizados? ¿Qué otras variables cambiaron de escala? Compara con la pantalla del controlador.

**Decisión**
1. Crea una versión nueva del perfil para ese firmware y asígnala a esos equipos.
2. La ventana afectada ya debería tener bandera de valor imposible. Corrígela en capa, con un factor de 0,1 y la aprobación de otra persona.
3. Pide al proveedor las notas de la versión y anota el firmware en el acta del sitio.

**Por qué.** Un perfil describe un firmware: si cambia el firmware, cambia el perfil. El crudo queda como llegó.

**No harías.** Editar el perfil anterior, ni reescribir los valores en `lecturas`.

**Cambiaría si…** no es un cambio de escala sino de dirección: otra variable ocupa ese registro. Entonces la ventana completa se marca como mala y no se corrige con un factor.

**Practica en:** fases 17, 19, 20 y 29.

#### 5. Un enlace satelital caro

**Situación.** Un sitio remoto usa un enlace satelital que se cobra por MB. El cliente pide bajar la factura a la mitad.

**Primeros 5 minutos.** Mide cuánto envía hoy cada equipo, y qué variables pesan más.

**Decisión.** Ajusta el perfil por clases: banda muerta y latido en las analógicas, contadores cada minuto y estados solo al cambiar. Acuerda con el cliente qué variables pueden ir más lento. Calcula el ahorro antes de cambiar, y mídelo después.

**Por qué.** La mayor parte del volumen suele ser valores que no cambian. Con una banda muerta de 0,5 °C y un latido cada 5 minutos, una temperatura estable pasa de 360 mensajes por hora a unos 16.

**No harías.** Bajar todo a un envío cada 5 minutos: perderías los arranques y las alarmas.

**Practica en:** fases 18 y 26.

#### 6. Un técnico pide reconocer alarmas a distancia

**Situación.** Un técnico en terreno pide habilitar la escritura Modbus para reconocer alarmas desde la plataforma y ahorrarse un viaje de 3 horas.

**Decisión.** Hoy no. Que el operador del sitio la reconozca en el equipo, o que el técnico viaje si es necesario. Si el pedido se repite, se evalúa como un proyecto, con la operación del cliente (Fase 28).

**Por qué.** En muchos controladores, reponer una alarma de parada desbloquea el arranque: si el grupo está en automático y hay una orden de partida, arranca. Hecho a distancia, sin ver el equipo, puede poner en riesgo a quien esté trabajando en él.

**No harías.** Habilitarlo "solo para ese equipo".

**Cambiaría si…** existe un procedimiento aprobado de operación remota para ese sitio. Entonces se sigue, con sus barreras.

**Practica en:** Fase 28.

### B. Datos y calidad

#### 7. El informe mensual dice 0 horas de marcha

**Situación.** El cliente reclama: el informe de octubre dice 0 horas de marcha para MTR-12, y su operador lo vio funcionar varios días.

**Primeros 5 minutos**
- ¿Llegaron datos de MTR-12 en octubre? Mira la completitud del mes.
- ¿Qué hizo el contador de horas? Si retrocedió por un cambio de controlador o un reinicio, el incremento pudo calcularse mal.
- ¿Cambió el perfil o el firmware ese mes?

**Decisión.** No edites el informe a mano. Encuentra la causa con datos. Si fue un reinicio del contador, regístralo en `contadores_eventos`, recalcula los agregados de esa ventana y reemite el informe con una nota que explique la corrección.

**Por qué.** Un número corregido a mano no se puede auditar, y el mismo error se repite el mes siguiente.

**No harías.** Poner "las horas que dice el operador" sin evidencia, ni prometer una fecha antes de conocer la causa.

**Cambiaría si…** no llegaron datos. Entonces el informe no debió decir "0 horas", sino "sin datos": es otro problema, de completitud, y el informe tiene que mostrarlo.

**Practica en:** fases 20 y 21.

#### 8. "Borra esos picos antes de la reunión"

**Situación.** Tu jefe te pide sacar del gráfico de temperatura unos picos que "se ven mal", porque en una hora presenta al cliente.

**Primeros 5 minutos.** Mira la calidad de esos puntos, y si coinciden con alarmas o con un arranque.

**Decisión**
- **Si están marcados como malos** (picos aislados, valores imposibles), la vista "solo datos buenos" es legítima. Se presenta diciendo que excluye lecturas marcadas como inválidas.
- **Si son reales** (coinciden con una alarma de sobretemperatura), no se esconden: son lo más importante del gráfico. Hay que llegar a la reunión con la explicación.

**Por qué.** El crudo no se borra; lo que cambia es qué se muestra y con qué etiqueta. Esconder un evento real frente al cliente es un riesgo mucho mayor que un gráfico feo.

**No harías.** Un `DELETE` sobre `lecturas`, ni un gráfico editado sin aviso.

**Practica en:** fases 19, 20 y 22.

#### 9. Un gateway con el reloj dos horas atrasado durante un mes

**Situación.** Descubres que un gateway estuvo un mes con el reloj dos horas atrasado. Todos sus datos tienen la hora corrida.

**Primeros 5 minutos.** ¿El desfase fue constante? La métrica de desfase de reloj, o la comparación entre `ts` y `recibido_en`, lo dice.

**Decisión.** Corrige hoy la sincronización de hora del gateway. Para el pasado:
- si el desfase fue constante y está demostrado, una corrección en capa que desplaza la hora, con aprobación;
- si no, marca la ventana como "hora dudosa" y exclúyela de los análisis sensibles al tiempo, como arranques y alarmas.

**Por qué.** La hora es parte del dato. Corregirla es corregir un dato, con las mismas reglas: evidencia, una capa aparte y un autor.

**No harías.** Un `UPDATE` que mueva `ts` en `lecturas`: es parte de la PK, y chocarías con otras lecturas.

**Practica en:** fases 19 y 20.

#### 10. La ECU y el controlador no coinciden

**Situación.** Para el mismo grupo, la ECU, por J1939, informa 1.500 rpm, y el controlador, por Modbus, 1.487 rpm.

**Decisión.** Una fuente de verdad por variable, escrita en el catálogo: por ejemplo, las rpm de la ECU, que las mide directo. La otra se guarda como una variable aparte (`rpm_controlador`) o no se guarda. Alerta solo si la diferencia supera una tolerancia acordada: eso sí indica un sensor que se desvía.

**Por qué.** Una diferencia de 13 rpm (0,9 %) es normal entre dos mediciones distintas. Lo que no puede pasar es que dos pantallas muestren números distintos para "las rpm" sin que nadie sepa cuál vale.

**No harías.** Promediarlas, ni guardar las dos en la misma variable.

**Practica en:** fases 17 y 20.

#### 11. Datos crudos de hace dos años

**Situación.** Un cliente pide los datos crudos de 2024 para un peritaje. La retención del crudo es de 90 días.

**Decisión.** Dile qué existe: los agregados por minuto y por hora, y las particiones archivadas, si se archivaron. Lo que no existe no se reconstruye.

**Por qué.** Archivar en vez de borrar es lo que permite responder "sí, pero tarda". Un peritaje necesita además evidencia de integridad: el manifiesto de cada archivo, con su conteo y su SHA-256.

**No harías.** Entregar agregados presentados como si fueran crudos.

**Practica en:** fases 20 y 26.

### C. Plataforma, base de datos y capacidad

#### 12. Hay que reiniciar el servidor del broker con mensajes en cola

**Situación.** Hay que reiniciar el servidor donde corre el broker para aplicar una actualización de seguridad. La API está detenida por otro mantenimiento, así que el broker tiene en cola varios minutos de datos.

**Primeros 5 minutos.** ¿Cuánto hay en cola? ¿El reinicio del servidor detendrá los contenedores en orden?

**Decisión**
1. Pide al broker que guarde su cola en disco: `docker compose kill -s SIGUSR1 mosquitto`.
2. Detén el broker en orden (`docker compose stop mosquitto`) antes de reiniciar el servidor.
3. Al volver, comprueba que la API recuperó su sesión (`mqtt_conectado` con `sesion: "recuperada"`) y que el tramo llegó.

**Por qué.** Mosquitto guarda su cola en disco al apagarse en orden y cada 30 minutos; una detención forzada pierde lo intermedio. En la prueba, una caída abrupta perdió los 10 mensajes que había en cola, y la sesión volvió como nueva. Con SIGUSR1 antes de la caída, se conservaron los 10.

**No harías.** Reiniciar el servidor sin detener antes los servicios que tienen datos en cola.

**Cambiaría si…** la API está conectada y al día. Entonces la cola está casi vacía, y basta un reinicio ordenado.

**Practica en:** fases 15 y 26.

#### 13. La migración lleva 20 minutos y la ingesta está detenida

**Situación.** Lanzaste una migración en producción. Lleva 20 minutos y la ingesta no escribe: los gateways guardan en su buffer y la cola del broker crece.

**Primeros 5 minutos.** ¿Qué es exactamente: un `ALTER` que copia la tabla, o un `UPDATE` masivo? `SHOW PROCESSLIST` e `information_schema.INNODB_TRX` lo dicen. ¿Cuánto falta para que se llene la cola del broker?

**Decisión**
- **Si es un `ALTER` que copia la tabla:** cancelarlo suele ser rápido y deja la tabla original intacta. En la prueba, con 3 millones de filas, se canceló en 0,2 s, y la tabla quedó igual.
- **Si es un `UPDATE` o un `DELETE` masivo:** cancelarlo dispara una vuelta atrás que puede tardar más que lo ya hecho. En la prueba, 8 s de avance costaron 10 s de vuelta atrás. Muchas veces conviene dejarlo terminar, vigilando la cola del broker.

En los dos casos, avisa que la ingesta está atrasada.

**Por qué.** Cancelar no siempre es volver rápido. Lo que decide es cuánto cuesta deshacer.

**No harías.** Reiniciar MySQL a mitad de camino: la vuelta atrás ocurre igual al arrancar, y la caída se alarga.

**Cambiaría si…** la cola del broker se va a llenar antes de que termine. Entonces conviene cancelar, aceptando la vuelta atrás.

**Practica en:** fases 16 y 26.

#### 14. El disco de la base al 91 %, subiendo 2 puntos por día

**Situación.** El disco del servidor de base de datos está al 91 % y sube 2 puntos por día. Quedan unos 4 días.

**Primeros 5 minutos.** Mide qué crece: tablas, índices, binlogs, logs y respaldos locales.

**Decisión**
- **Hoy:** si los binlogs son una parte grande, purga los más antiguos que ya no necesitas (`PURGE BINARY LOGS BEFORE ...`). Conserva siempre los posteriores al último respaldo verificado.
- **Esta semana:** archiva y suelta la partición más antigua, según la retención acordada.
- **Después:** recalcula la capacidad, y ajusta la retención o el disco.

**Por qué.** Hay tiempo para hacerlo bien, pero no para postergarlo. Y un `DELETE` masivo empeora las cosas: en la prueba, borrar la mitad de una partición tardó 6 s, dejó su archivo en 88 MB igual que antes y sumó el borrado al binlog. Soltar la partición tardó 0,4 s y eliminó el archivo completo.

**No harías.** Borrar archivos del motor con `rm`, ni un `DELETE` "para hacer espacio".

**Cambiaría si…** el crecimiento se aceleró de golpe. Entonces primero busca qué cambió: una carga de volumen, un log sin rotación o un respaldo que no se borra.

**Practica en:** fases 24 y 26.

#### 15. Un `UPDATE` sin `WHERE` en producción

**Situación.** A las 15:02, alguien ejecutó un `UPDATE` sin `WHERE` que dejó en 0 el máximo del rango de todas las variables. Desde entonces, casi todas las lecturas entran como fuera de rango.

**Primeros 5 minutos.** ¿Qué se dañó, y qué se puede recalcular? Los valores crudos están intactos; solo están mal el catálogo y las banderas de calidad.

**Decisión**
1. Recupera `variables` tal como estaba a las 15:01: restaura el respaldo en otra instancia y aplica el binlog hasta justo antes de esa transacción.
2. Copia a producción solo `variables`, y recarga el catálogo.
3. Recalcula las banderas y los agregados desde las 15:02 con el lote de calidad.
4. Postmortem: ¿por qué alguien podía ejecutar eso en producción?

**Por qué.** Antes de restaurar todo, pregúntate qué se puede recalcular. Aquí, el daño real es una tabla chica; el resto se recalcula.

**No harías.** Restaurar la base completa encima de producción: perderías las lecturas buenas posteriores al respaldo.

**Cambiaría si…** el error hubiera tocado los valores de `lecturas`. Entonces sí es una recuperación a un punto en el tiempo de esa tabla, con la ingesta detenida.

**Practica en:** fases 16, 20 y 24.

#### 16. ¿Volver atrás o corregir hacia adelante?

**Situación.** Tras el despliegue de las 11:00, la serie de algunos equipos responde 500. El arreglo parece claro: un campo nulo que el código no esperaba.

**Decisión.** Vuelve atrás primero, salvo que el despliegue incluya una migración que la versión anterior no soporta. Corrige con calma, con una prueba que reproduzca el caso, y vuelve a desplegar.

**Por qué.** "Parece claro" es una hipótesis. Volver atrás devuelve el servicio en minutos y te deja investigar sin presión.

**No harías.** Editar el código en el servidor.

**Cambiaría si…** volver atrás es más riesgoso que el problema: el esquema cambió y el código anterior no lo entiende. Entonces se corrige hacia adelante, con el arreglo mínimo y probado.

**Practica en:** Fase 25.

#### 17. Viernes, 17:40: una unidad mal mapeada

**Situación.** Viernes a las 17:40. Descubres que el perfil de un modelo declara la presión de aceite en kPa, pero el controlador la entrega en psi. Desde el martes, esos equipos guardan presiones 6,9 veces más bajas. El arreglo es una línea del perfil.

**Primeros 5 minutos.** ¿Cuántos equipos, y desde cuándo? ¿Queda alguien disponible una hora si algo sale mal? ¿El cambio se puede probar en el entorno de pruebas?

**Decisión**
- Si lo puedes probar en 30 minutos y queda alguien atento, arréglalo hoy. Es una versión nueva del perfil, y se revierte asignando la anterior.
- Si no, deja hoy documentada la ventana (desde cuándo, qué equipos y qué factor) y el arreglo listo para el lunes a primera hora.

**Por qué.** Cada hora entran datos mal guardados: es integridad, que está sobre la comodidad. Pero un despliegue sin prueba y sin nadie mirando puede agregar un segundo problema.

**No harías.** Corregir los datos pasados con un `UPDATE`, ni desplegar sin un criterio de vuelta atrás.

**Cambiaría si…** la presión mal escalada está disparando alarmas falsas de baja presión en la operación del cliente. Entonces se arregla ahora, con lo que haya.

**Practica en:** fases 17, 20 y 25.

### D. Personas, clientes y front

#### 18. El front quiere renombrar un campo para mañana

**Situación.** El encargado del front pide que `gen_potencia_activa` se llame `potencia_kw` en la API, "porque es más claro", para mañana.

**Decisión.** Sí al objetivo, no al renombre. Que el front lo llame como quiera en su propio código. Si hay una razón de fondo, se agrega el campo nuevo y se anuncia el antiguo como obsoleto, con fecha.

**Por qué.** Renombrar rompe a todos los que usan el contrato: integraciones, informes y la versión anterior del propio front. Agregar no rompe a nadie.

**No harías.** Cambiar el nombre en `/api/v1` "porque solo lo usa el front".

**Cambiaría si…** la API todavía no tiene usuarios en producción. Entonces se puede cambiar antes de publicarla.

**Practica en:** Fase 22.

#### 19. Un indicador nuevo para mañana

**Situación.** La gerencia pide para mañana la "eficiencia" de cada grupo en el dashboard.

**Decisión.** Mañana entregas una definición acordada y un piloto, no un número inventado:
1. Acuerda con quien lo pide qué significa; por ejemplo, el consumo específico en L/kWh.
2. Define cuándo no aplica: motor detenido, o carga bajo el 10 %.
3. Calcúlalo en el backend, con la calidad de los datos que usa, y muéstralo para un equipo.
4. Extiéndelo a la flota cuando la definición esté validada.

**Por qué.** Un indicador mal definido se usa igual para decidir. Y si se calcula en el front, cada pantalla lo calcula distinto.

**No harías.** Una fórmula en el front sin acuerdo, ni promediar porcentajes de equipos de distinto tamaño.

**Cambiaría si…** ya existe una definición estándar en la empresa o en el contrato. Entonces se usa esa.

**Practica en:** fases 20, 21 y 22.

#### 20. "Tiempo real de verdad": cada 100 ms

**Situación.** Te piden que el tablero se actualice cada 100 ms.

**Decisión.** Pregunta qué decisión necesita esa velocidad. El control vive en el controlador; un tablero de monitoreo se lee bien con un dato por segundo. Propón 1 s para pocas variables (estado y potencia), enviadas por WebSocket desde el último valor, sin guardar cada muestra.

**Por qué.** Cada 100 ms son diez veces más mensajes, enlace, base y CPU, para un ojo que no aprovecha la diferencia.

**No harías.** Aceptar sin calcular, ni negar sin preguntar.

**Cambiaría si…** es el análisis de un transitorio, como una toma de carga. Eso se resuelve con una captura local de alta frecuencia, acotada en el tiempo, no con el tablero.

**Practica en:** fases 18, 22 y 26.

#### 21. El cliente quiere conectar su Power BI a la base

**Situación.** Un cliente pide un usuario de MySQL para conectar su Power BI a la base de producción.

**Decisión.** Sí a los datos, no a la base. Las opciones son:
- la API de integración;
- una exportación periódica;
- una réplica de solo lectura, con una cuenta propia que solo ve sus datos.

**Por qué.** El acceso directo trae consultas pesadas sobre producción, un esquema que ya no podrás cambiar (su informe depende de él) y el riesgo de que vea datos de otros clientes.

**No harías.** Darle una cuenta de producción "solo de lectura" que ve todas las tablas.

**Cambiaría si…** el volumen lo justifica y existe la réplica. Entonces, una vista por cliente, con contrato y aviso de cambios.

**Practica en:** fases 22 y 27.

#### 22. "El grupo se detuvo y nadie avisó"

**Situación.** El cliente llama molesto: anoche su grupo se detuvo por una falla y la plataforma no avisó.

**Primeros 5 minutos.** Revisa los datos: ¿llegó la alarma? ¿Había una regla de aviso para esa alarma? ¿Falló el envío? ¿El equipo estaba comunicando?

**Decisión.** Responde con hechos y un plazo: "Lo estamos revisando; a las 10:00 le enviamos qué pasó y qué vamos a cambiar". Después, el postmortem.

**Por qué.** En caliente, lo útil es no prometer ni culpar. La respuesta depende de qué falló: el dato, la regla, el envío o la expectativa. Quizás esa alarma nunca estuvo configurada para avisar.

**No harías.** Decir "la plataforma no es para eso" en la primera llamada, ni prometer "nunca más".

**Practica en:** fases 21, 23 y 25.

#### 23. La alerta que suena todas las noches

**Situación.** La alerta de silencio de un sitio suena todas las noches a las 02:00, unos 10 minutos. Nadie hace nada.

**Decisión.** Esta semana se le asigna un responsable y se encuentra la causa: un reinicio programado del router, un respaldo que bloquea o un mantenimiento del enlace. Si es algo esperado, se declara como ventana de mantenimiento; si es una falla, se arregla.

**Por qué.** Una alerta que todos ignoran enseña a ignorarlas todas. Cada alerta debe exigir una acción.

**No harías.** Subir el umbral hasta que deje de sonar, sin saber por qué sonaba.

**Practica en:** Fase 23.

### E. OT y seguridad

#### 24. El EMS del cliente quiere mandar consignas por la plataforma

**Situación.** El cliente quiere que su EMS envíe consignas de potencia a los grupos a través de la plataforma.

**Decisión.** No se improvisa. Primero, una reunión técnica con la operación del cliente y quien mantiene los controladores, y un documento de requisitos:
- la latencia aceptable;
- qué pasa si se corta la comunicación;
- quién tiene la última palabra;
- cómo se audita.

Mientras tanto, solo lectura.

**Por qué.** Es control, no monitoreo: cambia la clase de riesgo. El control de una microrred vive cerca del proceso, y una consigna que viaja por internet necesita caducidad, fallo seguro y enclavamientos.

**No harías.** Habilitar escritura Modbus "temporal" para probar con un equipo en servicio.

**Practica en:** fases 27 y 28.

#### 25. Robaron el notebook con el certificado de un gateway

**Situación.** Robaron el notebook de un técnico, que tenía una copia del certificado y la llave del gateway de un sitio.

**Primeros 5 minutos.** ¿Qué puede hacer quien tenga ese certificado? Publicar datos falsos de ese sitio (la ACL lo limita a su sitio). No puede controlar nada, porque no existe un camino de escritura hacia terreno.

**Decisión**
1. Emite un certificado nuevo para ese gateway e instálalo a distancia, si se puede.
2. Revoca el antiguo.
3. Si no se puede instalar a distancia, revoca igual y coordina la visita. El buffer del gateway guarda lo que se mida mientras tanto, hasta su tope.
4. Mientras no esté resuelto, vigila en el log del broker conexiones con esa identidad desde una IP distinta a la del sitio.
5. Informa al responsable de seguridad de la empresa. Si la empresa está bajo la Ley 21.663, hay plazos de reporte.

**Por qué.** La integridad va antes que la disponibilidad. Un sitio sin datos por unos días se recupera desde el buffer; datos falsos mezclados con los reales, no.

**No harías.** Esperar a la visita para revocar, ni seguir usando la misma llave "porque el notebook tenía clave".

**Cambiaría si…** ese certificado sirviera para escribir hacia terreno. Entonces se revoca de inmediato, sin discusión.

**Practica en:** Fase 27.

#### 26. Un compañero quiere subir el `.env` al repositorio privado

**Situación.** Un compañero propone subir el `.env` con las claves al repositorio privado, "para que todos lo tengan".

**Decisión.** No. Las claves van en un gestor de secretos. El repositorio lleva `.env.example` sin valores reales y un documento que explica cómo obtenerlas.

**Por qué.** Un repositorio privado se clona en cada notebook y se conecta con otras herramientas, y su historia es para siempre: una clave que entra queda en todos los commits, aunque después se borre.

**No harías.** Aceptarlo "solo por ahora".

**Practica en:** Fase 27.

---

## 5. Cómo comunicar una decisión rápida

Cuatro líneas, por escrito, en el canal del equipo:
- **Decidí:** qué vas a hacer.
- **Porque:** la razón, en una frase.
- **El riesgo que acepto:** lo que puede salir mal.
- **Si sale mal:** cómo vuelves atrás, o qué harás.

Ejemplo, con el caso 17:

> **Decidí:** desplegar hoy la nueva versión del perfil del modelo X.
> **Porque:** cada hora entran presiones mal guardadas.
> **El riesgo que acepto:** un despliegue un viernes, probado en el entorno de pruebas.
> **Si sale mal:** vuelvo a asignar la versión anterior del perfil. Me quedo atento hasta las 19:00.

Para informar un incidente en curso, usa las cuatro líneas de `docs/OT-TI.md`, sección 6: qué pasa, a quién afecta, qué estamos haciendo y cuándo es la próxima actualización.

---

## 6. Cómo se entrena el criterio

- **`caso`:** el agente te pone una situación nueva, con datos parciales. Tienes 2 minutos para decidir y justificar, y puedes hacer hasta tres preguntas. Después te dice qué haría alguien con experiencia y qué habría cambiado la decisión. Cada caso queda en `docs/casos.md`.
- **Los simulacros:** decidir con el sistema roto de verdad (Fase 15).
- **Revisar cada decisión:** después de un simulacro o un incidente, responde por escrito: ¿qué decidí, con qué información, y qué haría distinto?
- **El *premortem*, antes de un cambio grande:** imagina que salió mal mañana. Escribe las tres causas más probables, y agrega un control para cada una.
- **Leer postmortems ajenos:** muchas empresas publican los suyos. Son criterio ajeno gratis.

Las señales de que el criterio mejora: en los `caso`, tus primeras preguntas son las mismas que haría alguien con experiencia, y sabes decir qué cambiaría tu decisión.
