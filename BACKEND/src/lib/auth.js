// Contraseñas (scrypt), JWT HS256, tokens aleatorios y anti-bot. Solo node:crypto.
import { scrypt, randomBytes, timingSafeEqual, createHmac, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const scryptP = promisify(scrypt);

export const sha256 = (s) => createHash('sha256').update(s).digest('hex');
export const tokenAleatorio = (n = 32) => randomBytes(n).toString('base64url');
export const iguales = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };

export async function hashPassword(pw) {
  const sal = randomBytes(16);
  const h = await scryptP(pw, sal, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$${sal.toString('base64')}$${h.toString('base64')}`;
}
const HASH_FALSO = 'scrypt$16384$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64');
export async function verificarPassword(pw, guardado) {
  const [alg, N, sal, h] = String(guardado || HASH_FALSO).split('$');
  if (alg !== 'scrypt') return false;
  const calc = await scryptP(String(pw), Buffer.from(sal, 'base64'), 64, { N: Number(N), r: 8, p: 1 });
  const esperado = Buffer.from(h, 'base64');
  return calc.length === esperado.length && timingSafeEqual(calc, esperado) && guardado != null;
}
/** Gasta el mismo tiempo cuando el correo no existe (evita enumerar usuarios). */
export const gastarTiempo = (pw) => verificarPassword(pw, null);

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
export function firmarJwt(payload, secreto, minutos) {
  const ahora = Math.floor(Date.now() / 1000);
  const cuerpo = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ ...payload, iat: ahora, exp: ahora + minutos * 60 })}`;
  return `${cuerpo}.${createHmac('sha256', secreto).update(cuerpo).digest('base64url')}`;
}
export function verificarJwt(token, secreto) {
  const p = String(token || '').split('.');
  if (p.length !== 3) return null;
  const firma = createHmac('sha256', secreto).update(`${p[0]}.${p[1]}`).digest('base64url');
  if (!iguales(firma, p[2])) return null;
  try {
    const h = JSON.parse(Buffer.from(p[0], 'base64url')); if (h.alg !== 'HS256') return null;
    const d = JSON.parse(Buffer.from(p[1], 'base64url'));
    return d.exp > Math.floor(Date.now() / 1000) ? d : null;
  } catch { return null; }
}

/** Anti-bot: suma firmada con HMAC + tiempo mínimo + un solo uso + campo trampa (honeypot). */
export function crearVerificadorBot(secreto, { minMs = 1500, maxMs = 15 * 60000, ahora = Date.now } = {}) {
  const usados = new Map();
  const firmar = (c) => createHmac('sha256', secreto).update(c).digest('base64url');
  return {
    crearDesafio() {
      const a = 1 + Math.floor(Math.random() * 9), b = 1 + Math.floor(Math.random() * 9);
      const c = b64({ r: a + b, t: ahora(), n: tokenAleatorio(6) });
      return { pregunta: `¿Cuánto es ${a} + ${b}?`, token: `${c}.${firmar(c)}` };
    },
    verificar(token, respuesta) {
      const [c, f] = String(token || '').split('.');
      if (!c || !f || !iguales(firmar(c), f)) return false;
      let d; try { d = JSON.parse(Buffer.from(c, 'base64url')); } catch { return false; }
      const edad = ahora() - d.t;
      if (edad < minMs || edad > maxMs || usados.has(c) || Number(respuesta) !== d.r) return false;
      usados.set(c, ahora());
      for (const [k, t] of usados) if (ahora() - t > maxMs) usados.delete(k);
      return true;
    },
  };
}

/** Contador de intentos fallidos en memoria (p. ej. prueba de tarjetas al azar). */
export function crearLimiteIntentos({ max, ventanaMin }) {
  const m = new Map();
  const vivo = (k) => { const e = m.get(k); if (e && e.hasta < Date.now()) { m.delete(k); return null; } return e; };
  return {
    fallo(k) { const e = vivo(k) || { n: 0, hasta: Date.now() + ventanaMin * 60000 }; e.n++; m.set(k, e); },
    bloqueado(k) { const e = vivo(k); return e && e.n >= max ? Math.ceil((e.hasta - Date.now()) / 1000) : 0; },
    reiniciar(k) { m.delete(k); },
  };
}
