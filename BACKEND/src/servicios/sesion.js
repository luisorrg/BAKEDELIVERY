import { verificarJwt } from '../lib/auth.js';
import { COOKIE_SESION } from '../lib/web.js';
import { noAutenticado, prohibido } from '../lib/util.js';

/** Lee la cookie de sesión (JWT httpOnly) y carga al usuario; no falla si no hay sesión. */
export const sesion = (config) => (req) => {
  const d = verificarJwt(req.cookies[COOKIE_SESION], config.jwtSecret);
  req.usuario = d ? { id: d.sub, rol: d.rol, nombre: d.nombre, correo: d.correo } : null;
};
export const requerirLogin = (req) => { if (!req.usuario) throw noAutenticado(); };
export const requerirRol = (...roles) => (req) => {
  if (!req.usuario) throw noAutenticado();
  if (!roles.includes(req.usuario.rol)) throw prohibido();
};
/** Para rutas de comprador: carga CLIENTES.id en req.cliente. */
export const cargarCliente = (db) => async (req) => {
  if (!req.usuario) throw noAutenticado();
  const c = await db.one('SELECT id, id_usuario FROM CLIENTES WHERE id_usuario = ?', [req.usuario.id]);
  if (!c) throw prohibido('Esta cuenta no tiene perfil de comprador');
  req.cliente = c;
};
