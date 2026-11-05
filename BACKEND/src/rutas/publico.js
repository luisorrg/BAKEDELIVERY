// Catálogo público, configuración visible, contacto y seguimiento por guía.
import { crearRouter, limitador } from '../lib/web.js';
import { validar, noEncontrado, paginar, aFechaBd, ErrorHttp, noProcesable } from '../lib/util.js';
import { listarProductos, obtenerProducto } from '../servicios/tienda.js';

export function rutasPublico({ db, config, bot, bitacora }) {
  const r = crearRouter('/api');
  const limContacto = limitador({ max: 5, ventanaMs: 10 * 60000 });

  r.get('/config', async (req, res) => {
    const fondo = Object.fromEntries((await db.query('SELECT clave, valor FROM CONFIG_FONDO')).map((f) => [f.clave, f.valor]));
    res.json({ tienda: config.tienda, reglas: { horasAnticipacion: config.reglas.horasAnticipacion, costoEnvio: config.reglas.costoEnvio, envioGratisDesde: config.reglas.envioGratisDesde, diasDevolucion: config.reglas.diasDevolucion, diasGarantia: config.reglas.diasGarantia }, fondo, gaId: config.gaId });
  });
  r.get('/categorias', async (req, res) => res.json({ categorias: await db.query('SELECT id, nombre, descripcion FROM CATEGORIAS ORDER BY id') }));
  r.get('/tipos-pago', async (req, res) => res.json({ tipos: await db.query('SELECT id, nombre FROM TIPOS_PAGO ORDER BY id') }));

  r.get('/productos', async (req, res) => {
    const { limite, desplazamiento } = paginar(req.query, 60);
    res.json(await listarProductos(db, { categoria: req.query.categoria, q: req.query.q, orden: req.query.orden, soloOfertas: req.query.ofertas === '1', limite, desplazamiento }));
  });
  r.get('/productos/:id', async (req, res) => {
    const p = await obtenerProducto(db, Number(req.params.id));
    if (!p) throw noEncontrado('Producto no encontrado');
    res.json({ producto: p });
  });
  r.get('/productos/:id/resenas', async (req, res) => {
    const filas = await db.query(`SELECT r.id, r.calificacion, r.comentario, r.fecha, u.nombre FROM RESENAS r JOIN CLIENTES c ON c.id = r.id_cliente JOIN USUARIOS u ON u.id = c.id_usuario WHERE r.id_producto = ? ORDER BY r.fecha DESC LIMIT 50`, [Number(req.params.id)]);
    res.json({ resenas: filas.map((f) => ({ ...f, nombre: f.nombre.split(' ')[0] })) }); // solo nombre de pila (privacidad)
  });

  r.post('/contacto', limContacto, async (req, res) => {
    const b = validar(req.body, { nombre: { t: 'texto', req: true, min: 2, max: 100 }, correo: { t: 'email', req: true }, asunto: { t: 'texto', req: true, min: 3, max: 120 }, mensaje: { t: 'texto', req: true, min: 10, max: 2000 }, acepta_privacidad: { t: 'bool', req: true } });
    if (req.body.sitio_web) { await bitacora(req, 'bot_honeypot'); throw new ErrorHttp(400, 'Solicitud rechazada'); }
    if (!bot.verificar(req.body.bot_token, req.body.bot_respuesta)) throw noProcesable('No pudimos verificar que eres humano', { errores: { bot_respuesta: 'respuesta incorrecta o muy rápida' }, nuevo_desafio: bot.crearDesafio() });
    if (!b.acepta_privacidad) throw noProcesable('Debes aceptar el aviso de privacidad', { errores: { acepta_privacidad: 'es obligatorio' } });
    await db.run('INSERT INTO MENSAJES_CONTACTO (nombre, correo, asunto, mensaje, fecha) VALUES (?,?,?,?,?)', [b.nombre, b.correo, b.asunto, b.mensaje, aFechaBd()]);
    res.json({ mensaje: '¡Gracias! Recibimos tu mensaje y te responderemos pronto.' }, 201);
  });

  /** Seguimiento por número de guía: solo estado, sin datos personales. */
  r.get('/seguimiento/:guia', limitador({ max: 30, ventanaMs: 60000 }), async (req, res) => {
    const e = await db.one(`SELECT e.num_guia, e.estado, e.fecha_envio, e.fecha_estimada_entrega, ve.fecha_entrega_real FROM ENVIOS e LEFT JOIN VALIDACION_ENTREGA ve ON ve.id_envio = e.id WHERE e.num_guia = ?`, [String(req.params.guia).toUpperCase().slice(0, 30)]);
    if (!e) throw noEncontrado('No encontramos esa guía');
    res.json({ envio: e });
  });
  return r;
}
