// Mini-framework HTTP sin dependencias: router, cuerpo JSON, cookies, cabeceras de seguridad,
// CSRF (doble cookie + Origin), límite de peticiones, compresión y archivos estáticos.
import http from 'node:http';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import { ErrorHttp } from './util.js';
import { iguales } from './auth.js';

export const COOKIE_SESION = 'bd_sesion', COOKIE_CSRF = 'bd_csrf';
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json' };
const COMPRIMIBLES = /^(text\/|application\/(json|xml|manifest)|image\/svg)/;

export function crearRouter(prefijo = '', previos = []) {
  const rutas = [];
  const add = (metodo) => (p, ...h) => {
    const llaves = [];
    const re = new RegExp('^' + (prefijo + p).replace(/:([a-zA-Z]+)/g, (_, k) => { llaves.push(k); return '([^/]+)'; }) + '/?$');
    rutas.push({ metodo, re, llaves, h: [...previos, ...h] });
  };
  return { get: add('GET'), post: add('POST'), put: add('PUT'), delete: add('DELETE'), rutas };
}

export function cabecerasSeguridad(config) {
  const ga = config.gaId ? { s: ' https://www.googletagmanager.com', c: ' https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com' } : { s: '', c: '' };
  const csp = `default-src 'self'; script-src 'self'${ga.s}; style-src 'self'; img-src 'self' data:${ga.c ? ' https://www.google-analytics.com' : ''}; font-src 'self'; connect-src 'self'${ga.c}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'${config.produccion ? '; upgrade-insecure-requests' : ''}`;
  return (req, res) => {
    res.setHeader('Content-Security-Policy', csp);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(self)');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('X-Powered-By', '');
    res.removeHeader('X-Powered-By');
    if (config.produccion) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  };
}

/** En producción detrás de proxy: redirige http -> https. */
export const forzarHttps = (config) => (req, res) => {
  if (!config.produccion) return;
  const https = req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https';
  if (!https) { res.writeHead(308, { Location: config.baseUrl + req.url }); res.end(); }
};

export function limitador({ max, ventanaMs, clave = (req) => req.ip }) {
  const m = new Map();
  return (req, res) => {
    const k = clave(req), ahora = Date.now();
    let e = m.get(k);
    if (!e || e.hasta < ahora) { e = { n: 0, hasta: ahora + ventanaMs }; m.set(k, e); }
    if (++e.n > max) { res.setHeader('Retry-After', Math.ceil((e.hasta - ahora) / 1000)); throw new ErrorHttp(429, 'Demasiadas solicitudes. Intenta de nuevo en un momento.'); }
    if (m.size > 5000) for (const [kk, v] of m) if (v.hasta < ahora) m.delete(kk);
  };
}

export const parseCookies = (h = '') => Object.fromEntries(h.split(';').map((c) => c.trim().split(/=(.*)/s).slice(0, 2)).filter(([k]) => k).map(([k, v]) => [k, decodeURIComponent(v || '')]));

export function ponerCookie(res, nombre, valor, { httpOnly = true, maxAgeS, produccion } = {}) {
  const c = `${nombre}=${encodeURIComponent(valor)}; Path=/; SameSite=Lax${httpOnly ? '; HttpOnly' : ''}${produccion ? '; Secure' : ''}${maxAgeS !== undefined ? `; Max-Age=${maxAgeS}` : ''}`;
  const previo = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', previo ? [].concat(previo, c) : c);
}

export const nuevoTokenCsrf = () => randomBytes(24).toString('base64url');

/** Doble cookie: el JS de la página lee bd_csrf y lo manda en X-CSRF-Token; además se valida Origin. */
export const proteccionCsrf = (config) => (req, res) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return;
  const origen = req.headers.origin;
  if (origen && origen !== config.origen) throw new ErrorHttp(403, 'Origen no permitido');
  const c = req.cookies[COOKIE_CSRF], h = req.headers['x-csrf-token'];
  if (!c || !h || !iguales(c, h)) throw new ErrorHttp(403, 'Token de seguridad inválido. Recarga la página.');
};

