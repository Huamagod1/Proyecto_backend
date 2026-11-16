/**
 * app.js · arma la aplicación Express: la cadena de middlewares y rutas (Fase 3).
 * crearApp() no abre ningún puerto: server.js la pone a escuchar y las pruebas la usan con
 * supertest, sin red. La Fase 4 suma helmet, auditoría, login y consulta de auditoría; las
 * siguientes, lecturas (5) y tiempo real (9).
 */
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import { pool } from './db.js';
import { ErrorHttp } from '../comun/errores.js';
import { registrarAcceso } from './auditoria.js';
import { rutasAuth } from './rutas/auth.js';
import { rutasMotores } from './rutas/motores.js';
import { rutasAuditoria } from './rutas/auditoria.js';
import { rutasLecturas } from './rutas/lecturas.js';

/**
 * Crea una instancia nueva de la aplicación.
 * @returns {import('express').Express} la app lista para listen() o para supertest
 */
export function crearApp() {
  const app = express();

  // CONCEPTO: middleware. Una función (req, res, next) por la que pasa cada petición, en el orden
  // en que se registra: como los filtros de Spring Security en FlowSense. El orden importa.

  // helmet(): encabezados de seguridad en cada respuesta. Entre otros: X-Content-Type-Options
  // (el navegador no adivina tipos), Content-Security-Policy (solo scripts propios), quita
  // X-Powered-By (no anuncia "Express") y Strict-Transport-Security (fuerza HTTPS con TLS).
  // Fase 9: sin 'upgrade-insecure-requests'. OJO: esa directiva hace que el navegador pida todo
  // por https:// y wss://; con la API en http://localhost (sin TLS) el dashboard no cargaría.
  // Con TLS en nginx (Fase 13) se puede volver a activar.
  app.use(helmet({ contentSecurityPolicy: { directives: { 'upgrade-insecure-requests': null } } }));

  // Fase 9: el dashboard (public/). Va antes de la auditoría: son archivos públicos que no tocan
  // datos, y anotar cada .css o .js llenaría la tabla. La ruta sale de este archivo y no de la
  // carpeta desde la que se lanzó node (cwd), que puede cambiar.
  app.use(express.static(fileURLToPath(new URL('../../public', import.meta.url))));

  // Auditoría antes del parser y de las rutas: así también quedan anotados un JSON roto (400) o
  // una ruta inexistente (404).
  app.use(registrarAcceso);

  // Convierte el cuerpo JSON en req.body. limit: un cuerpo de más de 1 MB responde 413.
  app.use(express.json({ limit: '1mb' }));

  // Salud: el proceso está vivo y la base responde. Lo consultan los monitores y el balanceador.
  app.get('/api/salud', async (req, res) => {
    try {
      await pool.query('SELECT 1'); // la consulta más barata posible: solo prueba la conexión
      res.json({ estado: 'ok', db: 'ok' });
    } catch (err) {
      console.error('salud: la base no responde:', err.message);
      // 503 Service Unavailable: "ahora no puedo atender", a diferencia de un 500 (error del código).
      res.status(503).json({ estado: 'error', db: 'error' });
    }
  });

  app.use('/api/auth', rutasAuth());
  app.use('/api/motores', rutasMotores());
  app.use('/api/auditoria', rutasAuditoria());
  // Lecturas (Fase 5): POST /api/lecturas y las series y el estado bajo /api/motores/:codigo/...
  // OJO: va después del router de motores; /api/motores/MTR-01/lecturas no calza con su
  // '/:codigo' (un solo segmento) y la petición sigue hasta aquí.
  app.use('/api', rutasLecturas());

  // Ninguna ruta respondió: 404 en JSON, igual que el resto de la API (Express respondería en HTML).
  app.use((req, res) => {
    res.status(404).json({ error: `No existe ${req.method} ${req.path}` });
  });

  // Middleware de errores: Express lo reconoce porque tiene CUATRO parámetros. Va al final.
  // CONCEPTO: en Express 5, un error lanzado (o una promesa rechazada) dentro de una ruta async
  // llega solo hasta aquí. En Express 4 había que envolver cada ruta con try/catch y next(err).
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    // Si la respuesta ya empezó a enviarse, no se puede cambiar: lo resuelve Express (cierra el socket).
    if (res.headersSent) return next(err);

    // Errores esperados: su estado y su mensaje.
    if (err instanceof ErrorHttp) {
      return res.status(err.estado).json({ error: err.message, detalle: err.detalle });
    }
    // express.json() marca así el JSON mal formado ({"codigo": ...) y el cuerpo demasiado grande.
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'JSON mal formado' });
    }
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'El cuerpo supera 1 MB' });
    }
    // Inesperado: todo el detalle al log, nada al cliente.
    // SEGURIDAD: un stack trace o un mensaje de SQL le dicen a un atacante cómo está hecha la API.
    console.error(`${req.method} ${req.originalUrl}:`, err);
    res.status(500).json({ error: 'Error interno' });
  });

  return app;
}
