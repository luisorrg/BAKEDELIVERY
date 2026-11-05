import '../base.js';
import { api, usuarioActual } from '../api.js';
import { h, dinero, fechaHora, param, ESTADOS, insignia, colorEstado, toast, formulario, campo } from '../util.js';
const u = await usuarioActual();
if (!u || u.rol !== 'CLIENTE') location.replace('/login?volver=' + encodeURIComponent(location.pathname + location.search));
const id = Number(param('id')), caja = document.getElementById('detalle');
let p;
try { p = (await api.get(`/mis-pedidos/${id}`)).pedido; } catch { location.replace('/404'); }
document.getElementById('miga').textContent = p.folio;
const FLUJO = p.tipo_entrega === 'DOMICILIO' ? ['pagado', 'en_preparacion', 'listo', 'enviado', 'entregado'] : ['pagado', 'en_preparacion', 'listo', 'entregado'];
const idx = p.estado === 'pendiente' ? -1 : FLUJO.indexOf(p.estado);
const accion = (texto, fn, clase = 'btn-secundario') => h('button', { class: `btn btn-chico ${clase}`, type: 'button', onClick: async (e) => { e.target.disabled = true; try { await fn(); } catch (er) { toast(er.message, 'error'); e.target.disabled = false; } } }, texto);

const items = h('div', { class: 'tabla-caja' }, h('table', null, h('thead', null, h('tr', null, h('th', null, 'Producto'), h('th', { class: 'num' }, 'Cant.'), h('th', { class: 'num' }, 'Importe'))), h('tbody', null, p.items.map((i) => h('tr', null, h('td', null, i.nombre, i.mensaje_pastel ? h('div', { class: 'meta' }, `“${i.mensaje_pastel}”`) : null, i.notas_alergias ? h('div', { class: 'meta' }, `Alergias: ${i.notas_alergias}`) : null), h('td', { class: 'num' }, i.cantidad), h('td', { class: 'num' }, dinero(i.cantidad * i.precio_unitario)))))));
const cuerpo = [
  param('nuevo') ? h('div', { class: 'aviso ok', role: 'status' }, `¡Gracias por tu pedido! Te enviamos el comprobante por correo. Folio ${p.folio}.`) : null,
  h('h1', null, `Pedido ${p.folio}`),
  h('p', null, insignia(ESTADOS[p.estado] || p.estado, colorEstado(p.estado)), ' ', h('span', { class: 'meta' }, `Pago: ${p.tipo_pago} · Entrega programada: ${fechaHora(p.fecha_entrega_programada)}`)),
  p.estado === 'cancelado' ? h('p', { class: 'aviso error' }, 'Este pedido fue cancelado.') : h('ol', { class: 'seguimiento', 'aria-label': 'Seguimiento' }, FLUJO.map((k, n) => h('li', { class: n < idx ? 'hecho' : n === idx ? 'hecho actual' : '' }, ESTADOS[k]))),
  p.num_guia ? h('p', null, 'Guía: ', h('a', { href: `/seguimiento?guia=${p.num_guia}` }, p.num_guia), p.repartidor ? ` · Repartidor: ${p.repartidor}` : '') : null,
  items,
  h('div', { class: 'tarjeta resumen-caja' }, h('dl', null, h('dt', null, 'Subtotal'), h('dd', null, dinero(p.subtotal)), h('dt', null, 'Envío'), h('dd', null, dinero(p.costo_envio)), h('dt', { class: 'total' }, 'Total'), h('dd', { class: 'total' }, dinero(p.total)))),
  h('p', null, h('a', { class: 'btn btn-secundario btn-chico', href: `/api/mis-pedidos/${id}/ticket.pdf`, target: '_blank', rel: 'noopener' }, 'Ver ticket (PDF)'), ' ',
    accion('Reenviar comprobante por correo', async () => { await api.post(`/mis-pedidos/${id}/comprobante`); toast('Comprobante enviado', 'ok'); }), ' ',
    ['pendiente', 'pagado'].includes(p.estado) ? accion('Cancelar pedido', async () => { if (!confirm('¿Seguro que quieres cancelar este pedido?')) return; await api.post(`/mis-pedidos/${id}/cancelar`); location.reload(); }, 'btn-peligro') : null),
];
if (p.estado === 'entregado') {
  const sel = (n) => campo({ nombre: n, etiqueta: 'Producto', tipo: 'select', opciones: p.items.map((i) => ({ v: i.id_producto, t: i.nombre })), requerido: true });
  const fd = h('form', { class: 'tarjeta', novalidate: true }, h('h3', null, 'Solicitar devolución'), sel('id_producto'), campo({ nombre: 'cantidad', etiqueta: 'Cantidad', tipo: 'number', min: 1, valor: 1, requerido: true }), campo({ nombre: 'motivo', etiqueta: 'Motivo', maxlength: 255, requerido: true }), h('button', { class: 'btn btn-secundario', type: 'submit' }, 'Enviar solicitud'));
  formulario(fd, async (d) => { await api.post('/devoluciones', { id_venta: id, id_producto: Number(d.id_producto), cantidad: Number(d.cantidad), motivo: d.motivo }); toast('Solicitud de devolución enviada', 'ok'); fd.reset(); });
  const fg = h('form', { class: 'tarjeta', novalidate: true }, h('h3', null, 'Solicitar garantía'), sel('id_producto'), campo({ nombre: 'motivo', etiqueta: 'Describe el problema', maxlength: 255, requerido: true }), h('button', { class: 'btn btn-secundario', type: 'submit' }, 'Enviar solicitud'));
  formulario(fg, async (d) => { await api.post('/garantias', { id_venta: id, id_producto: Number(d.id_producto), motivo: d.motivo }); toast('Solicitud de garantía enviada', 'ok'); fg.reset(); });
  cuerpo.push(h('h2', null, 'Postventa'), h('p', { class: 'meta' }, 'Devoluciones y garantías tienen plazo desde la entrega (ver términos).'), h('div', { class: 'dos-columnas' }, fd, fg));
}
caja.replaceChildren(...cuerpo);
