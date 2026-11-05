// Zona del comprador: carrito, direcciones, tarjetas, pedidos, seguimiento, devoluciones, garantías y reseñas.
import { crearRouter } from '../lib/web.js';
import { validar, noEncontrado, noProcesable, conflicto, ErrorHttp, aFechaBd, deFechaBd, sumarHoras, redondear } from '../lib/util.js';
import { verificarDatosTarjeta } from '../lib/tarjeta.js';
import { autorizarTarjeta, tokenizarTarjeta } from '../lib/pasarela.js';
import { requerirRol, cargarCliente } from '../servicios/sesion.js';
import { esDuplicado, esErrorFk } from '../servicios/bitacora.js';
import { carritoAbierto, lineasCarrito, subtotalDe, costoEnvio, confirmarPedido, detalleVenta, pdfDeVenta, enviarComprobante, cancelarPedido } from '../servicios/tienda.js';

export function rutasCliente({ db, config, correo, limiteTarjeta }) {
  const r = crearRouter('/api', [requerirRol('CLIENTE'), cargarCliente(db)]);
  const ctx = { db, config, correo, limite: limiteTarjeta };

  // ----- Carrito -----
  const resumen = async (cliente, entrega = 'DOMICILIO') => {
    const c = await carritoAbierto(db, cliente.id, false);
    const lineas = c ? await lineasCarrito(db, c.id) : [];
    const subtotal = subtotalDe(lineas), envio = costoEnvio(config, subtotal, entrega);
    return { lineas, subtotal, costo_envio: envio, total: redondear(subtotal + envio), envio_gratis_desde: config.reglas.envioGratisDesde };
  };
  r.get('/carrito', async (req, res) => res.json(await resumen(req.cliente, req.query.entrega === 'RECOGER' ? 'RECOGER' : 'DOMICILIO')));

  const PERSONAL = { mensaje_pastel: { t: 'texto', max: 100 }, relleno: { t: 'texto', max: 80 }, cobertura: { t: 'texto', max: 80 }, decoracion: { t: 'texto', max: 500 }, notas_alergias: { t: 'texto', max: 255 } };
  r.post('/carrito/items', async (req, res) => {
    const b = validar(req.body, { id_producto: { t: 'entero', req: true, min: 1 }, cantidad: { t: 'entero', req: true, min: 1, max: 50 } });
    const p = await db.one('SELECT p.id, p.nombre, p.es_personalizable, COALESCE(s.stock_actual,0) AS stock FROM PRODUCTOS p LEFT JOIN STOCK s ON s.id_producto = p.id WHERE p.id = ? AND p.activo = 1', [b.id_producto]);
    if (!p) throw noEncontrado('Producto no disponible');
    const pers = req.body.personalizacion && p.es_personalizable ? validar(req.body.personalizacion, PERSONAL) : null;
    const c = await carritoAbierto(db, req.cliente.id);
    const previo = await db.one('SELECT d.id, d.cantidad FROM DETALLE_CARRITO d LEFT JOIN PERSONALIZACIONES pz ON pz.id_detalle_carrito = d.id WHERE d.id_carrito = ? AND d.id_producto = ? AND pz.id IS NULL', [c.id, p.id]);
    const total = b.cantidad + (previo && !pers ? previo.cantidad : 0);
    if (total > p.stock) throw conflicto(p.stock ? `Solo quedan ${p.stock} de "${p.nombre}"` : `"${p.nombre}" está agotado`);
    let idDet;
    if (previo && !pers) { await db.run('UPDATE DETALLE_CARRITO SET cantidad = ? WHERE id = ?', [total, previo.id]); idDet = previo.id; }
    else {
      idDet = (await db.run('INSERT INTO DETALLE_CARRITO (id_carrito, id_producto, cantidad) VALUES (?,?,?)', [c.id, p.id, b.cantidad])).insertId;
      if (pers && Object.values(pers).some(Boolean)) await db.run('INSERT INTO PERSONALIZACIONES (id_detalle_carrito, mensaje_pastel, relleno, cobertura, decoracion, notas_alergias) VALUES (?,?,?,?,?,?)', [idDet, pers.mensaje_pastel ?? null, pers.relleno ?? null, pers.cobertura ?? null, pers.decoracion ?? null, pers.notas_alergias ?? null]);
    }
    res.json(await resumen(req.cliente), 201);
  });
  const lineaPropia = async (req) => {
    const l = await db.one("SELECT d.id, d.id_producto FROM DETALLE_CARRITO d JOIN CARRITO c ON c.id = d.id_carrito WHERE d.id = ? AND c.id_cliente = ? AND c.estado = 'abierto'", [Number(req.params.id), req.cliente.id]);
    if (!l) throw noEncontrado('Ese artículo no está en tu carrito');
    return l;
  };
  r.put('/carrito/items/:id', async (req, res) => {
    const b = validar(req.body, { cantidad: { t: 'entero', req: true, min: 1, max: 50 } });
    const l = await lineaPropia(req);
    const s = await db.one('SELECT COALESCE(stock_actual,0) AS stock FROM STOCK WHERE id_producto = ?', [l.id_producto]);
    if (b.cantidad > (s?.stock ?? 0)) throw conflicto(`Solo quedan ${s?.stock ?? 0} piezas`);
    await db.run('UPDATE DETALLE_CARRITO SET cantidad = ? WHERE id = ?', [b.cantidad, l.id]);
    res.json(await resumen(req.cliente));
  });
  r.delete('/carrito/items/:id', async (req, res) => {
    const l = await lineaPropia(req);
    await db.tx(async (t) => { await t.run('DELETE FROM PERSONALIZACIONES WHERE id_detalle_carrito = ?', [l.id]); await t.run('DELETE FROM DETALLE_CARRITO WHERE id = ?', [l.id]); });
    res.json(await resumen(req.cliente));
  });

  // ----- Direcciones -----
  const DIR = { calle_numero: { t: 'texto', req: true, min: 3, max: 150 }, colonia: { t: 'texto', max: 100 }, ciudad: { t: 'texto', max: 100 }, codigo_postal: { t: 'texto', max: 10 }, referencias: { t: 'texto', max: 200 } };
  r.get('/direcciones', async (req, res) => res.json({ direcciones: await db.query('SELECT id, calle_numero, colonia, ciudad, codigo_postal, referencias FROM DIRECCIONES WHERE id_cliente = ? ORDER BY id', [req.cliente.id]) }));
  r.post('/direcciones', async (req, res) => {
    const b = validar(req.body, DIR);
    const x = await db.run('INSERT INTO DIRECCIONES (id_cliente, calle_numero, colonia, ciudad, codigo_postal, referencias) VALUES (?,?,?,?,?,?)', [req.cliente.id, b.calle_numero, b.colonia ?? null, b.ciudad ?? null, b.codigo_postal ?? null, b.referencias ?? null]);
    res.json({ id: x.insertId }, 201);
  });
  r.put('/direcciones/:id', async (req, res) => {
    const b = validar(req.body, DIR);
    const x = await db.run('UPDATE DIRECCIONES SET calle_numero = ?, colonia = ?, ciudad = ?, codigo_postal = ?, referencias = ? WHERE id = ? AND id_cliente = ?', [b.calle_numero, b.colonia ?? null, b.ciudad ?? null, b.codigo_postal ?? null, b.referencias ?? null, Number(req.params.id), req.cliente.id]);
    if (!x.filas) throw noEncontrado('Dirección no encontrada');
    res.json({ ok: true });
  });
  r.delete('/direcciones/:id', async (req, res) => {
    try { const x = await db.run('DELETE FROM DIRECCIONES WHERE id = ? AND id_cliente = ?', [Number(req.params.id), req.cliente.id]); if (!x.filas) throw noEncontrado('Dirección no encontrada'); }
    catch (e) { if (esErrorFk(e)) throw conflicto('Esa dirección está ligada a un pedido y no se puede eliminar'); throw e; }
    res.json({ ok: true });
  });

  // ----- Tarjetas (verificación + pasarela simulada). Nunca se guarda número completo ni CVV -----
  const clave = (req) => `u${req.usuario.id}`;
  const guardia = (req) => { const e = limiteTarjeta.bloqueado(clave(req)); if (e) throw new ErrorHttp(429, `Demasiados intentos con tarjetas. Espera ${Math.ceil(e / 60)} min.`, { reintentar_en: e }); };
  const CARD = { numero: { t: 'texto', req: true, max: 30 }, mes: { t: 'entero', req: true, min: 1, max: 12 }, anio: { t: 'entero', req: true, min: 0, max: 2100 }, cvv: { t: 'texto', req: true, max: 4 } };
  const publica = (v) => ({ valida: v.valida, marca: v.marca, mascara: v.mascara, verificaciones: v.verificaciones, errores: v.errores });
  r.get('/tarjetas', async (req, res) => res.json({ tarjetas: await db.query('SELECT id, marca, ultimos_digitos, mes_expiracion, anio_expiracion, verificada FROM TARJETAS WHERE id_cliente = ? ORDER BY id', [req.cliente.id]) }));
  r.post('/tarjetas/verificar', async (req, res) => { // solo formato: no consulta al banco ni guarda nada
    guardia(req);
    const v = verificarDatosTarjeta(validar(req.body, CARD));
    if (!v.valida) limiteTarjeta.fallo(clave(req));
    res.json(publica(v));
  });
  r.post('/tarjetas', async (req, res) => {
    guardia(req);
    const v = verificarDatosTarjeta(validar(req.body, CARD));
    if (!v.valida) { limiteTarjeta.fallo(clave(req)); throw noProcesable('Tarjeta inválida', publica(v)); }
    const dup = await db.one('SELECT id FROM TARJETAS WHERE id_cliente = ? AND ultimos_digitos = ? AND marca = ? AND mes_expiracion = ? AND anio_expiracion = ?', [req.cliente.id, v.ultimosDigitos, v.marca, v.mes, v.anio]);
    if (dup) throw conflicto('Esa tarjeta ya está registrada');
    const ap = autorizarTarjeta({ marca: v.marca, ultimosDigitos: v.ultimosDigitos, contexto: 'verificacion' });
    if (!ap.aprobada) { limiteTarjeta.fallo(clave(req)); throw new ErrorHttp(402, ap.mensaje, { codigo: ap.codigo }); }
    const x = await db.run('INSERT INTO TARJETAS (id_cliente, token_pago, ultimos_digitos, marca, mes_expiracion, anio_expiracion, verificada) VALUES (?,?,?,?,?,?,1)', [req.cliente.id, tokenizarTarjeta(), v.ultimosDigitos, v.marca, v.mes, v.anio]);
    res.json({ id: x.insertId, marca: v.marca, mascara: v.mascara }, 201);
  });
  r.delete('/tarjetas/:id', async (req, res) => {
    try { const x = await db.run('DELETE FROM TARJETAS WHERE id = ? AND id_cliente = ?', [Number(req.params.id), req.cliente.id]); if (!x.filas) throw noEncontrado('Tarjeta no encontrada'); }
    catch (e) { if (esErrorFk(e)) throw conflicto('Esa tarjeta está ligada a un pedido y no se puede eliminar'); throw e; }
    res.json({ ok: true });
  });

  // ----- Pedidos -----
  r.post('/pedidos', async (req, res) => {
    const b = validar(req.body, { tipo_entrega: { t: 'enum', valores: ['DOMICILIO', 'RECOGER'], req: true }, id_direccion: { t: 'entero', min: 1 }, id_tipo_pago: { t: 'entero', req: true, min: 1 }, id_tarjeta: { t: 'entero', min: 1 }, cvv: { t: 'texto', max: 4 }, fecha_entrega: { t: 'fechahora', req: true } });
    const x = await confirmarPedido(ctx, req.cliente, b);
    res.json(x, 201);
  });
  r.get('/mis-pedidos', async (req, res) => {
    const filas = await db.query(`SELECT v.id AS id_venta, pe.id AS id_pedido, c.folio, v.fecha, v.total, pe.estado, pe.tipo_entrega, pe.fecha_entrega_programada, e.num_guia, e.estado AS estado_envio,
      (SELECT COUNT(*) FROM DETALLE_VENTAS dv WHERE dv.id_venta = v.id) AS articulos
      FROM VENTAS v JOIN PEDIDOS pe ON pe.id = v.id_pedido JOIN COMPROBANTES c ON c.id_venta = v.id LEFT JOIN ENVIOS e ON e.id_venta = v.id WHERE v.id_cliente = ? ORDER BY v.id DESC LIMIT 100`, [req.cliente.id]);
    res.json({ pedidos: filas });
  });
  const ventaPropia = async (req) => {
    const v = await db.one('SELECT id FROM VENTAS WHERE id = ? AND id_cliente = ?', [Number(req.params.id), req.cliente.id]);
    if (!v) throw noEncontrado('Pedido no encontrado');
    return detalleVenta(db, v.id);
  };
  const publico = (d) => { const { correo: _c, telefono: _t, ...resto } = d; return resto; };
  r.get('/mis-pedidos/:id', async (req, res) => res.json({ pedido: publico(await ventaPropia(req)) }));
  r.get('/mis-pedidos/:id/ticket.pdf', async (req, res) => {
    const d = await ventaPropia(req);
    res.enviar(pdfDeVenta(config, d), 'application/pdf', 200, { 'Content-Disposition': `inline; filename="${d.folio}.pdf"`, 'Cache-Control': 'no-store' });
  });
  r.post('/mis-pedidos/:id/comprobante', async (req, res) => {
    const d = await ventaPropia(req);
    const x = await enviarComprobante(ctx, d.id);
    res.json({ enviado: x.enviado, modo: x.modo });
  });
  r.post('/mis-pedidos/:id/cancelar', async (req, res) => {
    const d = await ventaPropia(req);
    res.json(await cancelarPedido(ctx, d.id_pedido, { idCliente: req.cliente.id }));
  });

  // ----- Devoluciones y garantías -----
  async function elegible(req, dias, idProducto, cantidad) {
    const d = await ventaPropia({ params: { id: req.body.id_venta }, cliente: req.cliente });
    if (d.estado !== 'entregado') throw conflicto('Solo puedes solicitarlo cuando el pedido ya fue entregado');
    const ref = deFechaBd(d.fecha_entrega_real || d.fecha_entrega_programada);
    if (new Date() > sumarHoras(ref, dias * 24)) throw conflicto(`El plazo de ${dias} días ya venció`);
    const item = d.items.find((i) => i.id_producto === idProducto);
    if (!item) throw noProcesable('Ese producto no pertenece al pedido');
    return { d, item };
  }
  r.post('/devoluciones', async (req, res) => {
    const b = validar(req.body, { id_venta: { t: 'entero', req: true, min: 1 }, id_producto: { t: 'entero', req: true, min: 1 }, cantidad: { t: 'entero', req: true, min: 1, max: 50 }, motivo: { t: 'texto', req: true, min: 5, max: 255 } });
    const { item } = await elegible(req, config.reglas.diasDevolucion, b.id_producto);
    const previas = await db.one("SELECT COALESCE(SUM(cantidad),0) AS n FROM DEVOLUCIONES_VENTA WHERE id_venta = ? AND id_producto = ? AND estado <> 'rechazada'", [b.id_venta, b.id_producto]);
    if (b.cantidad + previas.n > item.cantidad) throw conflicto(`Solo puedes devolver hasta ${item.cantidad - previas.n} pieza(s) de este producto`);
    const x = await db.run('INSERT INTO DEVOLUCIONES_VENTA (id_venta, id_producto, cantidad, motivo, fecha) VALUES (?,?,?,?,?)', [b.id_venta, b.id_producto, b.cantidad, b.motivo, aFechaBd()]);
    res.json({ id: x.insertId }, 201);
  });
  r.post('/garantias', async (req, res) => {
    const b = validar(req.body, { id_venta: { t: 'entero', req: true, min: 1 }, id_producto: { t: 'entero', req: true, min: 1 }, motivo: { t: 'texto', req: true, min: 5, max: 255 } });
    await elegible(req, config.reglas.diasGarantia, b.id_producto);
    const abierta = await db.one("SELECT id FROM GARANTIAS WHERE id_venta = ? AND id_producto = ? AND estado = 'abierta'", [b.id_venta, b.id_producto]);
    if (abierta) throw conflicto('Ya tienes una garantía abierta para este producto');
    const x = await db.run('INSERT INTO GARANTIAS (id_venta, id_producto, fecha_solicitud, motivo) VALUES (?,?,?,?)', [b.id_venta, b.id_producto, aFechaBd(), b.motivo]);
    res.json({ id: x.insertId }, 201);
  });
  r.get('/mis-solicitudes', async (req, res) => {
    const dev = await db.query('SELECT d.id, c.folio, p.nombre AS producto, d.cantidad, d.motivo, d.fecha, d.estado FROM DEVOLUCIONES_VENTA d JOIN VENTAS v ON v.id = d.id_venta JOIN COMPROBANTES c ON c.id_venta = v.id JOIN PRODUCTOS p ON p.id = d.id_producto WHERE v.id_cliente = ? ORDER BY d.id DESC', [req.cliente.id]);
    const gar = await db.query('SELECT g.id, c.folio, p.nombre AS producto, g.motivo, g.fecha_solicitud AS fecha, g.estado, g.resolucion FROM GARANTIAS g JOIN VENTAS v ON v.id = g.id_venta JOIN COMPROBANTES c ON c.id_venta = v.id JOIN PRODUCTOS p ON p.id = g.id_producto WHERE v.id_cliente = ? ORDER BY g.id DESC', [req.cliente.id]);
    res.json({ devoluciones: dev, garantias: gar });
  });

  // ----- Reseñas (solo quien compró el producto) -----
  r.post('/productos/:id/resenas', async (req, res) => {
    const id = Number(req.params.id);
    const b = validar(req.body, { calificacion: { t: 'entero', req: true, min: 1, max: 5 }, comentario: { t: 'texto', max: 1000 } });
    const compro = await db.one('SELECT dv.id FROM DETALLE_VENTAS dv JOIN VENTAS v ON v.id = dv.id_venta JOIN PEDIDOS pe ON pe.id = v.id_pedido WHERE v.id_cliente = ? AND dv.id_producto = ? AND pe.estado <> ?', [req.cliente.id, id, 'cancelado']);
    if (!compro) throw noProcesable('Solo puedes reseñar productos que has comprado');
    const previa = await db.one('SELECT id FROM RESENAS WHERE id_cliente = ? AND id_producto = ?', [req.cliente.id, id]);
    if (previa) await db.run('UPDATE RESENAS SET calificacion = ?, comentario = ?, fecha = ? WHERE id = ?', [b.calificacion, b.comentario ?? null, aFechaBd(), previa.id]);
    else await db.run('INSERT INTO RESENAS (id_producto, id_cliente, calificacion, comentario, fecha) VALUES (?,?,?,?,?)', [id, req.cliente.id, b.calificacion, b.comentario ?? null, aFechaBd()]);
    res.json({ ok: true }, previa ? 200 : 201);
  });
  return r;
}
