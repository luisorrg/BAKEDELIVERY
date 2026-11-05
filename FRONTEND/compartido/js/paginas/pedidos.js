import '../base.js';
import { api, usuarioActual } from '../api.js';
import { h, dinero, fechaHora, ESTADOS, insignia, colorEstado } from '../util.js';
const u = await usuarioActual();
if (!u || u.rol !== 'CLIENTE') location.replace('/login?volver=/pedidos');
const lista = document.getElementById('lista');
const { pedidos } = await api.get('/mis-pedidos');
lista.replaceChildren(pedidos.length ? h('div', { class: 'tabla-caja' }, h('table', null, h('thead', null, h('tr', null, ['Folio', 'Fecha', 'Entrega', 'Estado', 'Total', ''].map((t, i) => h('th', { class: i === 4 ? 'num' : '' }, t)))),
  h('tbody', null, pedidos.map((p) => h('tr', null, h('td', null, p.folio), h('td', null, fechaHora(p.fecha)), h('td', null, fechaHora(p.fecha_entrega_programada)), h('td', null, insignia(ESTADOS[p.estado] || p.estado, colorEstado(p.estado))), h('td', { class: 'num' }, dinero(p.total)), h('td', null, h('a', { class: 'btn btn-chico btn-secundario', href: `/pedido?id=${p.id_venta}` }, 'Ver')))))))
  : h('div', { class: 'estado-vacio' }, h('p', null, 'Todavía no tienes pedidos.'), h('a', { class: 'btn btn-primario', href: '/catalogo' }, 'Hacer mi primer pedido')));
