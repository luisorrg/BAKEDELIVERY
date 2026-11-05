import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { crearServidor, cabecerasSeguridad, forzarHttps, limitador, proteccionCsrf, servirEstaticos } from './lib/web.js';
import { crearVerificadorBot, crearLimiteIntentos } from './lib/auth.js';
import { sesion } from './servicios/sesion.js';
import { crearBitacora } from './servicios/bitacora.js';
import { rutasAcceso } from './rutas/acceso.js';
import { rutasPublico } from './rutas/publico.js';
import { rutasCliente } from './rutas/cliente.js';
import { rutasAdmin } from './rutas/admin.js';

const PAGINAS_PUBLICAS = ['/', '/catalogo', '/ofertas', '/contacto', '/privacidad', '/terminos', '/cookies', '/seguimiento', '/login', '/registro'];

export function crearApp({ config, db, correo }) {
  const bot = crearVerificadorBot(config.botSecret);
  const limiteTarjeta = crearLimiteIntentos({ max: config.reglas.maxIntentosTarjeta, ventanaMin: 10 });
  const bitacora = crearBitacora(db);
  const dep = { db, config, correo, bot, bitacora, limiteTarjeta };

  const F = config.carpetaFrontend;
  const estaticos = servirEstaticos([
    { prefijo: '/admin', dir: path.join(F, 'admin') },
    { prefijo: '/compartido', dir: path.join(F, 'compartido') },
    { prefijo: '', dir: path.join(F, 'tienda') },
  ], { baseUrl: config.baseUrl });
  const extra = async (req, res) => { // robots.txt y sitemap.xml dinámicos
    if (req.path === '/robots.txt') {
      res.enviar(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nDisallow: /cuenta\nDisallow: /carrito\nDisallow: /checkout\nSitemap: ${config.baseUrl}/sitemap.xml\n`, 'text/plain; charset=utf-8'); return true;
    }
    if (req.path === '/sitemap.xml') {
      const prods = await db.query('SELECT id FROM PRODUCTOS WHERE activo = 1');
      const urls = [...PAGINAS_PUBLICAS.filter((p) => !['/login', '/registro'].includes(p)), ...prods.map((p) => `/producto?id=${p.id}`)];
      res.enviar(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${config.baseUrl}${u.replace(/&/g, '&amp;')}</loc></url>`).join('\n')}\n</urlset>\n`, 'application/xml'); return true;
    }
    return false;
  };
  const servir = async (req, res) => (await extra(req, res)) || estaticos(req, res);
  const pagina404 = async (req, res) => {
    try { res.enviar((await readFile(path.join(F, 'tienda', '404.html'), 'utf8')).replaceAll('%%BASE%%', config.baseUrl), 'text/html; charset=utf-8', 404); }
    catch { res.enviar('No encontrado', 'text/plain; charset=utf-8', 404); }
  };
  return crearServidor({
    config,
    middlewares: [forzarHttps(config), cabecerasSeguridad(config), (req, res) => { if (req.path.startsWith('/api/')) return limitador({ max: 300, ventanaMs: 60000 })(req, res); }, sesion(config), (req, res) => { if (req.path.startsWith('/api/')) return proteccionCsrf(config)(req, res); }],
    routers: [rutasAcceso(dep), rutasPublico(dep), rutasCliente(dep), ...rutasAdmin(dep)],
    estaticos: servir, noEncontrado404: pagina404,
  });
}
