// Crea las tablas de BD02 en MySQL usando el usuario root (DB_ROOT_PASSWORD) y el usuario de la app.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { cargarEnv, RAIZ } from '../src/config.js';

const env = { ...cargarEnv(), ...process.env };
if (!env.DB_ROOT_PASSWORD || !env.DB_PASSWORD) { console.error('Faltan DB_ROOT_PASSWORD / DB_PASSWORD. Ejecuta: npm run secretos'); process.exit(1); }
const mysql = await import('mysql2/promise');
const c = await mysql.createConnection({ host: env.DB_HOST || '127.0.0.1', port: Number(env.DB_PORT || 3306), user: 'root', password: env.DB_ROOT_PASSWORD, multipleStatements: true });
const sql = readFileSync(path.join(RAIZ, '..', 'DATABASE', 'bd02_reposteria.sql'), 'utf8');
await c.query(sql);
const usuario = env.DB_USER || 'bake', bd = env.DB_NAME || 'bd02';
await c.query(`CREATE USER IF NOT EXISTS ?@'%' IDENTIFIED BY ?`, [usuario, env.DB_PASSWORD]);
await c.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON \`${bd}\`.* TO ?@'%'`, [usuario]); // mínimo privilegio: sin DROP/ALTER
console.log(`✔ Base ${bd} creada. Usuario de la app "${usuario}" con permisos mínimos.`);
await c.end();
