// Genera JWT_SECRET, BOT_SECRET y contraseñas de BD en .env (sin mostrarlos). No pisa los que ya existen.
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, copyFileSync, chmodSync } from 'node:fs';
import { RAIZ } from '../src/config.js';
import path from 'node:path';

const env = path.join(RAIZ, '.env');
if (!existsSync(env)) copyFileSync(path.join(RAIZ, '.env.example'), env);
let t = readFileSync(env, 'utf8');
const hecho = [];
for (const k of ['JWT_SECRET', 'BOT_SECRET', 'DB_PASSWORD', 'DB_ROOT_PASSWORD']) {
  const re = new RegExp(`^${k}=(.*)$`, 'm');
  const m = t.match(re);
  if (m && m[1].trim()) continue;
  const v = randomBytes(k.startsWith('DB') ? 18 : 48).toString('base64url');
  t = m ? t.replace(re, `${k}=${v}`) : t + `\n${k}=${v}`;
  hecho.push(k);
}
writeFileSync(env, t); try { chmodSync(env, 0o600); } catch {}
console.log(hecho.length ? `✔ Generados en .env: ${hecho.join(', ')}` : '✔ .env ya tenía todos los secretos');
console.log('  Recuerda: .env está en .gitignore. Nunca lo subas ni lo compartas.');
