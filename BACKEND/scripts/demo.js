// Modo demo SIN MySQL: base SQLite en memoria con datos de ejemplo y secretos temporales. Solo para probar.
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { RAIZ, crearConfig } from '../src/config.js';
import { crearBdSqlite } from '../src/lib/db.js';
import { crearCorreo } from '../src/lib/correo.js';
import { crearApp } from '../src/app.js';
import { sembrar } from '../src/servicios/seed.js';

const puerto = Number(process.env.PORT || 3000);
const config = crearConfig({ NODE_ENV: 'development', PORT: String(puerto), JWT_SECRET: randomBytes(32).toString('hex'), BOT_SECRET: randomBytes(32).toString('hex') });
const db = await crearBdSqlite(path.join(RAIZ, '..', 'DATABASE', 'bd02_reposteria.sql'));
const claves = await sembrar(db);
crearApp({ config, db, correo: crearCorreo(config) }).listen(puerto, '127.0.0.1', () => {
  console.log(`\nDEMO (SQLite en memoria; se borra al cerrar)  →  ${config.baseUrl}\nPanel del vendedor: ${config.baseUrl}/admin\n`);
  console.log(`  admin@bakedelivery.local      ${claves.admin}\n  repostero@bakedelivery.local  ${claves.repostero}\n  cliente@bakedelivery.local    ${claves.cliente}\n`);
});
