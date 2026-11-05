import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const aqui = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ = path.resolve(aqui, '..');

/** Lee un .env sencillo (CLAVE=valor). No pisa variables ya definidas. */
export function cargarEnv(ruta = path.join(RAIZ, '.env')) {
  if (!existsSync(ruta)) return {};
  const out = {};
  for (const l of readFileSync(ruta, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

const num = (v, d) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? d : Number(v));

/** Construye la configuración; se niega a arrancar con secretos inseguros. */
export function crearConfig(env = process.env) {
  const prod = env.NODE_ENV === 'production';
  const jwtSecret = env.JWT_SECRET || '';
  const botSecret = env.BOT_SECRET || '';
  const errores = [];
  if (jwtSecret.length < 32) errores.push('JWT_SECRET debe tener al menos 32 caracteres (ejecuta: npm run secretos)');
  if (botSecret.length < 32) errores.push('BOT_SECRET debe tener al menos 32 caracteres (ejecuta: npm run secretos)');
  if (jwtSecret && jwtSecret === botSecret) errores.push('JWT_SECRET y BOT_SECRET deben ser distintos');
  if (/cambia|changeme|secret|example/i.test(jwtSecret + botSecret)) errores.push('Los secretos parecen de ejemplo');
  const baseUrl = env.BASE_URL || `http://localhost:${num(env.PORT, 3000)}`;
  if (prod) {
    if (!env.DB_PASSWORD) errores.push('DB_PASSWORD es obligatorio en producción');
    if (!baseUrl.startsWith('https://')) errores.push('BASE_URL debe ser https:// en producción');
  }
  if (errores.length) {
    const e = new Error('Configuración insegura:\n - ' + errores.join('\n - '));
    e.codigo = 'CONFIG';
    throw e;
  }
  return {
    produccion: prod,
    puerto: num(env.PORT, 3000),
    baseUrl,
    origen: new URL(baseUrl).origin,
    confiarProxy: env.TRUST_PROXY === '1',
    db: { host: env.DB_HOST || '127.0.0.1', port: num(env.DB_PORT, 3306), database: env.DB_NAME || 'bd02', user: env.DB_USER || 'bake', password: env.DB_PASSWORD || '' },
    jwtSecret, botSecret,
    jwtExpiraMin: num(env.JWT_EXPIRA_MIN, 120),
    smtp: env.SMTP_HOST ? { host: env.SMTP_HOST, port: num(env.SMTP_PORT, 587), user: env.SMTP_USER, pass: env.SMTP_PASS } : null,
    remitente: env.CORREO_REMITENTE || 'BakeDelivery <no-responder@bakedelivery.local>',
    gaId: /^G-[A-Z0-9]{4,}$/.test(env.GA_MEASUREMENT_ID || '') ? env.GA_MEASUREMENT_ID : '',
    tienda: {
      nombre: env.TIENDA_NOMBRE || 'BakeDelivery', telefono: env.TIENDA_TELEFONO || '', correo: env.TIENDA_CORREO || '',
      direccion: env.TIENDA_DIRECCION || 'Los Mochis, Sinaloa',
    },
    reglas: {
      horasAnticipacion: num(env.HORAS_ANTICIPACION, 24), costoEnvio: num(env.COSTO_ENVIO, 50),
      envioGratisDesde: num(env.ENVIO_GRATIS_DESDE, 600), diasDevolucion: num(env.DIAS_PLAZO_DEVOLUCION, 3),
      diasGarantia: num(env.DIAS_GARANTIA, 7), maxIntentosLogin: num(env.MAX_INTENTOS_LOGIN, 5),
      bloqueoMin: num(env.BLOQUEO_MIN, 15), maxIntentosTarjeta: num(env.MAX_INTENTOS_TARJETA, 10), limiteAuth: num(env.LIMITE_AUTH, 20),
    },
    carpetaFrontend: path.resolve(RAIZ, '..', 'FRONTEND'),
    carpetaBandeja: path.join(RAIZ, 'storage', 'bandeja'),
  };
}
