/**
 * generar-lote-ejemplo.js · escribe practica/lote-ejemplo.json con horas de "ahora" (Fase 5).
 * POR QUÉ un script: un JSON con horas fijas envejece; a los 30 días todas sus lecturas serían
 * hora_demasiado_antigua. Regenerarlo deja el mismo lote con horas recientes.
 * Uso: npm run lote-ejemplo, y después envíalo con curl -d @practica/lote-ejemplo.json
 */
import { writeFileSync } from 'node:fs';

const ahora = Date.now();
const hace = (seg) => new Date(ahora - seg * 1000).toISOString(); // ISO 8601 en UTC (termina en Z)

// Pensado para el usuario gw-norte (gateway del sitio norte).
const lote = {
  lecturas: [
    { motor: 'MTR-01', variable: 'rpm', ts: hace(60), valor: 1500 },                 // buena
    { motor: 'MTR-01', variable: 'temp_refrigerante', ts: hace(60), valor: 85.2 },   // buena
    { motor: 'MTR-01', variable: 'presion_aceite', ts: hace(60), valor: 420 },       // buena
    { motor: 'MTR-02', variable: 'rpm', ts: hace(60), valor: 1480 },                 // buena
    { motor: 'MTR-01', variable: 'rpm', ts: hace(60), valor: 1500 },                 // repetida (igual a la primera)
    { motor: 'MTR-02', variable: 'temp_refrigerante', ts: hace(50), valor: 158.4 },  // fuera de rango (máx. 150)
    { motor: 'MTR-999', variable: 'rpm', ts: hace(60), valor: 1500 },                // motor_desconocido
    { motor: 'MTR-03', variable: 'rpm', ts: hace(60), valor: 1500 },                 // motor_de_otro_sitio
    { motor: 'MTR-01', variable: 'humedad', ts: hace(60), valor: 40 },               // variable_desconocida
    { motor: 'MTR-01', variable: 'rpm', ts: new Date(ahora + 10 * 60_000).toISOString(), valor: 1500 },     // hora_en_el_futuro
    { motor: 'MTR-01', variable: 'rpm', ts: new Date(ahora - 40 * 86_400_000).toISOString(), valor: 1500 }, // hora_demasiado_antigua
  ],
};

writeFileSync('practica/lote-ejemplo.json', `${JSON.stringify(lote, null, 2)}\n`);
console.log(`practica/lote-ejemplo.json: ${lote.lecturas.length} lecturas con horas de ${new Date(ahora).toISOString()}`);
