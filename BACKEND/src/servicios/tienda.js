// Lógica de negocio compartida: catálogo, inventario/alertas/ofertas, carrito -> pedido -> pago -> venta -> ticket.
import { aFechaBd, deFechaBd, sumarHoras, soloFecha, redondear, conflicto, noEncontrado, noProcesable, prohibido, ErrorHttp, marcadores } from '../lib/util.js';
import { validarExpiracion, validarCvv } from '../lib/tarjeta.js';
import { autorizarTarjeta } from '../lib/pasarela.js';
import { crearPdf } from '../lib/pdf.js';
import { plantillaCorreo } from '../lib/correo.js';
import { esc } from '../lib/util.js';
import { randomBytes } from 'node:crypto';

export const dinero = (n) => '$' + Number(n).toFixed(2);

// ---------- Catálogo ----------
const SQL_PROMO = `(SELECT MAX(pr.porcentaje_descuento) FROM PROMOCIONES pr WHERE pr.id_producto = p.id AND pr.activa = 1 AND pr.fecha_inicio <= ? AND pr.fecha_fin >= ?)`;
const SQL_PRODUCTO = `SELECT p.id, p.nombre, p.descripcion, p.sabor, p.porciones, p.caducidad, p.precio, p.es_personalizable, p.activo, p.imagen_url,
  p.costo, p.id_categoria, c.nombre AS categoria, COALESCE(s.stock_actual,0) AS stock, COALESCE(s.stock_minimo,0) AS stock_minimo, COALESCE(s.stock_maximo,0) AS stock_maximo,
  COALESCE(${SQL_PROMO},0) AS descuento,
  (SELECT AVG(r.calificacion) FROM RESENAS r WHERE r.id_producto = p.id) AS calificacion,
  (SELECT COUNT(*) FROM RESENAS r WHERE r.id_producto = p.id) AS num_resenas
  FROM PRODUCTOS p JOIN CATEGORIAS c ON c.id = p.id_categoria LEFT JOIN STOCK s ON s.id_producto = p.id`;

export function aProducto(f, admin = false) {
  if (!f) return null;
  const precioFinal = redondear(f.precio * (1 - (f.descuento || 0) / 100));
  const o = { id: f.id, nombre: f.nombre, descripcion: f.descripcion, sabor: f.sabor, porciones: f.porciones, categoria: f.categoria, id_categoria: f.id_categoria, precio: f.precio, descuento: f.descuento || 0, precio_final: precioFinal, es_personalizable: !!f.es_personalizable, imagen_url: f.imagen_url, disponible: f.stock > 0, stock_bajo: f.stock > 0 && f.stock <= f.stock_minimo, calificacion: f.calificacion ? Math.round(f.calificacion * 10) / 10 : null, num_resenas: f.num_resenas };
  if (admin) Object.assign(o, { costo: f.costo, stock: f.stock, stock_minimo: f.stock_minimo, stock_maximo: f.stock_maximo, activo: !!f.activo, caducidad: f.caducidad });
  return o;
}

export async function listarProductos(db, { categoria, q, orden, limite = 50, desplazamiento = 0, admin = false, soloOfertas = false } = {}) {
  const hoy = soloFecha();
  const w = [], p = [hoy, hoy];
  if (!admin) w.push('p.activo = 1');
  if (categoria) { w.push('p.id_categoria = ?'); p.push(Number(categoria)); }
  if (q) { w.push('(p.nombre LIKE ? OR p.descripcion LIKE ? OR p.sabor LIKE ?)'); p.push(...Array(3).fill(`%${String(q).slice(0, 60)}%`)); }
  const ord = { precio_asc: 'p.precio ASC', precio_desc: 'p.precio DESC', nombre: 'p.nombre ASC' }[orden] || 'p.id DESC';
  let sql = SQL_PRODUCTO + (w.length ? ' WHERE ' + w.join(' AND ') : '');
  let filas = await db.query(sql + ` ORDER BY ${ord}`, p);
  if (soloOfertas) filas = filas.filter((f) => f.descuento > 0);
  const total = filas.length;
  return { total, productos: filas.slice(desplazamiento, desplazamiento + limite).map((f) => aProducto(f, admin)) };
}
export async function obtenerProducto(db, id, admin = false) {
  const hoy = soloFecha();
  const f = await db.one(SQL_PRODUCTO + ' WHERE p.id = ?' + (admin ? '' : ' AND p.activo = 1'), [hoy, hoy, id]);
  return aProducto(f, admin);
}

