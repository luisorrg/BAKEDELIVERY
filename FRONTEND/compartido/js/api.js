import { primeraEntrega } from './util.js';
// Cliente de la API: añade el token CSRF (doble cookie) y convierte errores en excepciones con `.datos`.
export class ErrorApi extends Error { constructor(status, datos) { super(Array.isArray(datos?.errores) && datos.errores.length ? datos.errores.join(' ') : datos?.error || 'Error de conexión'); this.status = status; this.datos = datos; } }
const leerCookie = (n) => document.cookie.split('; ').find((c) => c.startsWith(n + '='))?.split('=')[1];
async function csrf() {
  let t = leerCookie('bd_csrf');
  if (!t) { await fetch('/api/csrf', { credentials: 'same-origin' }); t = leerCookie('bd_csrf'); }
  return t;
}
async function pedir(metodo, ruta, cuerpo) {
  const cab = { Accept: 'application/json' };
  if (metodo !== 'GET') { cab['Content-Type'] = 'application/json'; cab['X-CSRF-Token'] = await csrf(); }
  let r;
  try { r = await fetch('/api' + ruta, { method: metodo, headers: cab, credentials: 'same-origin', body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) }); }
  catch { throw new ErrorApi(0, { error: 'No hay conexión con el servidor. Intenta de nuevo.' }); }
  const datos = (r.headers.get('content-type') || '').includes('json') ? await r.json() : null;
  if (!r.ok) throw new ErrorApi(r.status, datos);
  return datos;
}
export const api = { get: (r) => pedir('GET', r), post: (r, b = {}) => pedir('POST', r, b), put: (r, b = {}) => pedir('PUT', r, b), del: (r, b = {}) => pedir('DELETE', r, b) };
let yo;
export const usuarioActual = () => (yo ??= api.get('/auth/yo').then((d) => d.usuario).catch(() => null));
export const olvidarUsuario = () => { yo = undefined; };
let cfgP;
export const textoPrimeraEntrega = async () => primeraEntrega((await configTienda()).reglas?.horasAnticipacion);
export const configTienda = () => (cfgP ??= api.get('/config').catch(() => ({ tienda: {}, reglas: {}, fondo: {}, gaId: '' })));
