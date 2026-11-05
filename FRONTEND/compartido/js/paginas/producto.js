import '../base.js';
import { api, usuarioActual, textoPrimeraEntrega } from '../api.js';
import { h, param, dinero, estrellas, rutaImagen, textoPorciones, toast, formulario, campo, fecha } from '../util.js';

const id = Number(param('id'));
const caja = document.getElementById('detalle');
let p;
try { p = (await api.get(`/productos/${id}`)).producto; }
catch { location.replace('/404'); }
document.title = `${p.nombre} · BakeDelivery`;
document.querySelector('meta[name=description]').content = `${p.nombre}: ${(p.descripcion || '').slice(0, 140)}`;
document.getElementById('miga').textContent = p.nombre;

const form = h('form', { novalidate: true });
const cantidad = h('input', { id: 'cantidad', name: 'cantidad', type: 'number', min: 1, max: 20, value: 1, required: true });
if (p.es_personalizable) form.append(h('fieldset', { class: 'campo' }, h('legend', { class: 'etiqueta-campo' }, 'Adáptalo a tu ocasión'),
  campo({ nombre: 'mensaje_pastel', etiqueta: 'Mensaje en el pastel', maxlength: 100, ayuda: 'Ej. “Feliz cumpleaños Ana”' }), campo({ nombre: 'relleno', etiqueta: 'Relleno', maxlength: 80 }), campo({ nombre: 'cobertura', etiqueta: 'Cobertura', maxlength: 80 }),
  campo({ nombre: 'decoracion', etiqueta: 'Decoración', tipo: 'textarea', maxlength: 500 }), campo({ nombre: 'notas_alergias', etiqueta: 'Alergias o notas', maxlength: 255, ayuda: 'Cuéntanos si hay alguna alergia.' })));
form.append(h('div', { class: 'campo' }, h('label', { for: 'cantidad' }, 'Cantidad'), cantidad, h('div', { class: 'error', id: 'err-cantidad', role: 'alert' })),
  h('button', { class: 'btn btn-primario btn-grande', type: 'submit', disabled: !p.disponible }, p.disponible ? 'Agregar al carrito' : 'Agotado'));
formulario(form, async (d) => {
  if (!(await usuarioActual())) { location.href = `/login?volver=${encodeURIComponent(location.pathname + location.search)}`; return; }
  const personalizacion = p.es_personalizable ? Object.fromEntries(['mensaje_pastel', 'relleno', 'cobertura', 'decoracion', 'notas_alergias'].map((k) => [k, d[k]]).filter(([, v]) => v)) : undefined;
  const r = await api.post('/carrito/items', { id_producto: p.id, cantidad: Number(d.cantidad), personalizacion });
  document.dispatchEvent(new CustomEvent('bd:carrito', { detail: r.lineas.reduce((a, l) => a + l.cantidad, 0) }));
  toast('Agregado al carrito', 'ok');
});
caja.replaceChildren(
  h('div', { class: 'detalle-foto' }, h('img', { class: 'img-detalle', src: rutaImagen(p.imagen_url), alt: p.nombre, width: 1200, height: 1500 }), p.disponible ? h('span', { class: 'fecha-tag' }, `Si pides hoy, desde ${await textoPrimeraEntrega()}`) : null),
  h('div', null, h('h1', null, p.nombre), h('p', { class: 'meta' }, [p.categoria, p.sabor, textoPorciones(p.porciones)].filter(Boolean).join(' · ')),
    p.calificacion ? h('p', { class: 'estrellas' }, estrellas(p.calificacion), ` (${p.num_resenas} reseñas)`) : null,
    h('p', { class: 'precio' }, p.descuento ? h('span', { class: 'tachado' }, dinero(p.precio)) : null, dinero(p.precio_final), p.descuento ? h('span', { class: 'insignia' }, `-${Math.round(p.descuento)}%`) : null),
    h('p', null, p.descripcion),
    h('p', { class: 'meta' }, 'Precio de ejemplo. Se encarga con 24 h de anticipación como mínimo.'), form));

const { resenas } = await api.get(`/productos/${id}/resenas`);
document.getElementById('resenas').replaceChildren(...(resenas.length ? resenas.map((r) => h('article', { class: 'tarjeta' }, h('p', { class: 'estrellas' }, estrellas(r.calificacion)), r.comentario ? h('p', null, r.comentario) : null, h('p', { class: 'meta' }, `${r.nombre} · ${fecha(r.fecha)}`))) : [h('p', { class: 'meta' }, 'Aún no hay reseñas. Los clientes que compran este producto pueden dejar la primera.')]));
const u = await usuarioActual();
if (u?.rol === 'CLIENTE') {
  const f = h('form', { novalidate: true, class: 'tarjeta' }, h('h3', null, 'Deja tu reseña'), campo({ nombre: 'calificacion', etiqueta: 'Calificación (1 a 5)', tipo: 'number', min: 1, max: 5, requerido: true }), campo({ nombre: 'comentario', etiqueta: 'Comentario', tipo: 'textarea', maxlength: 1000 }), h('button', { class: 'btn btn-secundario', type: 'submit' }, 'Publicar reseña'));
  formulario(f, async (d) => { await api.post(`/productos/${id}/resenas`, { calificacion: Number(d.calificacion), comentario: d.comentario }); toast('¡Gracias por tu reseña!', 'ok'); setTimeout(() => location.reload(), 800); });
  document.getElementById('form-resena-caja').append(f);
}