// ---------- Inventario: alertas y ofertas (servicios AlertaStockMinimo y StockMaxOfertas) ----------
/** 20 % si el stock llegó al máximo, 10 % si pasó el 80 % del máximo. */
export function descuentoSugerido(stock, maximo) {
  if (!(maximo > 0)) return 0;
  return stock >= maximo ? 20 : stock >= maximo * 0.8 ? 10 : 0;
}
async function alerta(db, tipo, col, id, mensaje) {
  const ya = await db.one(`SELECT id FROM ALERTAS_INVENTARIO WHERE tipo = ? AND ${col} = ? AND atendida = 0`, [tipo, id]);
  if (!ya) await db.run(`INSERT INTO ALERTAS_INVENTARIO (tipo, ${col}, mensaje, fecha) VALUES (?,?,?,?)`, [tipo, id, mensaje, aFechaBd()]);
}
/** Crea alertas de mínimo/máximo y cierra las que ya no aplican. Devuelve las alertas vigentes del elemento. */
export async function evaluarAlertas(db, { idProducto, idInsumo }) {
  const [tabla, col, id] = idProducto ? ['STOCK', 'id_producto', idProducto] : ['INSUMOS', 'id_insumo', idInsumo];
  const f = await db.one(idProducto ? 'SELECT s.stock_actual, s.stock_minimo, s.stock_maximo, p.nombre FROM STOCK s JOIN PRODUCTOS p ON p.id = s.id_producto WHERE s.id_producto = ?' : 'SELECT stock_actual, stock_minimo, stock_maximo, nombre FROM INSUMOS WHERE id = ?', [id]);
  if (!f) return [];
  const out = [];
  if (f.stock_actual <= f.stock_minimo) { await alerta(db, 'MINIMO', col, id, `Stock bajo: ${f.nombre} (${f.stock_actual} ≤ mínimo ${f.stock_minimo})`); out.push('MINIMO'); }
  else await db.run(`UPDATE ALERTAS_INVENTARIO SET atendida = 1 WHERE tipo = 'MINIMO' AND ${col} = ? AND atendida = 0`, [id]);
  if (f.stock_maximo > 0 && f.stock_actual >= f.stock_maximo) { await alerta(db, 'MAXIMO', col, id, `Sobrestock: ${f.nombre} (${f.stock_actual} ≥ máximo ${f.stock_maximo}). Sugerencia: oferta del ${descuentoSugerido(f.stock_actual, f.stock_maximo)}%`); out.push('MAXIMO'); }
  else await db.run(`UPDATE ALERTAS_INVENTARIO SET atendida = 1 WHERE tipo = 'MAXIMO' AND ${col} = ? AND atendida = 0`, [id]);
  return out;
}

