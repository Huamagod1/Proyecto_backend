/**
 * zod.js · zod configurado con mensajes en español (Fase 3).
 * Todos los módulos importan `z` desde aquí y no desde 'zod': así la configuración se aplica
 * siempre, sin importar qué módulo se cargue primero.
 */
import { z } from 'zod';

// z.config es global: cambia los mensajes por defecto ("se esperaba número, recibido texto").
z.config(z.locales.es());

export { z };
