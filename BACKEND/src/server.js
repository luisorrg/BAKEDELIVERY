import { cargarEnv, crearConfig } from './config.js';
import { crearBdMysql } from './lib/db.js';
import { crearCorreo } from './lib/correo.js';
import { crearApp } from './app.js';

let config;
try { config = crearConfig({ ...cargarEnv(), ...process.env }); }
catch (e) { console.error('\n✖ ' + e.message + '\n'); process.exit(1); }

const db = await crearBdMysql(config.db);
const servidor = crearApp({ config, db, correo: crearCorreo(config) });
servidor.listen(config.puerto, config.produccion ? undefined : '127.0.0.1', () => console.log(`BakeDelivery en ${config.baseUrl}  (tienda: /   panel: /admin)`));
const cerrar = () => servidor.close(async () => { await db.cerrar(); process.exit(0); });
process.on('SIGINT', cerrar); process.on('SIGTERM', cerrar);
