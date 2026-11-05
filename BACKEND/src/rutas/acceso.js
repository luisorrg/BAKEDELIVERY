// Control de acceso: registro, login, recuperación de contraseña, cuenta y derechos ARCO.
import { crearRouter, ponerCookie, nuevoTokenCsrf, limitador, COOKIE_SESION } from '../lib/web.js';
import { validar, noProcesable, noAutenticado, prohibido, conflicto, ErrorHttp, aFechaBd, deFechaBd, sumarMin } from '../lib/util.js';
import { hashPassword, verificarPassword, gastarTiempo, firmarJwt, tokenAleatorio, sha256 } from '../lib/auth.js';
import { plantillaCorreo } from '../lib/correo.js';
import { requerirLogin } from '../servicios/sesion.js';
import { esDuplicado } from '../servicios/bitacora.js';
import { esc } from '../lib/util.js';

export function rutasAcceso({ db, config, correo, bot, bitacora }) {
  const r = crearRouter('/api');
  const lim = limitador({ max: config.reglas.limiteAuth, ventanaMs: 10 * 60000 });
  const R = config.reglas;

  /** Exige haber resuelto el desafío y dejado vacío el campo trampa. */
  const exigirHumano = async (req, b) => {
    if (b.sitio_web) { await bitacora(req, 'bot_honeypot'); throw new ErrorHttp(400, 'Solicitud rechazada'); }
    if (!bot.verificar(b.bot_token, b.bot_respuesta)) { await bitacora(req, 'bot_fallo'); throw noProcesable('No pudimos verificar que eres humano. Intenta con la nueva pregunta.', { errores: { bot_respuesta: 'respuesta incorrecta o muy rápida' }, nuevo_desafio: bot.crearDesafio() }); }
  };
  const iniciarSesion = (res, u) => {
    const token = firmarJwt({ sub: u.id, rol: u.rol, nombre: u.nombre, correo: u.correo }, config.jwtSecret, config.jwtExpiraMin);
    ponerCookie(res, COOKIE_SESION, token, { maxAgeS: config.jwtExpiraMin * 60, produccion: config.produccion });
  };

  r.get('/csrf', (req, res) => {
    const t = req.cookies.bd_csrf || nuevoTokenCsrf();
    ponerCookie(res, 'bd_csrf', t, { httpOnly: false, produccion: config.produccion });
    res.json({ csrf: t });
  });
  r.get('/verificacion/desafio', (req, res) => res.json(bot.crearDesafio()));

  r.post('/auth/registro', lim, async (req, res) => {
    const b = validar(req.body, { nombre: { t: 'texto', req: true, min: 2, max: 100 }, correo: { t: 'email', req: true }, telefono: { t: 'telefono' }, password: { t: 'password', req: true }, acepta_privacidad: { t: 'bool', req: true } });
    await exigirHumano(req, req.body);
    if (!b.acepta_privacidad) throw noProcesable('Debes aceptar el aviso de privacidad y los términos', { errores: { acepta_privacidad: 'es obligatorio' } });
    const hash = await hashPassword(b.password);
    try {
      const idUsuario = await db.tx(async (t) => {
        const rol = await t.one("SELECT id FROM ROLES WHERE nombre_rol = 'CLIENTE'");
        const u = await t.run('INSERT INTO USUARIOS (nombre, correo, telefono, password_hash, id_rol, estado, fecha_registro) VALUES (?,?,?,?,?,?,?)', [b.nombre, b.correo, b.telefono ?? null, hash, rol.id, 'activo', aFechaBd()]);
        await t.run('INSERT INTO CLIENTES (id_usuario) VALUES (?)', [u.insertId]);
        return u.insertId;
      });
      await bitacora(req, 'registro', '', idUsuario);
      iniciarSesion(res, { id: idUsuario, rol: 'CLIENTE', nombre: b.nombre, correo: b.correo });
      res.json({ usuario: { id: idUsuario, nombre: b.nombre, correo: b.correo, rol: 'CLIENTE' } }, 201);
    } catch (e) {
      if (esDuplicado(e)) throw conflicto('Ese correo ya está registrado. ¿Quieres iniciar sesión?');
      throw e;
    }
  });

  r.post('/auth/login', lim, async (req, res) => {
    const b = validar(req.body, { correo: { t: 'email', req: true }, password: { t: 'texto', req: true, max: 100 } });
    const GENERICO = 'Correo o contraseña incorrectos';
    const u = await db.one('SELECT u.*, r.nombre_rol FROM USUARIOS u JOIN ROLES r ON r.id = u.id_rol WHERE u.correo = ?', [b.correo]);
    if (!u) { await gastarTiempo(b.password); await bitacora(req, 'login_fallo', 'correo desconocido'); throw noAutenticado(GENERICO); }
    if (u.bloqueado_hasta && deFechaBd(u.bloqueado_hasta) > new Date()) { await bitacora(req, 'login_bloqueado', '', u.id); throw new ErrorHttp(429, `Cuenta bloqueada temporalmente por intentos fallidos. Intenta en ${R.bloqueoMin} minutos o recupera tu contraseña.`); }
    if (u.estado !== 'activo') { await gastarTiempo(b.password); throw noAutenticado(GENERICO); }
    if (!(await verificarPassword(b.password, u.password_hash))) {
      const n = u.intentos_fallidos + 1;
      if (n >= R.maxIntentosLogin) await db.run('UPDATE USUARIOS SET intentos_fallidos = 0, bloqueado_hasta = ? WHERE id = ?', [aFechaBd(sumarMin(new Date(), R.bloqueoMin)), u.id]);
      else await db.run('UPDATE USUARIOS SET intentos_fallidos = ? WHERE id = ?', [n, u.id]);
      await bitacora(req, 'login_fallo', `intento ${n}`, u.id);
      throw noAutenticado(GENERICO);
    }
    await db.run('UPDATE USUARIOS SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ?', [u.id]);
    await bitacora(req, 'login_ok', '', u.id);
    iniciarSesion(res, { id: u.id, rol: u.nombre_rol, nombre: u.nombre, correo: u.correo });
    res.json({ usuario: { id: u.id, nombre: u.nombre, correo: u.correo, rol: u.nombre_rol } });
  });

  r.get('/auth/yo', (req, res) => res.json({ usuario: req.usuario }));
  r.post('/auth/logout', (req, res) => { ponerCookie(res, COOKIE_SESION, '', { maxAgeS: 0, produccion: config.produccion }); res.json({ ok: true }); });

  r.post('/auth/olvide', lim, async (req, res) => {
    const b = validar(req.body, { correo: { t: 'email', req: true } });
    await exigirHumano(req, req.body);
    const u = await db.one("SELECT id, nombre FROM USUARIOS WHERE correo = ? AND estado = 'activo'", [b.correo]);
    if (u) {
      const token = tokenAleatorio(32), ahora = new Date();
      await db.run('INSERT INTO TOKENS_RECUPERACION (id_usuario, token, fecha_creacion, fecha_expiracion, usado) VALUES (?,?,?,?,0)', [u.id, sha256(token), aFechaBd(ahora), aFechaBd(sumarMin(ahora, 30))]);
      const enlace = `${config.baseUrl}/restablecer?token=${token}`;
      await correo.enviar({ para: b.correo, asunto: 'Restablece tu contraseña', html: plantillaCorreo(config, 'Restablecer contraseña', `<p>Hola ${esc(u.nombre)}, usa este enlace (vence en 30 minutos):</p><p><a href="${enlace}">${enlace}</a></p><p>Si no lo pediste, ignora este mensaje.</p>`), texto: `Restablece tu contraseña: ${enlace}` });
      await bitacora(req, 'recuperacion_solicitada', '', u.id);
    }
    res.json({ mensaje: 'Si el correo existe, te enviamos un enlace para restablecer tu contraseña.' }); // misma respuesta exista o no
  });
  const tokenValido = async (token) => db.one('SELECT id, id_usuario, fecha_expiracion, usado FROM TOKENS_RECUPERACION WHERE token = ?', [sha256(String(token || ''))]);
  r.post('/auth/restablecer', lim, async (req, res) => {
    const b = validar(req.body, { token: { t: 'texto', req: true, max: 100 }, password: { t: 'password', req: true } });
    const t = await tokenValido(b.token);
    if (!t || t.usado || deFechaBd(t.fecha_expiracion) < new Date()) throw noProcesable('El enlace no es válido o ya venció. Solicita uno nuevo.');
    const hash = await hashPassword(b.password);
    await db.tx(async (x) => {
      await x.run('UPDATE USUARIOS SET password_hash = ?, intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ?', [hash, t.id_usuario]);
      await x.run('UPDATE TOKENS_RECUPERACION SET usado = 1 WHERE id_usuario = ?', [t.id_usuario]);
    });
    await bitacora(req, 'password_restablecida', '', t.id_usuario);
    res.json({ ok: true });
  });

  // ----- Cuenta y derechos ARCO (acceso, rectificación, cancelación) -----
  r.get('/cuenta', requerirLogin, async (req, res) => {
    const u = await db.one('SELECT id, nombre, correo, telefono, fecha_registro FROM USUARIOS WHERE id = ?', [req.usuario.id]);
    res.json({ cuenta: { ...u, rol: req.usuario.rol } });
  });
  r.put('/cuenta', requerirLogin, async (req, res) => {
    const b = validar(req.body, { nombre: { t: 'texto', req: true, min: 2, max: 100 }, telefono: { t: 'telefono' } });
    await db.run('UPDATE USUARIOS SET nombre = ?, telefono = ? WHERE id = ?', [b.nombre, b.telefono ?? null, req.usuario.id]);
    iniciarSesion(res, { ...req.usuario, nombre: b.nombre });
    res.json({ ok: true });
  });
  r.put('/cuenta/password', requerirLogin, async (req, res) => {
    const b = validar(req.body, { actual: { t: 'texto', req: true, max: 100 }, nueva: { t: 'password', req: true } });
    const u = await db.one('SELECT password_hash FROM USUARIOS WHERE id = ?', [req.usuario.id]);
    if (!(await verificarPassword(b.actual, u.password_hash))) throw noProcesable('La contraseña actual no es correcta', { errores: { actual: 'incorrecta' } });
    await db.run('UPDATE USUARIOS SET password_hash = ? WHERE id = ?', [await hashPassword(b.nueva), req.usuario.id]);
    await bitacora(req, 'password_cambiada');
    res.json({ ok: true });
  });
  /** Derecho de acceso/portabilidad: todos los datos personales en JSON. */
  r.get('/cuenta/exportar', requerirLogin, async (req, res) => {
    const id = req.usuario.id;
    const cl = await db.one('SELECT id FROM CLIENTES WHERE id_usuario = ?', [id]);
    const datos = { exportado: aFechaBd(), usuario: await db.one('SELECT id, nombre, correo, telefono, fecha_registro FROM USUARIOS WHERE id = ?', [id]) };
    if (cl) Object.assign(datos, {
      direcciones: await db.query('SELECT calle_numero, colonia, ciudad, codigo_postal, referencias FROM DIRECCIONES WHERE id_cliente = ?', [cl.id]),
      tarjetas: await db.query('SELECT marca, ultimos_digitos, mes_expiracion, anio_expiracion FROM TARJETAS WHERE id_cliente = ?', [cl.id]),
      pedidos: await db.query('SELECT v.id AS venta, c.folio, v.fecha, v.total, pe.estado FROM VENTAS v JOIN PEDIDOS pe ON pe.id = v.id_pedido JOIN COMPROBANTES c ON c.id_venta = v.id WHERE v.id_cliente = ?', [cl.id]),
      resenas: await db.query('SELECT id_producto, calificacion, comentario, fecha FROM RESENAS WHERE id_cliente = ?', [cl.id]),
    });
    res.enviar(JSON.stringify(datos, null, 2), 'application/json; charset=utf-8', 200, { 'Content-Disposition': 'attachment; filename="mis-datos-bakedelivery.json"', 'Cache-Control': 'no-store' });
  });
  /** Derecho de cancelación: se anonimiza la cuenta (se conservan ventas por obligación fiscal, sin datos personales). */
  r.delete('/cuenta', requerirLogin, async (req, res) => {
    const b = validar(req.body, { password: { t: 'texto', req: true, max: 100 } });
    if (req.usuario.rol !== 'CLIENTE') throw prohibido('Las cuentas del personal las gestiona un administrador');
    const u = await db.one('SELECT password_hash FROM USUARIOS WHERE id = ?', [req.usuario.id]);
    if (!(await verificarPassword(b.password, u.password_hash))) throw noProcesable('La contraseña no es correcta', { errores: { password: 'incorrecta' } });
    const cl = await db.one('SELECT id FROM CLIENTES WHERE id_usuario = ?', [req.usuario.id]);
    await db.tx(async (t) => {
      await t.run("UPDATE USUARIOS SET nombre = 'Cuenta eliminada', correo = ?, telefono = NULL, password_hash = ?, estado = 'eliminado' WHERE id = ?", [`eliminado-${req.usuario.id}@anonimo.invalid`, 'x', req.usuario.id]);
      await t.run('DELETE FROM TARJETAS WHERE id_cliente = ? AND id NOT IN (SELECT id_tarjeta FROM PEDIDOS WHERE id_tarjeta IS NOT NULL)', [cl.id]);
      await t.run('UPDATE DIRECCIONES SET referencias = NULL WHERE id_cliente = ?', [cl.id]);
      await t.run('DELETE FROM TOKENS_RECUPERACION WHERE id_usuario = ?', [req.usuario.id]);
    });
    await bitacora(req, 'cuenta_eliminada');
    ponerCookie(res, COOKIE_SESION, '', { maxAgeS: 0, produccion: config.produccion });
    res.json({ ok: true });
  });
  r.get('/auth/restablecer/validar', async (req, res) => {
    const t = await tokenValido(req.query.token);
    res.json({ valido: !!t && !t.usado && deFechaBd(t.fecha_expiracion) > new Date() });
  });
  return r;
}
