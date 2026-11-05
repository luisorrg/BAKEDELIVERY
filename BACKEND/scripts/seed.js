import { cargarEnv, crearConfig } from '../src/config.js';
import { crearBdMysql } from '../src/lib/db.js';
import { sembrar } from '../src/servicios/seed.js';
const env = { ...cargarEnv(), ...process.env };
const config = crearConfig(env);
const db = await crearBdMysql(config.db);
if ((await db.one('SELECT COUNT(*) AS n FROM USUARIOS')).n) { console.error('La base ya tiene usuarios; el seed no se ejecuta para no duplicar datos.'); process.exit(1); }
const c = await sembrar(db, { adminPass: env.SEED_ADMIN_PASSWORD, clientePass: env.SEED_CLIENTE_PASSWORD });
console.log('\n✔ Datos de ejemplo creados. Guarda estas contraseñas, NO se vuelven a mostrar:\n');
console.log(`  admin@bakedelivery.local      ${c.admin}\n  repostero@bakedelivery.local  ${c.repostero}\n  cliente@bakedelivery.local    ${c.cliente}\n`);
await db.cerrar();
