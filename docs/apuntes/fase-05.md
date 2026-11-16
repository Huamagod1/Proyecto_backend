# Fase 5 · Ingesta HTTP: validar y no duplicar

## Mapa
- `POST /api/lecturas` (rol gateway o admin) → zod valida la forma del lote (de 1 a 1000 lecturas).
- `evaluarLectura()` revisa cada lectura contra el catálogo en memoria: motor, sitio, variable y hora; el rango solo marca la calidad.
- `guardarLote()` escribe `lecturas` y `estado_actual` en una transacción; la PK absorbe los repetidos.
- La respuesta es un comprobante: `{ recibidas, nuevas, repetidas, fueraDeRango, rechazadas: [{ indice, motivo }] }`.

## Conceptos
- **Caché del catálogo:** `Map` por código, recargado cada 60 s y al escribir motores; evita una consulta por dato.
- **Idempotencia:** el mismo lote dos veces deja la base igual; la segunda responde `nuevas: 0`.
- **`-FOUND_ROWS`:** con este flag, `affectedRows` cuenta filas cambiadas: nueva = 1, repetida = 0.
- **Alias de fila (`AS nuevo`):** la fila entrante del upsert; reemplaza a `VALUES()`, obsoleto.
- **Transacción:** las dos escrituras se confirman o se deshacen juntas.
- **Deadlock:** dos transacciones que se esperan mutuamente; ordenar las filas igual lo evita.
- **Función pura:** `evaluarLectura` no toca base ni reloj (recibe `ahora`); se prueba sin infraestructura.

## Decisiones
- La forma inválida rechaza el lote entero (422); el dato inválido rechaza solo esa lectura → separa errores del cliente de problemas de terreno.
- Fuera de rango se guarda con `calidad = 1` → una falla real del motor no se borra.
- `estado_actual` solo se pisa con una lectura más nueva, con `ts` asignado al final → el buffer que drena tarde no retrocede el dashboard.
- Catálogo recargado al crear, editar o dar de baja un motor → no hay que esperar 60 s.
- `practica/lote-ejemplo.json` lo genera `npm run lote-ejemplo` → un JSON con horas fijas envejece (desvío: script extra).

## Comandos para saber de memoria
```bash
npm run lote-ejemplo
curl -s -X POST localhost:3000/api/lecturas -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d @practica/lote-ejemplo.json | jq
curl -s "localhost:3000/api/motores/MTR-01/lecturas?variable=rpm" -H "Authorization: Bearer $TOKEN" | jq
curl -s localhost:3000/api/motores/MTR-01/estado -H "Authorization: Bearer $TOKEN" | jq
```

## Preguntas de entrevista
- **¿Cómo evitas datos duplicados si el gateway reenvía?** Con una clave única por motor, variable y hora, y un `INSERT ... ON DUPLICATE KEY UPDATE`: la lectura repetida se ignora sin error. Un chequeo previo en el código falla con peticiones simultáneas.
- **¿Por qué aceptas el lote parcialmente?** Porque un motor desconocido no debe hacer perder las otras 999 lecturas buenas. El comprobante dice exactamente cuáles se rechazaron y por qué, y el gateway decide qué corregir.
- **¿Qué controles hace tu ingesta, en orden?** Token y rol; forma del lote; motor existente; motor del sitio del gateway; variable existente; hora razonable. El rango no rechaza: marca la calidad.

## Ejercicios a mano
1. Escribe de memoria `evaluarLectura`.
2. Agrega el motivo `exceso_por_motor`: más de 100 lecturas de un mismo motor en un lote.
