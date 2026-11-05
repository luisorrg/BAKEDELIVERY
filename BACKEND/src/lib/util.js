// Errores HTTP, validación de entradas y utilidades de fecha/dinero.
export class ErrorHttp extends Error {
  constructor(status, mensaje, extra = {}) { super(mensaje); this.status = status; this.extra = extra; }
}
export const solicitudInvalida = (m, x) => new ErrorHttp(400, m, x);
export const noAutenticado = (m = 'Inicia sesión para continuar') => new ErrorHttp(401, m);
export const prohibido = (m = 'No tienes permiso para esta acción') => new ErrorHttp(403, m);
export const noEncontrado = (m = 'No encontrado') => new ErrorHttp(404, m);
export const conflicto = (m, x) => new ErrorHttp(409, m, x);
export const noProcesable = (m, x) => new ErrorHttp(422, m, x);

const pad = (n, l = 2) => String(n).padStart(l, '0');
/** Date -> 'YYYY-MM-DD HH:MM:SS.mmm' (UTC), formato que aceptan MySQL y SQLite. */
export const aFechaBd = (d = new Date()) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.${pad(d.getUTCMilliseconds(), 3)}`;
export const deFechaBd = (s) => (s ? new Date(String(s).replace(' ', 'T') + (String(s).includes('Z') ? '' : 'Z')) : null);
export const sumarMin = (d, m) => new Date(d.getTime() + m * 60000);
export const sumarHoras = (d, h) => sumarMin(d, h * 60);
export const soloFecha = (d = new Date()) => aFechaBd(d).slice(0, 10);
export const redondear = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
export const marcadores = (n) => Array(n).fill('?').join(',');
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Paginación segura: ?pagina=1&limite=20 */
export function paginar(q, max = 100) {
  const limite = Math.min(Math.max(parseInt(q.limite) || 20, 1), max);
  const pagina = Math.max(parseInt(q.pagina) || 1, 1);
  return { limite, desplazamiento: (pagina - 1) * limite, pagina };
}

const RE_CORREO = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;
const ok = (v) => ({ v }), mal = (e) => ({ e });
const tipos = {
  texto: (v, r) => { v = String(v).trim().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ''); return v.length < (r.min ?? 1) ? mal('es demasiado corto') : v.length > (r.max ?? 255) ? mal('es demasiado largo') : ok(v); },
  email: (v) => { v = String(v).trim().toLowerCase(); return RE_CORREO.test(v) && v.length <= 150 ? ok(v) : mal('no es un correo válido'); },
  telefono: (v) => { v = String(v).trim(); return /^[0-9+()\-\s]{7,20}$/.test(v) ? ok(v) : mal('no es un teléfono válido'); },
  password: (v) => { v = String(v); return v.length < 10 ? mal('debe tener al menos 10 caracteres') : v.length > 100 ? mal('es demasiado larga') : !/[a-z]/i.test(v) || !/\d/.test(v) ? mal('debe combinar letras y números') : ok(v); },
  entero: (v, r) => { const n = Number(v); return !Number.isInteger(n) ? mal('debe ser un número entero') : n < (r.min ?? -1e9) || n > (r.max ?? 1e9) ? mal('está fuera de rango') : ok(n); },
  numero: (v, r) => { const n = Number(v); return !Number.isFinite(n) ? mal('debe ser un número') : n < (r.min ?? -1e12) || n > (r.max ?? 1e12) ? mal('está fuera de rango') : ok(n); },
  bool: (v) => (v === true || v === 1 || v === '1' || v === 'true' ? ok(1) : v === false || v === 0 || v === '0' || v === 'false' ? ok(0) : mal('debe ser verdadero o falso')),
  fecha: (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v)) && !Number.isNaN(Date.parse(v)) ? ok(String(v)) : mal('debe tener formato AAAA-MM-DD')),
  fechahora: (v) => (!Number.isNaN(Date.parse(v)) ? ok(new Date(v).toISOString()) : mal('no es una fecha válida')),
  enum: (v, r) => (r.valores.includes(v) ? ok(v) : mal(`debe ser uno de: ${r.valores.join(', ')}`)),
};
/** validar(body, {campo: {t:'texto', req:true, max:80}}) -> objeto limpio o lanza 422 con `errores`. */
export function validar(body, esquema) {
  const out = {}, errores = {};
  body = body && typeof body === 'object' ? body : {};
  for (const [campo, r] of Object.entries(esquema)) {
    const v = body[campo];
    if (v === undefined || v === null || v === '') {
      if (r.req) errores[campo] = 'es obligatorio'; else if ('def' in r) out[campo] = r.def;
      continue;
    }
    if (typeof v === 'object') { errores[campo] = 'tiene un formato no válido'; continue; }
    const res = tipos[r.t](v, r);
    if (res.e) errores[campo] = res.e; else out[campo] = res.v;
  }
  if (Object.keys(errores).length) throw noProcesable('Datos inválidos', { errores });
  return out;
}
