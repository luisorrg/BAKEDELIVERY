import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { RAIZ, crearConfig } from '../src/config.js';
import { crearBdSqlite } from '../src/lib/db.js';
import { crearCorreo } from '../src/lib/correo.js';
import { crearApp } from '../src/app.js';
import { sembrar } from '../src/servicios/seed.js';

export async function arrancar(extra = {}) {
  const config = { ...crearConfig({ NODE_ENV: 'development', JWT_SECRET: randomBytes(32).toString('hex'), BOT_SECRET: randomBytes(32).toString('hex'), LIMITE_AUTH: '1000', ...extra.env }), carpetaBandeja: mkdtempSync(path.join(tmpdir(), 'bd-')) };
  const db = await crearBdSqlite(path.join(RAIZ, '..', 'DATABASE', 'bd02_reposteria.sql'));
  const claves = await sembrar(db);
  const servidor = crearApp({ config, db, correo: crearCorreo(config) });
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  return { base, db, config, claves, cerrar: () => new Promise((r) => servidor.close(r)) };
}

/** Cliente HTTP con "cookie jar" y token CSRF automático. */
export function navegador(base) {
  const jar = {};
  const guardar = (r) => { for (const c of r.headers.getSetCookie?.() ?? []) { const [kv] = c.split(';'); const i = kv.indexOf('='); const v = decodeURIComponent(kv.slice(i + 1)); if (v) jar[kv.slice(0, i)] = v; else delete jar[kv.slice(0, i)]; } };
  const api = async (metodo, ruta, cuerpo, cabeceras = {}) => {
    if (!jar.bd_csrf) guardar(await fetch(base + '/api/csrf'));
    const r = await fetch(base + ruta, { method: metodo, redirect: 'manual', headers: { 'content-type': 'application/json', 'x-csrf-token': jar.bd_csrf, cookie: Object.entries(jar).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; '), ...cabeceras }, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
    guardar(r);
    const tipo = r.headers.get('content-type') || '';
    return { status: r.status, headers: r.headers, datos: tipo.includes('json') ? await r.json() : Buffer.from(await r.arrayBuffer()) };
  };
  return { jar, get: (r) => api('GET', r), post: (r, b = {}) => api('POST', r, b), put: (r, b = {}) => api('PUT', r, b), del: (r, b) => api('DELETE', r, b ?? {}), api };
}
export const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
export const entregaEn = (horas) => new Date(Date.now() + horas * 3600e3).toISOString();