// ---------- Carrito ----------
export async function carritoAbierto(db, idCliente, crear = true) {
  let c = await db.one("SELECT id FROM CARRITO WHERE id_cliente = ? AND estado = 'abierto' ORDER BY id DESC", [idCliente]);
  if (!c && crear) { const r = await db.run("INSERT INTO CARRITO (id_cliente, fecha_creacion, estado) VALUES (?,?,'abierto')", [idCliente, aFechaBd()]); c = { id: r.insertId }; }
  return c;
}
export function costoEnvio(config, subtotal, tipoEntrega) {
  if (tipoEntrega !== 'DOMICILIO' || subtotal <= 0) return 0;
  return subtotal >= config.reglas.envioGratisDesde ? 0 : config.reglas.costoEnvio;
}
export async function lineasCarrito(db, idCarrito) {
  const hoy = soloFecha();
  const filas = await db.query(`SELECT d.id, d.cantidad, p.id AS id_producto, p.nombre, p.precio, p.imagen_url, p.activo, COALESCE(s.stock_actual,0) AS stock,
    COALESCE(${SQL_PROMO},0) AS descuento, pe.mensaje_pastel, pe.relleno, pe.cobertura, pe.decoracion, pe.notas_alergias
    FROM DETALLE_CARRITO d JOIN PRODUCTOS p ON p.id = d.id_producto LEFT JOIN STOCK s ON s.id_producto = p.id
    LEFT JOIN PERSONALIZACIONES pe ON pe.id_detalle_carrito = d.id WHERE d.id_carrito = ? ORDER BY d.id`, [hoy, hoy, idCarrito]);
  return filas.map((f) => ({ id: f.id, id_producto: f.id_producto, nombre: f.nombre, imagen_url: f.imagen_url, cantidad: f.cantidad, precio_unitario: redondear(f.precio * (1 - f.descuento / 100)), descuento: f.descuento, subtotal: redondear(f.cantidad * redondear(f.precio * (1 - f.descuento / 100))), disponible: !!f.activo && f.stock >= f.cantidad, stock: f.stock, personalizacion: f.mensaje_pastel || f.relleno || f.cobertura || f.decoracion || f.notas_alergias ? { mensaje_pastel: f.mensaje_pastel, relleno: f.relleno, cobertura: f.cobertura, decoracion: f.decoracion, notas_alergias: f.notas_alergias } : null }));
}
export const subtotalDe = (lineas) => redondear(lineas.reduce((a, l) => a + l.subtotal, 0));

// ---------- Pedido / pago / venta ----------
const FOLIO = (id, d = new Date()) => `BD-${soloFecha(d).replaceAll('-', '')}-${String(id).padStart(5, '0')}`;
const GUIA = () => 'BD' + randomBytes(5).toString('hex').toUpperCase();

/**
 * Convierte el carrito abierto en pedido + pago + venta (transacción atómica: o todo o nada).
 * `limite` evita probar tarjetas al azar. Devuelve {idPedido, idVenta, folio, pagado}.
 */
