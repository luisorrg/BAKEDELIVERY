// Panel del vendedor: productos, inventario, proveedores, compras, pedidos, envíos, devoluciones, reportes, usuarios.
import { crearRouter } from '../lib/web.js';
import { validar, noEncontrado, noProcesable, conflicto, prohibido, aFechaBd, paginar, soloFecha, redondear } from '../lib/util.js';
import { hashPassword } from '../lib/auth.js';
import { requerirRol } from '../servicios/sesion.js';
import { esDuplicado, esErrorFk } from '../servicios/bitacora.js';
import { listarProductos, obtenerProducto, evaluarAlertas, descuentoSugerido, detalleVenta, cancelarPedido, enviarComprobante, pdfDeVenta } from '../servicios/tienda.js';

const ESTADOS_PEDIDO = ['pendiente', 'pagado', 'en_preparacion', 'listo', 'enviado', 'entregado', 'cancelado'];
const csv = (filas) => { if (!filas.length) return ''; const k = Object.keys(filas[0]); const c = (v) => { v = String(v ?? ''); if (/^[=+\-@]/.test(v)) v = "'" + v; return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; }; return '﻿' + [k.join(','), ...filas.map((f) => k.map((x) => c(f[x])).join(','))].join('\n'); };

export function rutasAdmin({ db, config, correo, bitacora }) {
  const personal = crearRouter('/api/admin', [requerirRol('ADMIN', 'REPOSTERO')]);
  const solo = crearRouter('/api/admin', [requerirRol('ADMIN')]);
  const r = personal;
  const ok = (res) => res.json({ ok: true });

  // ----- Resumen -----
  r.get('/resumen', async (req, res) => {
    const hoy = soloFecha(), mes = hoy.slice(0, 7) + '-01';
    const v = (d) => db.one("SELECT COALESCE(SUM(v.total),0) AS total, COUNT(*) AS n FROM VENTAS v JOIN PEDIDOS pe ON pe.id = v.id_pedido WHERE v.fecha >= ? AND pe.estado <> 'cancelado'", [d]);
    const n = (sql, p = []) => db.one(sql, p).then((x) => x.n);
    res.json({
      ventas_hoy: await v(hoy), ventas_mes: await v(mes),
      pedidos_por_atender: await n("SELECT COUNT(*) AS n FROM PEDIDOS WHERE estado IN ('pendiente','pagado','en_preparacion')"),
      alertas_abiertas: await n('SELECT COUNT(*) AS n FROM ALERTAS_INVENTARIO WHERE atendida = 0'),
      mensajes_sin_leer: await n('SELECT COUNT(*) AS n FROM MENSAJES_CONTACTO WHERE leido = 0'),
      devoluciones_abiertas: await n("SELECT COUNT(*) AS n FROM DEVOLUCIONES_VENTA WHERE estado = 'solicitada'") + await n("SELECT COUNT(*) AS n FROM GARANTIAS WHERE estado = 'abierta'"),
      proximas_entregas: await db.query("SELECT pe.id, c.folio, pe.fecha_entrega_programada, pe.estado, pe.tipo_entrega FROM PEDIDOS pe JOIN VENTAS v ON v.id_pedido = pe.id JOIN COMPROBANTES c ON c.id_venta = v.id WHERE pe.estado IN ('pagado','pendiente','en_preparacion','listo') ORDER BY pe.fecha_entrega_programada LIMIT 6"),
    });
  });

  // ----- Categorías -----
  r.get('/categorias', async (req, res) => res.json({ categorias: await db.query('SELECT id, nombre, descripcion FROM CATEGORIAS ORDER BY nombre') }));
  r.post('/categorias', async (req, res) => {
    const b = validar(req.body, { nombre: { t: 'texto', req: true, max: 80 }, descripcion: { t: 'texto', max: 150 } });
    try { res.json({ id: (await db.run('INSERT INTO CATEGORIAS (nombre, descripcion) VALUES (?,?)', [b.nombre, b.descripcion ?? null])).insertId }, 201); }
    catch (e) { if (esDuplicado(e)) throw conflicto('Ya existe esa categoría'); throw e; }
  });
  r.put('/categorias/:id', async (req, res) => {
    const b = validar(req.body, { nombre: { t: 'texto', req: true, max: 80 }, descripcion: { t: 'texto', max: 150 } });
    if (!(await db.run('UPDATE CATEGORIAS SET nombre = ?, descripcion = ? WHERE id = ?', [b.nombre, b.descripcion ?? null, Number(req.params.id)])).filas) throw noEncontrado();
    ok(res);
  });

  // ----- Productos e inventario terminado -----
  const PROD = { nombre: { t: 'texto', req: true, min: 2, max: 120 }, id_categoria: { t: 'entero', req: true, min: 1 }, descripcion: { t: 'texto', max: 2000 }, sabor: { t: 'texto', max: 60 }, porciones: { t: 'entero', min: 1, max: 500 }, lote: { t: 'texto', max: 50 }, caducidad: { t: 'fecha' }, costo: { t: 'numero', req: true, min: 0 }, precio: { t: 'numero', req: true, min: 0.01 }, es_personalizable: { t: 'bool', def: 0 }, activo: { t: 'bool', def: 1 }, imagen_url: { t: 'texto', max: 255 }, stock_actual: { t: 'entero', min: 0, def: 0 }, stock_minimo: { t: 'entero', min: 0, def: 0 }, stock_maximo: { t: 'entero', min: 0, def: 0 } };
  r.get('/productos', async (req, res) => { const { limite, desplazamiento } = paginar(req.query, 200); res.json(await listarProductos(db, { admin: true, q: req.query.q, categoria: req.query.categoria, limite, desplazamiento })); });
  r.get('/productos/:id', async (req, res) => { const p = await obtenerProducto(db, Number(req.params.id), true); if (!p) throw noEncontrado(); res.json({ producto: p }); });
  const guardarProducto = async (req, res, id) => {
    const b = validar(req.body, PROD);
    if (b.precio < b.costo) throw noProcesable('El precio no puede ser menor al costo', { errores: { precio: 'menor al costo' } });
    if (b.stock_maximo && b.stock_maximo < b.stock_minimo) throw noProcesable('El máximo debe ser mayor al mínimo', { errores: { stock_maximo: 'menor al mínimo' } });
    const cat = await db.one('SELECT id FROM CATEGORIAS WHERE id = ?', [b.id_categoria]);
    if (!cat) throw noProcesable('Categoría no válida', { errores: { id_categoria: 'no existe' } });
    if (b.imagen_url && !/^\/compartido\/img\/(fotos\/)?[\w.\-]+$/.test(b.imagen_url) && !/^https:\/\//.test(b.imagen_url)) throw noProcesable('La imagen debe ser una ruta /compartido/img/… o una URL https', { errores: { imagen_url: 'no válida' } });
    const campos = [b.id_categoria, b.nombre, b.descripcion ?? null, b.sabor ?? null, b.porciones ?? null, b.lote ?? null, b.caducidad ?? null, b.costo, b.precio, b.es_personalizable, b.activo, b.imagen_url ?? null];
    const nuevoId = await db.tx(async (t) => {
      if (id) { if (!(await t.run('UPDATE PRODUCTOS SET id_categoria=?, nombre=?, descripcion=?, sabor=?, porciones=?, lote=?, caducidad=?, costo=?, precio=?, es_personalizable=?, activo=?, imagen_url=? WHERE id=?', [...campos, id])).filas && !(await t.one('SELECT id FROM PRODUCTOS WHERE id = ?', [id]))) throw noEncontrado(); await t.run('UPDATE STOCK SET stock_actual=?, stock_minimo=?, stock_maximo=? WHERE id_producto=?', [b.stock_actual, b.stock_minimo, b.stock_maximo, id]); return id; }
      const n = await t.run('INSERT INTO PRODUCTOS (id_categoria, nombre, descripcion, sabor, porciones, lote, caducidad, costo, precio, es_personalizable, activo, imagen_url) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', campos);
      await t.run('INSERT INTO STOCK (id_producto, stock_actual, stock_minimo, stock_maximo) VALUES (?,?,?,?)', [n.insertId, b.stock_actual, b.stock_minimo, b.stock_maximo]);
      return n.insertId;
    });
    const alertas = await evaluarAlertas(db, { idProducto: nuevoId });
    await bitacora(req, id ? 'producto_editado' : 'producto_creado', `#${nuevoId} ${b.nombre}`);
    res.json({ id: nuevoId, alertas, descuento_sugerido: descuentoSugerido(b.stock_actual, b.stock_maximo) }, id ? 200 : 201);
  };
  r.post('/productos', (req, res) => guardarProducto(req, res, null));
  r.put('/productos/:id', (req, res) => guardarProducto(req, res, Number(req.params.id)));
  r.delete('/productos/:id', async (req, res) => { // baja lógica: conserva el historial de ventas
    if (!(await db.run('UPDATE PRODUCTOS SET activo = 0 WHERE id = ?', [Number(req.params.id)])).filas) throw noEncontrado();
    await bitacora(req, 'producto_desactivado', `#${req.params.id}`); ok(res);
  });
  r.post('/productos/:id/stock', async (req, res) => { // ajuste rápido: delta (+/-) o valor
    const b = validar(req.body, { delta: { t: 'entero', min: -100000, max: 100000 }, stock_actual: { t: 'entero', min: 0 }, motivo: { t: 'texto', max: 100 } });
    if (b.delta === undefined && b.stock_actual === undefined) throw noProcesable('Indica delta o stock_actual');
    const id = Number(req.params.id);
    const x = b.delta !== undefined ? await db.run('UPDATE STOCK SET stock_actual = stock_actual + ? WHERE id_producto = ? AND stock_actual + ? >= 0', [b.delta, id, b.delta]) : await db.run('UPDATE STOCK SET stock_actual = ? WHERE id_producto = ?', [b.stock_actual, id]);
    if (!x.filas) throw conflicto('Producto sin registro de stock o el ajuste dejaría el stock negativo');
    const alertas = await evaluarAlertas(db, { idProducto: id });
    await bitacora(req, 'stock_ajustado', `#${id} ${b.delta ?? '=' + b.stock_actual} ${b.motivo ?? ''}`);
    res.json({ alertas, producto: await obtenerProducto(db, id, true) });
  });
  r.get('/productos/:id/receta', async (req, res) => res.json({ receta: await db.query('SELECT r.id_insumo, i.nombre, i.unidad_medida, r.cantidad FROM RECETAS r JOIN INSUMOS i ON i.id = r.id_insumo WHERE r.id_producto = ?', [Number(req.params.id)]) }));
  r.put('/productos/:id/receta', async (req, res) => {
    const id = Number(req.params.id);
    const items = Array.isArray(req.body.items) ? req.body.items.slice(0, 40).map((i) => validar(i, { id_insumo: { t: 'entero', req: true, min: 1 }, cantidad: { t: 'numero', req: true, min: 0.001 } })) : [];
    await db.tx(async (t) => { await t.run('DELETE FROM RECETAS WHERE id_producto = ?', [id]); for (const i of items) await t.run('INSERT INTO RECETAS (id_producto, id_insumo, cantidad) VALUES (?,?,?)', [id, i.id_insumo, i.cantidad]); });
    ok(res);
  });

  // ----- Alertas y ofertas (mínimo / máximo) -----
  r.get('/alertas', async (req, res) => res.json({ alertas: await db.query(`SELECT a.id, a.tipo, a.id_producto, a.id_insumo, a.mensaje, a.fecha, a.atendida, COALESCE(p.nombre, i.nombre) AS nombre FROM ALERTAS_INVENTARIO a LEFT JOIN PRODUCTOS p ON p.id = a.id_producto LEFT JOIN INSUMOS i ON i.id = a.id_insumo WHERE a.atendida = ? ORDER BY a.id DESC LIMIT 100`, [req.query.atendidas === '1' ? 1 : 0]) }));
  r.put('/alertas/:id/atender', async (req, res) => { await db.run('UPDATE ALERTAS_INVENTARIO SET atendida = 1 WHERE id = ?', [Number(req.params.id)]); ok(res); });
  r.get('/ofertas-sugeridas', async (req, res) => {
    const filas = await db.query('SELECT p.id, p.nombre, p.precio, s.stock_actual, s.stock_maximo FROM PRODUCTOS p JOIN STOCK s ON s.id_producto = p.id WHERE p.activo = 1 AND s.stock_maximo > 0');
    res.json({ sugerencias: filas.map((f) => ({ ...f, descuento_sugerido: descuentoSugerido(f.stock_actual, f.stock_maximo) })).filter((f) => f.descuento_sugerido > 0) });
  });
  r.get('/promociones', async (req, res) => res.json({ promociones: await db.query('SELECT pr.*, p.nombre FROM PROMOCIONES pr JOIN PRODUCTOS p ON p.id = pr.id_producto ORDER BY pr.id DESC LIMIT 100') }));
  r.post('/promociones', async (req, res) => {
    const b = validar(req.body, { id_producto: { t: 'entero', req: true, min: 1 }, porcentaje_descuento: { t: 'numero', req: true, min: 1, max: 90 }, motivo: { t: 'texto', max: 100 }, fecha_inicio: { t: 'fecha', req: true }, fecha_fin: { t: 'fecha', req: true } });
    if (b.fecha_fin < b.fecha_inicio) throw noProcesable('La fecha final no puede ser anterior a la inicial', { errores: { fecha_fin: 'anterior al inicio' } });
    try { res.json({ id: (await db.run('INSERT INTO PROMOCIONES (id_producto, porcentaje_descuento, motivo, fecha_inicio, fecha_fin, activa) VALUES (?,?,?,?,?,1)', [b.id_producto, b.porcentaje_descuento, b.motivo ?? null, b.fecha_inicio, b.fecha_fin])).insertId }, 201); }
    catch (e) { if (esErrorFk(e)) throw noProcesable('Producto no válido'); throw e; }
  });
  r.delete('/promociones/:id', async (req, res) => { await db.run('UPDATE PROMOCIONES SET activa = 0 WHERE id = ?', [Number(req.params.id)]); ok(res); });

  // ----- Insumos -----
  const INS = { nombre: { t: 'texto', req: true, max: 120 }, descripcion: { t: 'texto', max: 200 }, unidad_medida: { t: 'texto', req: true, max: 20 }, stock_actual: { t: 'numero', min: 0, def: 0 }, stock_minimo: { t: 'numero', min: 0, def: 0 }, stock_maximo: { t: 'numero', min: 0, def: 0 }, costo_unitario: { t: 'numero', req: true, min: 0 }, caducidad: { t: 'fecha' }, id_proveedor: { t: 'entero', min: 1 } };
  r.get('/insumos', async (req, res) => res.json({ insumos: await db.query('SELECT i.*, pv.nombre AS proveedor FROM INSUMOS i LEFT JOIN PROVEEDORES pv ON pv.id = i.id_proveedor ORDER BY i.nombre') }));
  r.post('/insumos', async (req, res) => {
    const b = validar(req.body, INS);
    const x = await db.run('INSERT INTO INSUMOS (nombre, descripcion, unidad_medida, stock_actual, stock_minimo, stock_maximo, costo_unitario, caducidad, id_proveedor) VALUES (?,?,?,?,?,?,?,?,?)', [b.nombre, b.descripcion ?? null, b.unidad_medida, b.stock_actual, b.stock_minimo, b.stock_maximo, b.costo_unitario, b.caducidad ?? null, b.id_proveedor ?? null]);
    res.json({ id: x.insertId, alertas: await evaluarAlertas(db, { idInsumo: x.insertId }) }, 201);
  });
  r.put('/insumos/:id', async (req, res) => {
    const b = validar(req.body, INS), id = Number(req.params.id);
    if (!(await db.run('UPDATE INSUMOS SET nombre=?, descripcion=?, unidad_medida=?, stock_actual=?, stock_minimo=?, stock_maximo=?, costo_unitario=?, caducidad=?, id_proveedor=? WHERE id=?', [b.nombre, b.descripcion ?? null, b.unidad_medida, b.stock_actual, b.stock_minimo, b.stock_maximo, b.costo_unitario, b.caducidad ?? null, b.id_proveedor ?? null, id])).filas) throw noEncontrado();
    res.json({ alertas: await evaluarAlertas(db, { idInsumo: id }) });
  });
  r.delete('/insumos/:id', async (req, res) => {
    try { if (!(await db.run('DELETE FROM INSUMOS WHERE id = ?', [Number(req.params.id)])).filas) throw noEncontrado(); }
    catch (e) { if (esErrorFk(e)) throw conflicto('El insumo se usa en recetas o compras y no se puede eliminar'); throw e; }
    ok(res);
  });

  // ----- Proveedores -----
  const PROV = { nombre: { t: 'texto', req: true, max: 120 }, razon_social: { t: 'texto', max: 150 }, rfc: { t: 'texto', min: 12, max: 13 }, direccion: { t: 'texto', max: 200 }, correo: { t: 'email' }, telefono: { t: 'telefono' } };
  const provVals = (b) => [b.nombre, b.razon_social ?? null, b.rfc?.toUpperCase() ?? null, b.direccion ?? null, b.correo ?? null, b.telefono ?? null];
  r.get('/proveedores', async (req, res) => res.json({ proveedores: await db.query('SELECT * FROM PROVEEDORES ORDER BY nombre') }));
  r.post('/proveedores', async (req, res) => res.json({ id: (await db.run('INSERT INTO PROVEEDORES (nombre, razon_social, rfc, direccion, correo, telefono) VALUES (?,?,?,?,?,?)', provVals(validar(req.body, PROV)))).insertId }, 201));
  r.put('/proveedores/:id', async (req, res) => { if (!(await db.run('UPDATE PROVEEDORES SET nombre=?, razon_social=?, rfc=?, direccion=?, correo=?, telefono=? WHERE id=?', [...provVals(validar(req.body, PROV)), Number(req.params.id)])).filas) throw noEncontrado(); ok(res); });
  r.delete('/proveedores/:id', async (req, res) => {
    try { if (!(await db.run('DELETE FROM PROVEEDORES WHERE id = ?', [Number(req.params.id)])).filas) throw noEncontrado(); }
    catch (e) { if (esErrorFk(e)) throw conflicto('El proveedor tiene insumos o compras ligados'); throw e; }
    ok(res);
  });

  // ----- Compras de insumos -----
  r.get('/compras', async (req, res) => res.json({ compras: await db.query('SELECT c.id, c.fecha, c.total, c.estado, pv.nombre AS proveedor FROM COMPRAS c JOIN PROVEEDORES pv ON pv.id = c.id_proveedor ORDER BY c.id DESC LIMIT 100') }));
  r.get('/compras/:id', async (req, res) => {
    const c = await db.one('SELECT c.*, pv.nombre AS proveedor FROM COMPRAS c JOIN PROVEEDORES pv ON pv.id = c.id_proveedor WHERE c.id = ?', [Number(req.params.id)]);
    if (!c) throw noEncontrado();
    c.items = await db.query('SELECT d.id_insumo, i.nombre, i.unidad_medida, d.cantidad, d.costo_unitario FROM DETALLE_COMPRAS d JOIN INSUMOS i ON i.id = d.id_insumo WHERE d.id_compra = ?', [c.id]);
    res.json({ compra: c });
  });
  r.post('/compras', async (req, res) => {
    const b = validar(req.body, { id_proveedor: { t: 'entero', req: true, min: 1 } });
    const items = (Array.isArray(req.body.items) ? req.body.items : []).slice(0, 60).map((i) => validar(i, { id_insumo: { t: 'entero', req: true, min: 1 }, cantidad: { t: 'numero', req: true, min: 0.01 }, costo_unitario: { t: 'numero', req: true, min: 0 } }));
    if (!items.length) throw noProcesable('Agrega al menos un insumo');
    const total = redondear(items.reduce((a, i) => a + i.cantidad * i.costo_unitario, 0));
    const id = await db.tx(async (t) => {
      const c = await t.run("INSERT INTO COMPRAS (id_proveedor, id_usuario, fecha, total, estado) VALUES (?,?,?,?,'pendiente')", [b.id_proveedor, req.usuario.id, aFechaBd(), total]);
      for (const i of items) await t.run('INSERT INTO DETALLE_COMPRAS (id_compra, id_insumo, cantidad, costo_unitario) VALUES (?,?,?,?)', [c.insertId, i.id_insumo, i.cantidad, i.costo_unitario]);
      return c.insertId;
    }).catch((e) => { if (esErrorFk(e)) throw noProcesable('Proveedor o insumo no válido'); throw e; });
    res.json({ id, total }, 201);
  });
  r.put('/compras/:id/recibir', async (req, res) => { // entra al inventario de insumos
    const id = Number(req.params.id);
    const items = await db.query('SELECT d.id_insumo, d.cantidad, d.costo_unitario FROM DETALLE_COMPRAS d JOIN COMPRAS c ON c.id = d.id_compra WHERE c.id = ? AND c.estado = ?', [id, 'pendiente']);
    if (!items.length) throw conflicto('La compra no existe o ya fue recibida');
    await db.tx(async (t) => { for (const i of items) await t.run('UPDATE INSUMOS SET stock_actual = stock_actual + ?, costo_unitario = ? WHERE id = ?', [i.cantidad, i.costo_unitario, i.id_insumo]); await t.run("UPDATE COMPRAS SET estado = 'recibida' WHERE id = ?", [id]); });
    for (const i of items) await evaluarAlertas(db, { idInsumo: i.id_insumo });
    ok(res);
  });
  r.post('/compras/:id/devolver', async (req, res) => {
    const b = validar(req.body, { id_insumo: { t: 'entero', req: true, min: 1 }, cantidad: { t: 'numero', req: true, min: 0.01 }, motivo: { t: 'texto', max: 255 } });
    const id = Number(req.params.id);
    const d = await db.one("SELECT d.cantidad - COALESCE((SELECT SUM(x.cantidad) FROM DEVOLUCIONES_COMPRA x WHERE x.id_compra = d.id_compra AND x.id_insumo = d.id_insumo),0) AS disponible FROM DETALLE_COMPRAS d JOIN COMPRAS c ON c.id = d.id_compra WHERE d.id_compra = ? AND d.id_insumo = ? AND c.estado = 'recibida'", [id, b.id_insumo]);
    if (!d || b.cantidad > d.disponible) throw conflicto('Cantidad mayor a lo recibido en esa compra');
    await db.tx(async (t) => { await t.run('INSERT INTO DEVOLUCIONES_COMPRA (id_compra, id_insumo, cantidad, motivo, fecha) VALUES (?,?,?,?,?)', [id, b.id_insumo, b.cantidad, b.motivo ?? null, aFechaBd()]); await t.run('UPDATE INSUMOS SET stock_actual = stock_actual - ? WHERE id = ? AND stock_actual >= ?', [b.cantidad, b.id_insumo, b.cantidad]); });
    await evaluarAlertas(db, { idInsumo: b.id_insumo }); ok(res);
  });

  // ----- Pedidos, empaque, envíos y entregas -----
  r.get('/pedidos', async (req, res) => {
    const w = [], p = [];
    if (ESTADOS_PEDIDO.includes(req.query.estado)) { w.push('pe.estado = ?'); p.push(req.query.estado); }
    const filas = await db.query(`SELECT v.id AS id_venta, pe.id AS id_pedido, c.folio, v.fecha, v.total, pe.estado, pe.tipo_entrega, pe.fecha_entrega_programada, u.nombre AS cliente, e.num_guia, e.estado AS estado_envio, em.estado AS estado_empaque FROM VENTAS v JOIN PEDIDOS pe ON pe.id = v.id_pedido JOIN COMPROBANTES c ON c.id_venta = v.id JOIN CLIENTES cl ON cl.id = v.id_cliente JOIN USUARIOS u ON u.id = cl.id_usuario LEFT JOIN ENVIOS e ON e.id_venta = v.id LEFT JOIN EMPAQUETADOS em ON em.id_venta = v.id ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY pe.fecha_entrega_programada LIMIT 200`, p);
    res.json({ pedidos: filas });
  });
  r.get('/pedidos/:id', async (req, res) => { const d = await detalleVenta(db, Number(req.params.id)); if (!d) throw noEncontrado(); res.json({ pedido: d }); });
  r.get('/pedidos/:id/ticket.pdf', async (req, res) => { const d = await detalleVenta(db, Number(req.params.id)); if (!d) throw noEncontrado(); res.enviar(pdfDeVenta(config, d), 'application/pdf', 200, { 'Content-Disposition': `inline; filename="${d.folio}.pdf"` }); });
  r.put('/pedidos/:id/estado', async (req, res) => {
    const b = validar(req.body, { estado: { t: 'enum', valores: ESTADOS_PEDIDO, req: true } });
    const v = await db.one('SELECT v.id, pe.id AS id_pedido, pe.estado FROM VENTAS v JOIN PEDIDOS pe ON pe.id = v.id_pedido WHERE v.id = ?', [Number(req.params.id)]);
    if (!v) throw noEncontrado();
    if (['cancelado', 'entregado'].includes(v.estado)) throw conflicto('El pedido ya está cerrado');
    if (b.estado === 'cancelado') return res.json(await cancelarPedido({ db, config }, v.id_pedido, { forzar: true }));
    await db.run('UPDATE PEDIDOS SET estado = ? WHERE id = ?', [b.estado, v.id_pedido]);
    if (b.estado === 'pagado') await db.run("UPDATE PAGOS SET estado = 'aprobado' WHERE id_pedido = ? AND estado = 'pendiente'", [v.id_pedido]);
    await bitacora(req, 'pedido_estado', `#${v.id} → ${b.estado}`); ok(res);
  });
  r.put('/pedidos/:id/empaque', async (req, res) => {
    const b = validar(req.body, { tipo_caja: { t: 'texto', req: true, max: 40 }, notas: { t: 'texto', max: 200 }, estado: { t: 'enum', valores: ['pendiente', 'empacado'], def: 'pendiente' } });
    const id = Number(req.params.id);
    if (!(await db.one('SELECT id FROM VENTAS WHERE id = ?', [id]))) throw noEncontrado();
    const ya = await db.one('SELECT id FROM EMPAQUETADOS WHERE id_venta = ?', [id]);
    if (ya) await db.run('UPDATE EMPAQUETADOS SET tipo_caja=?, notas=?, estado=? WHERE id=?', [b.tipo_caja, b.notas ?? null, b.estado, ya.id]);
    else await db.run('INSERT INTO EMPAQUETADOS (id_venta, tipo_caja, notas, estado, fecha) VALUES (?,?,?,?,?)', [id, b.tipo_caja, b.notas ?? null, b.estado, aFechaBd()]);
    ok(res);
  });
  r.post('/pedidos/:id/reenviar-comprobante', async (req, res) => res.json(await enviarComprobante({ db, config, correo }, Number(req.params.id))));
  r.put('/envios/:idVenta', async (req, res) => { // logística: repartidor, estado y fechas
    const b = validar(req.body, { repartidor: { t: 'texto', max: 100 }, estado: { t: 'enum', valores: ['preparando', 'en_ruta', 'fallido'], req: true } });
    const e = await db.one('SELECT e.id FROM ENVIOS e WHERE e.id_venta = ?', [Number(req.params.idVenta)]);
    if (!e) throw noEncontrado('Este pedido no tiene envío a domicilio');
    await db.run('UPDATE ENVIOS SET repartidor = ?, estado = ?, fecha_envio = CASE WHEN ? = ? THEN ? ELSE fecha_envio END WHERE id = ?', [b.repartidor ?? null, b.estado, b.estado, 'en_ruta', aFechaBd(), e.id]);
    if (b.estado === 'en_ruta') await db.run("UPDATE PEDIDOS SET estado = 'enviado' WHERE id = (SELECT id_pedido FROM VENTAS WHERE id = ?) AND estado IN ('pagado','pendiente','en_preparacion','listo')", [Number(req.params.idVenta)]);
    ok(res);
  });
  r.post('/envios/:idVenta/entregado', async (req, res) => { // validación de entrega con evidencia
    const b = validar(req.body, { evidencia: { t: 'texto', max: 255 } });
    const idVenta = Number(req.params.idVenta);
    const v = await db.one('SELECT v.id, pe.id AS id_pedido, pe.tipo_entrega, e.id AS id_envio FROM VENTAS v JOIN PEDIDOS pe ON pe.id = v.id_pedido LEFT JOIN ENVIOS e ON e.id_venta = v.id WHERE v.id = ?', [idVenta]);
    if (!v) throw noEncontrado();
    const f = aFechaBd();
    await db.tx(async (t) => {
      if (v.id_envio) {
        const ya = await t.one('SELECT id FROM VALIDACION_ENTREGA WHERE id_envio = ?', [v.id_envio]);
        if (ya) await t.run("UPDATE VALIDACION_ENTREGA SET fecha_entrega_real=?, evidencia=?, estado='entregado' WHERE id=?", [f, b.evidencia ?? null, ya.id]);
        else await t.run("INSERT INTO VALIDACION_ENTREGA (id_envio, fecha_entrega_real, evidencia, estado) VALUES (?,?,?,'entregado')", [v.id_envio, f, b.evidencia ?? null]);
        await t.run("UPDATE ENVIOS SET estado = 'entregado' WHERE id = ?", [v.id_envio]);
      }
      await t.run("UPDATE PEDIDOS SET estado = 'entregado' WHERE id = ?", [v.id_pedido]);
      await t.run("UPDATE PAGOS SET estado = 'aprobado' WHERE id_pedido = ? AND estado = 'pendiente'", [v.id_pedido]);
    });
    ok(res);
  });

  // ----- Devoluciones y garantías -----
  r.get('/devoluciones', async (req, res) => res.json({
    devoluciones: await db.query('SELECT d.id, c.folio, p.nombre AS producto, d.cantidad, d.motivo, d.fecha, d.estado FROM DEVOLUCIONES_VENTA d JOIN COMPROBANTES c ON c.id_venta = d.id_venta JOIN PRODUCTOS p ON p.id = d.id_producto ORDER BY d.id DESC LIMIT 100'),
    garantias: await db.query('SELECT g.id, c.folio, p.nombre AS producto, g.motivo, g.fecha_solicitud AS fecha, g.estado, g.resolucion FROM GARANTIAS g JOIN COMPROBANTES c ON c.id_venta = g.id_venta JOIN PRODUCTOS p ON p.id = g.id_producto ORDER BY g.id DESC LIMIT 100'),
  }));
  r.put('/devoluciones/:id', async (req, res) => {
    const b = validar(req.body, { estado: { t: 'enum', valores: ['aprobada', 'rechazada', 'completada'], req: true } });
    if (!(await db.run('UPDATE DEVOLUCIONES_VENTA SET estado = ? WHERE id = ?', [b.estado, Number(req.params.id)])).filas) throw noEncontrado(); ok(res);
  });
  r.put('/garantias/:id', async (req, res) => {
    const b = validar(req.body, { estado: { t: 'enum', valores: ['abierta', 'resuelta', 'rechazada'], req: true }, resolucion: { t: 'texto', max: 255 } });
    if (!(await db.run('UPDATE GARANTIAS SET estado = ?, resolucion = ? WHERE id = ?', [b.estado, b.resolucion ?? null, Number(req.params.id)])).filas) throw noEncontrado(); ok(res);
  });

  // ----- Contacto -----
  r.get('/mensajes', async (req, res) => res.json({ mensajes: await db.query('SELECT * FROM MENSAJES_CONTACTO ORDER BY leido, id DESC LIMIT 100') }));
  r.put('/mensajes/:id/leido', async (req, res) => { await db.run('UPDATE MENSAJES_CONTACTO SET leido = 1 WHERE id = ?', [Number(req.params.id)]); ok(res); });

  // ----- Reportes (solo ADMIN) -----
  const rep = solo;
  const rango = (q) => { const hasta = /^\d{4}-\d{2}-\d{2}$/.test(q.hasta) ? q.hasta : soloFecha(); const desde = /^\d{4}-\d{2}-\d{2}$/.test(q.desde) ? q.desde : hasta.slice(0, 8) + '01'; return [desde, hasta + ' 23:59:59.999']; };
  const salida = (req, res, nombre, filas, extra = {}) => req.query.formato === 'csv' ? res.enviar(csv(filas), 'text/csv; charset=utf-8', 200, { 'Content-Disposition': `attachment; filename="${nombre}.csv"` }) : res.json({ filas, ...extra });
  rep.get('/reportes/ventas', async (req, res) => {
    const [d, h] = rango(req.query);
    const filas = await db.query("SELECT SUBSTR(v.fecha,1,10) AS dia, COUNT(*) AS pedidos, SUM(v.total) AS total FROM VENTAS v JOIN PEDIDOS pe ON pe.id = v.id_pedido WHERE v.fecha >= ? AND v.fecha <= ? AND pe.estado <> 'cancelado' GROUP BY SUBSTR(v.fecha,1,10) ORDER BY dia", [d, h]);
    const top = await db.query("SELECT p.nombre AS producto, SUM(dv.cantidad) AS unidades, SUM(dv.cantidad * dv.precio_unitario) AS ingresos FROM DETALLE_VENTAS dv JOIN VENTAS v ON v.id = dv.id_venta JOIN PEDIDOS pe ON pe.id = v.id_pedido JOIN PRODUCTOS p ON p.id = dv.id_producto WHERE v.fecha >= ? AND v.fecha <= ? AND pe.estado <> 'cancelado' GROUP BY p.id, p.nombre ORDER BY ingresos DESC LIMIT 10", [d, h]);
    const total = filas.reduce((a, f) => a + f.total, 0), n = filas.reduce((a, f) => a + f.pedidos, 0);
    salida(req, res, 'ventas', filas, { top_productos: top, total: redondear(total), pedidos: n, ticket_promedio: n ? redondear(total / n) : 0 });
  });
  rep.get('/reportes/compras', async (req, res) => {
    const [d, h] = rango(req.query);
    salida(req, res, 'compras', await db.query("SELECT c.id, SUBSTR(c.fecha,1,10) AS fecha, pv.nombre AS proveedor, c.estado, c.total FROM COMPRAS c JOIN PROVEEDORES pv ON pv.id = c.id_proveedor WHERE c.fecha >= ? AND c.fecha <= ? ORDER BY c.id", [d, h]));
  });
  rep.get('/reportes/inventario', async (req, res) => {
    const prod = await db.query('SELECT p.nombre, s.stock_actual, s.stock_minimo, s.stock_maximo, p.costo, s.stock_actual * p.costo AS valor FROM PRODUCTOS p JOIN STOCK s ON s.id_producto = p.id WHERE p.activo = 1 ORDER BY p.nombre');
    salida(req, res, 'inventario', prod, { valor_total: redondear(prod.reduce((a, f) => a + f.valor, 0)) });
  });

  // ----- Usuarios, bitácora y fondo (solo ADMIN) -----
  solo.get('/usuarios', async (req, res) => res.json({ usuarios: await db.query('SELECT u.id, u.nombre, u.correo, u.telefono, u.estado, u.fecha_registro, r.nombre_rol AS rol FROM USUARIOS u JOIN ROLES r ON r.id = u.id_rol ORDER BY u.id DESC LIMIT 200') }));
  solo.post('/usuarios', async (req, res) => { // alta de personal (admin / repostero)
    const b = validar(req.body, { nombre: { t: 'texto', req: true, min: 2, max: 100 }, correo: { t: 'email', req: true }, password: { t: 'password', req: true }, rol: { t: 'enum', valores: ['ADMIN', 'REPOSTERO'], req: true } });
    const rol = await db.one('SELECT id FROM ROLES WHERE nombre_rol = ?', [b.rol]);
    try { const x = await db.run("INSERT INTO USUARIOS (nombre, correo, password_hash, id_rol, estado, fecha_registro) VALUES (?,?,?,?,'activo',?)", [b.nombre, b.correo, await hashPassword(b.password), rol.id, aFechaBd()]); await bitacora(req, 'usuario_creado', `${b.correo} ${b.rol}`); res.json({ id: x.insertId }, 201); }
    catch (e) { if (esDuplicado(e)) throw conflicto('Ese correo ya existe'); throw e; }
  });
  solo.put('/usuarios/:id', async (req, res) => {
    const b = validar(req.body, { rol: { t: 'enum', valores: ['ADMIN', 'REPOSTERO', 'CLIENTE'] }, estado: { t: 'enum', valores: ['activo', 'suspendido'] } });
    const id = Number(req.params.id);
    if (id === req.usuario.id) throw prohibido('No puedes cambiar tu propio rol o estado');
    if (b.rol) await db.run('UPDATE USUARIOS SET id_rol = (SELECT id FROM ROLES WHERE nombre_rol = ?) WHERE id = ?', [b.rol, id]);
    if (b.estado) await db.run('UPDATE USUARIOS SET estado = ? WHERE id = ?', [b.estado, id]);
    await bitacora(req, 'usuario_editado', `#${id} ${b.rol ?? ''} ${b.estado ?? ''}`); ok(res);
  });
  solo.get('/bitacora', async (req, res) => res.json({ eventos: await db.query('SELECT b.id, b.evento, b.id_usuario, b.ip_hash, b.detalle, b.fecha FROM BITACORA_SEGURIDAD b ORDER BY b.id DESC LIMIT 200') }));
  solo.put('/fondo', async (req, res) => { // personalización de colores / eslogan (servicio Fondo)
    const b = validar(req.body, { color_primario: { t: 'texto', max: 7 }, color_fondo: { t: 'texto', max: 7 }, tienda_eslogan: { t: 'texto', max: 120 } });
    for (const [k, v] of Object.entries(b)) {
      if (k.startsWith('color') && !/^#[0-9a-fA-F]{6}$/.test(v)) throw noProcesable('Color no válido', { errores: { [k]: 'usa formato #RRGGBB' } });
      if ((await db.run('UPDATE CONFIG_FONDO SET valor = ? WHERE clave = ?', [v, k])).filas === 0) await db.run('INSERT INTO CONFIG_FONDO (clave, valor) VALUES (?,?)', [k, v]);
    }
    ok(res);
  });
  return [personal, solo];
}
