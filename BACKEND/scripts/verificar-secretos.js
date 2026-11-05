// Busca secretos escritos en el código (contraseñas, llaves, tokens). Falla (exit 1) si encuentra algo.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { RAIZ } from '../src/config.js';

const raiz = path.resolve(RAIZ, '..');
const IGNORAR = new Set(['node_modules', '.git', 'bandeja']);
const PATRONES = [
  [/(password|passwd|pwd|secret|api[_-]?key|token)\s*[:=]\s*['"](?=[^'"\s]*\d)[^'"\s${}]{8,}['"]/i, 'posible credencial literal'],
  [/AKIA[0-9A-Z]{16}/, 'llave AWS'], [/-----BEGIN (RSA |EC )?PRIVATE KEY-----/, 'llave privada'],
  [/mysql:\/\/[^:\s]+:[^@\s]+@/, 'URL de base con contraseña'], [/\b[a-z0-9]{16}\b(?=.*gmail)/i, 'posible contraseña de aplicación de Gmail'],
];
const EXT = /\.(js|html|css|json|md|yml|yaml|sql|txt|env)$/;
let hallazgos = 0;
(function recorrer(d) {
  for (const n of readdirSync(d)) {
    if (IGNORAR.has(n)) continue;
    const p = path.join(d, n), s = statSync(p);
    if (s.isDirectory()) { recorrer(p); continue; }
    if (n === '.env') { console.log(`⚠ ${path.relative(raiz, p)} existe: asegúrate de que está en .gitignore (no se escanea)`); continue; }
    if (!EXT.test(n) && n !== '.env.example') continue;
    if (p.includes(path.join('tests', ''))) continue;
    readFileSync(p, 'utf8').split('\n').forEach((l, i) => { for (const [re, msg] of PATRONES) if (re.test(l) && !/example|ejemplo|placeholder|process\.env/i.test(l)) { hallazgos++; console.log(`✖ ${path.relative(raiz, p)}:${i + 1} ${msg}`); } });
  }
})(raiz);
console.log(hallazgos ? `\n${hallazgos} hallazgo(s). Muévelos a .env.` : '✔ Sin secretos en el código.');
process.exit(hallazgos ? 1 : 0);