export async function confirmarPedido({ db, config, correo, limite }, cliente, datos) {
  const ahora = new Date();
  const entrega = new Date(datos.fecha_entrega);
  if (entrega < sumarHoras(ahora, config.reglas.horasAnticipacion)) throw noProcesable(`El pedido requiere al menos ${config.reglas.horasAnticipacion} horas de anticipación`, { errores: { fecha_entrega: `mínimo ${config.reglas.horasAnticipacion} h de anticipación` } });
  if (entrega > sumarHoras(ahora, 24 * 90)) throw noProcesable('La fecha de entrega es demasiado lejana');
  const tipoPago = await db.one('SELECT id, nombre FROM TIPOS_PAGO WHERE id = ?', [datos.id_tipo_pago]);
  if (!tipoPago) throw noProcesable('Tipo de pago no válido');
  const esTarjeta = tipoPago.nombre.toLowerCase().startsWith('tarjeta');

  let direccion = null;
  if (datos.tipo_entrega === 'DOMICILIO') {
    direccion = await db.one('SELECT id FROM DIRECCIONES WHERE id = ? AND id_cliente = ?', [datos.id_direccion, cliente.id]);
    if (!direccion) throw noProcesable('Elige una dirección de entrega válida');
  }
  let tarjeta = null;
  if (esTarjeta) {
    const espera = limite.bloqueado(`u${cliente.id_usuario}`);
    if (espera) throw new ErrorHttp(429, `Demasiados intentos de pago. Espera ${Math.ceil(espera / 60)} min.`, { reintentar_en: espera });
    tarjeta = await db.one('SELECT * FROM TARJETAS WHERE id = ? AND id_cliente = ?', [datos.id_tarjeta, cliente.id]);
    if (!tarjeta) throw noProcesable('Elige una tarjeta válida');
    if (!tarjeta.verificada) throw noProcesable('La tarjeta no está verificada');
    if (!validarExpiracion(tarjeta.mes_expiracion, tarjeta.anio_expiracion).valida) throw noProcesable('La tarjeta está vencida', { codigo: 'tarjeta_vencida' });
    if (!validarCvv(datos.cvv, tarjeta.marca)) { limite.fallo(`u${cliente.id_usuario}`); throw noProcesable('CVV inválido', { codigo: 'cvv_invalido' }); }
  }

  const carrito = await carritoAbierto(db, cliente.id, false);
  const lineas = carrito ? await lineasCarrito(db, carrito.id) : [];
  if (!lineas.length) throw noProcesable('Tu carrito está vacío');
  const sin = lineas.find((l) => !l.disponible);
  if (sin) throw conflicto(`"${sin.nombre}" ya no tiene existencias suficientes`, { id_producto: sin.id_producto });
  const subtotal = subtotalDe(lineas), envio = costoEnvio(config, subtotal, datos.tipo_entrega), total = redondear(subtotal + envio);

  let pago = { aprobada: true, codigoAutorizacion: null };
  if (esTarjeta) {
    pago = autorizarTarjeta({ marca: tarjeta.marca, ultimosDigitos: tarjeta.ultimos_digitos, monto: total, contexto: 'pago' });
    if (!pago.aprobada) { limite.fallo(`u${cliente.id_usuario}`); throw new ErrorHttp(402, pago.mensaje, { codigo: pago.codigo }); }
  }

  const res = await db.tx(async (t) => {
    const f = aFechaBd(ahora);
    const ped = await t.run(`INSERT INTO PEDIDOS (id_carrito, id_cliente, id_direccion, id_tipo_pago, id_tarjeta, tipo_entrega, fecha_pedido, fecha_entrega_programada, anticipo, costo_envio, total, estado) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [carrito.id, cliente.id, direccion?.id ?? null, tipoPago.id, tarjeta?.id ?? null, datos.tipo_entrega, f, aFechaBd(entrega), esTarjeta ? total : 0, envio, total, esTarjeta ? 'pagado' : 'pendiente']);
    const venta = await t.run('INSERT INTO VENTAS (id_pedido, id_cliente, fecha, total) VALUES (?,?,?,?)', [ped.insertId, cliente.id, f, total]);
    for (const l of lineas) {
      const dec = await t.run('UPDATE STOCK SET stock_actual = stock_actual - ? WHERE id_producto = ? AND stock_actual >= ?', [l.cantidad, l.id_producto, l.cantidad]);
      if (dec.filas !== 1) throw conflicto(`"${l.nombre}" se agotó mientras confirmabas tu pedido`);
      const dv = await t.run('INSERT INTO DETALLE_VENTAS (id_venta, id_producto, cantidad, precio_unitario) VALUES (?,?,?,?)', [venta.insertId, l.id_producto, l.cantidad, l.precio_unitario]);
      await t.run('UPDATE PERSONALIZACIONES SET id_detalle_venta = ? WHERE id_detalle_carrito = ?', [dv.insertId, l.id]);
    }
    await t.run('INSERT INTO PAGOS (id_pedido, id_tipo_pago, monto, estado, codigo_autorizacion, fecha) VALUES (?,?,?,?,?,?)', [ped.insertId, tipoPago.id, total, esTarjeta ? 'aprobado' : 'pendiente', pago.codigoAutorizacion, f]);
    const folio = FOLIO(venta.insertId, ahora);
    await t.run('INSERT INTO COMPROBANTES (id_venta, folio, fecha_emision, enviado_correo) VALUES (?,?,?,0)', [venta.insertId, folio, f]);
    if (datos.tipo_entrega === 'DOMICILIO') await t.run("INSERT INTO ENVIOS (id_venta, id_direccion, num_guia, estado, fecha_estimada_entrega) VALUES (?,?,?,'preparando',?)", [venta.insertId, direccion.id, GUIA(), aFechaBd(entrega)]);
    await t.run("UPDATE CARRITO SET estado = 'convertido' WHERE id = ?", [carrito.id]);
    return { idPedido: ped.insertId, idVenta: venta.insertId, folio };
  });
  if (esTarjeta) limite.reiniciar(`u${cliente.id_usuario}`);
  for (const l of lineas) await evaluarAlertas(db, { idProducto: l.id_producto });
  enviarComprobante({ db, config, correo }, res.idVenta).catch((e) => console.error('[comprobante]', e.message));
  return { ...res, total, pagado: esTarjeta };
}

export async function detalleVenta(db, idVenta) {
  const v = await db.one(`SELECT v.id, v.fecha, v.total, v.id_cliente, pe.id AS id_pedido, pe.estado, pe.tipo_entrega, pe.fecha_entrega_programada, pe.costo_envio, pe.anticipo, tp.nombre AS tipo_pago, c.folio, c.enviado_correo,
    u.nombre AS cliente, u.correo, u.telefono, d.calle_numero, d.colonia, d.ciudad, d.codigo_postal, d.referencias,
    e.id AS id_envio, e.num_guia, e.estado AS estado_envio, e.repartidor, e.fecha_envio, e.fecha_estimada_entrega, ve.fecha_entrega_real, ve.estado AS estado_validacion,
    em.tipo_caja, em.estado AS estado_empaque, pg.estado AS estado_pago, pg.codigo_autorizacion
    FROM VENTAS v JOIN PEDIDOS pe ON pe.id = v.id_pedido JOIN TIPOS_PAGO tp ON tp.id = pe.id_tipo_pago JOIN COMPROBANTES c ON c.id_venta = v.id
    JOIN CLIENTES cl ON cl.id = v.id_cliente JOIN USUARIOS u ON u.id = cl.id_usuario LEFT JOIN DIRECCIONES d ON d.id = pe.id_direccion
    LEFT JOIN ENVIOS e ON e.id_venta = v.id LEFT JOIN VALIDACION_ENTREGA ve ON ve.id_envio = e.id LEFT JOIN EMPAQUETADOS em ON em.id_venta = v.id
    LEFT JOIN PAGOS pg ON pg.id_pedido = pe.id WHERE v.id = ?`, [idVenta]);
  if (!v) return null;
  v.items = await db.query(`SELECT dv.id, dv.id_producto, p.nombre, dv.cantidad, dv.precio_unitario, p.imagen_url, pz.mensaje_pastel, pz.relleno, pz.cobertura, pz.decoracion, pz.notas_alergias
    FROM DETALLE_VENTAS dv JOIN PRODUCTOS p ON p.id = dv.id_producto LEFT JOIN PERSONALIZACIONES pz ON pz.id_detalle_venta = dv.id WHERE dv.id_venta = ?`, [idVenta]);
  v.subtotal = redondear(v.items.reduce((a, i) => a + i.cantidad * i.precio_unitario, 0));
  return v;
}

/** Ticket de 80 mm en PDF (servicio Generar Ticket). */
export function pdfDeVenta(config, v) {
  const L = [{ t: config.tienda.nombre, tam: 14, b: true, al: 'centro' }, { t: config.tienda.direccion, tam: 7, al: 'centro' }, { t: 'Tel. ' + config.tienda.telefono, tam: 7, al: 'centro' }, { t: '', tam: 4, linea: true },
    { t: 'Folio: ' + v.folio, b: true }, { t: 'Fecha: ' + String(v.fecha).slice(0, 16) }, { t: 'Cliente: ' + v.cliente }, { t: 'Pago: ' + v.tipo_pago }, { t: 'Entrega: ' + (v.tipo_entrega === 'DOMICILIO' ? 'A domicilio' : 'Recoger en tienda') + ' ' + String(v.fecha_entrega_programada || '').slice(0, 16) }, { t: '', tam: 4, linea: true }];
  for (const i of v.items) {
    L.push({ t: `${i.cantidad} x ${i.nombre}`.slice(0, 30), d: dinero(i.cantidad * i.precio_unitario) });
    if (i.mensaje_pastel) L.push({ t: `   "${i.mensaje_pastel}"`, tam: 7 });
  }
  L.push({ t: '', tam: 4, linea: true }, { t: 'Subtotal', d: dinero(v.subtotal) }, { t: 'Envío', d: dinero(v.costo_envio) }, { t: 'TOTAL', d: dinero(v.total), b: true, tam: 11 });
  if (v.num_guia) L.push({ t: '', tam: 4 }, { t: 'Guía de seguimiento: ' + v.num_guia, tam: 8 });
  L.push({ t: '', tam: 4 }, { t: '¡Gracias por endulzar tu día!', al: 'centro', b: true });
  return crearPdf(L);
}

export async function enviarComprobante({ db, config, correo }, idVenta) {
  const v = await detalleVenta(db, idVenta);
  if (!v) throw noEncontrado('Venta no encontrada');
  const filas = v.items.map((i) => `<tr><td>${i.cantidad} × ${esc(i.nombre)}</td><td style="text-align:right">${dinero(i.cantidad * i.precio_unitario)}</td></tr>`).join('');
  const html = plantillaCorreo(config, `Gracias por tu pedido, ${esc(v.cliente.split(' ')[0])}`, `<p>Folio <b>${esc(v.folio)}</b>. Entrega programada: ${esc(String(v.fecha_entrega_programada || '').slice(0, 16))}.</p><table width="100%">${filas}<tr><td>Envío</td><td style="text-align:right">${dinero(v.costo_envio)}</td></tr><tr><td><b>Total</b></td><td style="text-align:right"><b>${dinero(v.total)}</b></td></tr></table>${v.num_guia ? `<p>Guía de seguimiento: <b>${esc(v.num_guia)}</b></p>` : ''}`);
  const r = await correo.enviar({ para: v.correo, asunto: `Tu comprobante ${v.folio}`, html, texto: `Folio ${v.folio} — Total ${dinero(v.total)}`, adjuntos: [{ filename: `${v.folio}.pdf`, content: pdfDeVenta(config, v) }] });
  await db.run('UPDATE COMPROBANTES SET enviado_correo = ? WHERE id_venta = ?', [r.enviado ? 1 : 0, idVenta]);
  return r;
}

/** Cancela un pedido propio y devuelve las existencias. */
export async function cancelarPedido({ db, config }, idPedido, { idCliente = null, forzar = false } = {}) {
  const p = await db.one('SELECT pe.*, v.id AS id_venta FROM PEDIDOS pe JOIN VENTAS v ON v.id_pedido = pe.id WHERE pe.id = ?' + (idCliente ? ' AND pe.id_cliente = ?' : ''), idCliente ? [idPedido, idCliente] : [idPedido]);
  if (!p) throw noEncontrado('Pedido no encontrado');
  if (!['pendiente', 'pagado'].includes(p.estado)) throw conflicto('Este pedido ya no se puede cancelar');
  if (!forzar && deFechaBd(p.fecha_entrega_programada) < sumarHoras(new Date(), config.reglas.horasAnticipacion)) throw conflicto(`Solo se puede cancelar con ${config.reglas.horasAnticipacion} horas de anticipación`);
  const items = await db.query('SELECT id_producto, cantidad FROM DETALLE_VENTAS WHERE id_venta = ?', [p.id_venta]);
  await db.tx(async (t) => {
    for (const i of items) await t.run('UPDATE STOCK SET stock_actual = stock_actual + ? WHERE id_producto = ?', [i.cantidad, i.id_producto]);
    await t.run("UPDATE PEDIDOS SET estado = 'cancelado' WHERE id = ?", [p.id]);
    await t.run("UPDATE PAGOS SET estado = CASE WHEN estado = 'aprobado' THEN 'reembolsado' ELSE 'cancelado' END WHERE id_pedido = ?", [p.id]);
    await t.run("UPDATE ENVIOS SET estado = 'cancelado' WHERE id_venta = ?", [p.id_venta]);
  });
  for (const i of items) await evaluarAlertas(db, { idProducto: i.id_producto });
  return { ok: true };
}