export function crearServidor({ config, middlewares = [], routers = [], estaticos, noEncontrado404 }) {
  const rutas = routers.flatMap((r) => r.rutas);
  const hashIp = (ip) => createHash('sha256').update(ip + config.jwtSecret).digest('hex').slice(0, 16);

  function extender(req, res) {
    req.ip = (config.confiarProxy && req.headers['x-forwarded-for']?.split(',')[0].trim()) || req.socket.remoteAddress || '0.0.0.0';
    req.ipHash = hashIp(req.ip);
    req.cookies = parseCookies(req.headers.cookie);
    const u = new URL(req.url, 'http://x');
    req.path = decodeURIComponent(u.pathname);
    req.query = Object.fromEntries(u.searchParams);
    res.enviar = (cuerpo, tipo, status = 200, cabeceras = {}) => {
      const buf = Buffer.isBuffer(cuerpo) ? cuerpo : Buffer.from(String(cuerpo));
      let salida = buf; const h = { 'Content-Type': tipo, ...cabeceras };
      const ae = req.headers['accept-encoding'] || '';
      if (buf.length > 1024 && COMPRIMIBLES.test(tipo)) {
        if (/\bbr\b/.test(ae)) { salida = brotliCompressSync(buf); h['Content-Encoding'] = 'br'; }
        else if (/\bgzip\b/.test(ae)) { salida = gzipSync(buf); h['Content-Encoding'] = 'gzip'; }
        h.Vary = 'Accept-Encoding';
      }
      h['Content-Length'] = salida.length;
      res.writeHead(status, h); res.end(req.method === 'HEAD' ? undefined : salida);
    };
    res.json = (obj, status = 200) => res.enviar(JSON.stringify(obj), 'application/json; charset=utf-8', status, { 'Cache-Control': 'no-store' });
  }

  async function leerCuerpo(req) {
    if (!['POST', 'PUT', 'DELETE'].includes(req.method)) return;
    const partes = []; let n = 0;
    for await (const p of req) { n += p.length; if (n > 100_000) throw new ErrorHttp(413, 'Solicitud demasiado grande'); partes.push(p); }
    if (!n) { req.body = {}; return; }
    if (!/application\/json/.test(req.headers['content-type'] || '')) throw new ErrorHttp(415, 'Se espera application/json');
    try { req.body = JSON.parse(Buffer.concat(partes)); } catch { throw new ErrorHttp(400, 'JSON inválido'); }
  }

  const manejador = async (req, res) => {
    try {
      extender(req, res);
      for (const mw of middlewares) { await mw(req, res); if (res.writableEnded) return; }
      if (req.path.startsWith('/api/')) {
        await leerCuerpo(req);
        const ruta = rutas.find((r) => r.metodo === req.method && r.re.test(req.path));
        if (!ruta) {
          if (rutas.some((r) => r.re.test(req.path))) throw new ErrorHttp(405, 'Método no permitido');
          throw new ErrorHttp(404, 'Ruta no encontrada');
        }
        const m = ruta.re.exec(req.path);
        req.params = Object.fromEntries(ruta.llaves.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
        for (const h of ruta.h) { await h(req, res); if (res.writableEnded) return; }
        if (!res.writableEnded) res.json({ ok: true });
        return;
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') throw new ErrorHttp(405, 'Método no permitido');
      if (!(await estaticos(req, res))) await noEncontrado404(req, res);
    } catch (e) {
      if (res.writableEnded) return;
      const status = e instanceof ErrorHttp ? e.status : 500;
      if (status === 500) console.error('[error]', req.method, req.path, e.stack || e);
      if (!req.path.startsWith('/api/') && status === 500) return res.enviar('Error interno', 'text/plain; charset=utf-8', 500);
      res.json({ error: status === 500 ? 'Error interno del servidor' : e.message, ...(status === 500 ? {} : e.extra) }, status);
    }
  };
  return http.createServer(manejador);
}

/** Sirve archivos de varias carpetas: [{prefijo:'/admin', dir}, {prefijo:'', dir}] sin salir de ellas. */
export function servirEstaticos(montajes, { baseUrl = '' } = {}) {
  return async (req, res) => {
    for (const { prefijo, dir } of montajes) {
      if (prefijo && !(req.path === prefijo || req.path.startsWith(prefijo + '/'))) continue;
      let rel = req.path.slice(prefijo.length) || '/';
      if (rel.endsWith('/')) rel += 'index.html';
      let archivo = path.join(dir, path.normalize(rel));
      if (!archivo.startsWith(dir + path.sep)) continue;
      if (!path.extname(archivo)) archivo += '.html';
      try {
        const s = await stat(archivo); if (!s.isFile()) continue;
        const ext = path.extname(archivo).toLowerCase();
        const largo = ['.png', '.jpg', '.webp', '.svg', '.ico', '.woff2'].includes(ext);
        let datos = await readFile(archivo);
        if (ext === '.html') datos = Buffer.from(datos.toString('utf8').replaceAll('%%BASE%%', baseUrl)); // canonical y og:image absolutos
        res.enviar(datos, TIPOS[ext] || 'application/octet-stream', 200, { 'Cache-Control': largo ? 'public, max-age=604800' : 'no-cache' });
        return true;
      } catch { /* siguiente montaje */ }
    }
    return false;
  };
}
