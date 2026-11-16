/**
 * rutas/operacion.js · salud, disponibilidad y métricas para operar la API (Fase 14).
 * Las consultan Docker (healthcheck), systemd/desplegar.sh, un balanceador y el admin.
 * CONCEPTO: salud (liveness) = "el proceso está vivo"; disponibilidad (readiness) = "puedo atender:
 * mis dependencias responden". Un orquestador reinicia lo que no está vivo y deja de mandarle
 * tráfico a lo que no está listo, sin reiniciarlo (reiniciar no arregla una base caída).
 */
import { Router } from 'express';
import { pool } from '../db.js';
import { autenticar, autorizar } from '../auth.js';
import { log } from '../../comun/log.js';

/**
 * Crea el router de operación. Se monta en /api.
 * @param {object} opciones
 * @param {() => boolean|null} opciones.mqttConectado true/false; null si este proceso no usa MQTT (pruebas)
 * @param {() => object} opciones.metricas números del proceso (contadores de ingesta, loteador, WebSocket...)
 * @returns {import('express').Router}
 */
export function rutasOperacion({ mqttConectado, metricas }) {
  const router = Router();

  // Salud: responde si el proceso atiende HTTP. No toca la base: si MySQL cae, la API sigue viva
  // y reiniciarla no sirve de nada. Lo usa el healthcheck de Docker.
  router.get('/salud', (req, res) => {
    res.json({ estado: 'ok', encendidoSeg: Math.round(process.uptime()) });
  });

  // Disponibilidad: la base y el broker responden. 503 si no: "ahora no puedo atender".
  router.get('/listo', async (req, res) => {
    const db = await pool.query('SELECT 1').then(
      () => 'ok',
      (err) => {
        log.aviso('listo_db_fallida', { error: err });
        return 'error';
      },
    );
    const conectado = mqttConectado();
    const mqtt = conectado === null ? 'no_aplica' : conectado ? 'ok' : 'error';
    const listo = db === 'ok' && mqtt !== 'error';
    res.status(listo ? 200 : 503).json({ estado: listo ? 'listo' : 'no_listo', db, mqtt });
  });

  // Métricas (solo admin): lo necesario para saber cómo está el sistema sin leer logs.
  router.get('/metricas', autenticar, autorizar('admin'), (req, res) => {
    const memoria = process.memoryUsage();
    res.json({
      ...metricas(),
      encendidoSeg: Math.round(process.uptime()),
      memoriaMB: Math.round(memoria.rss / 1048576), // RSS: memoria real que ocupa el proceso, en MB
    });
  });

  return router;
}
