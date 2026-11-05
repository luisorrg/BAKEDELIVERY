import '../base.js';
import { api, usuarioActual } from '../api.js';
import { h, dinero, rutaImagen, toast } from '../util.js';

const caja = document.getElementById('carrito');
const u = await usuarioActual();
if (!u) location.replace('/login?volver=/carrito');
else if (u.rol !== 'CLIENTE') caja.replaceChildren(h('p', { class: 'aviso info' }, 'El carrito es solo para cuentas de comprador.'));
else pintar(await api.get('/carrito'));

function pintar(c) {
  document.dispatchEvent(new CustomEvent('bd:carrito', { detail: c.lineas.reduce((a, l) => a + l.cantidad, 0) }));
  if (!c.lineas.length) { caja.className = ''; caja.replaceChildren(h('div', { class: 'estado-vacio' }, h('p', null, 'Tu carrito está vacío.'), h('a', { class: 'btn btn-primario', href: '/catalogo' }, 'Explorar el catálogo'))); return; }
  caja.className = 'dos-columnas';
  const accion = async (fn) => { try { pintar(await fn()); } catch (e) { toast(e.message, 'error'); } };
  caja.replaceChildren(
    h('section', { 'aria-label': 'Artículos' }, c.lineas.map((l) => h('div', { class: 'linea-carrito' },
      h('img', { src: rutaImagen(l.imagen_url), alt: '', width: 84, height: 104 }),
      h('div', null, h('strong', null, l.nombre), l.personalizacion?.mensaje_pastel ? h('div', { class: 'meta' }, `“${l.personalizacion.mensaje_pastel}”`) : null, !l.disponible ? h('div', { class: 'insignia error' }, `Solo quedan ${l.stock}`) : null,
        h('div', { class: 'cantidad' }, h('label', { class: 'solo-lectores', for: 'q' + l.id }, 'Cantidad'), h('input', { id: 'q' + l.id, type: 'number', min: 1, max: 50, value: l.cantidad, onChange: (e) => accion(() => api.put(`/carrito/items/${l.id}`, { cantidad: Number(e.target.value) })) }),
          h('button', { class: 'btn btn-chico btn-peligro', type: 'button', onClick: () => accion(() => api.del(`/carrito/items/${l.id}`)) }, 'Quitar'))),
      h('div', { class: 'precio' }, dinero(l.subtotal))))),
    h('aside', { class: 'tarjeta resumen-caja' }, h('h2', null, 'Resumen'),
      h('dl', null, h('dt', null, 'Subtotal'), h('dd', null, dinero(c.subtotal)), h('dt', null, 'Envío'), h('dd', null, 'Se calcula al elegir entrega')),
      h('p', { class: 'meta' }, `Envío gratis desde ${dinero(c.envio_gratis_desde)}.`),
      h('a', { class: 'btn btn-primario btn-grande', href: '/checkout', 'aria-disabled': c.lineas.some((l) => !l.disponible) }, 'Continuar con el pedido')));
}
