import '../base.js';
import { api } from '../api.js';
import { h, param } from '../util.js';

const lista = document.getElementById('lista'), conteo = document.getElementById('conteo');
const ofertas = lista.dataset.ofertas === '1';
const q = document.getElementById('q'), cat = document.getElementById('categoria'), orden = document.getElementById('orden');
if (cat) {
  const { categorias } = await api.get('/categorias');
  cat.append(...categorias.map((c) => h('option', { value: c.id }, c.nombre)));
  cat.value = param('categoria') || '';
}
if (q) q.value = param('q') || '';
let t;
const titulo = () => { if (cat) document.querySelector('main h1').textContent = cat.value ? cat.selectedOptions[0].textContent : 'Elige tu diseño'; };
async function cargar() {
  titulo();
  const p = new URLSearchParams();
  if (q?.value) p.set('q', q.value); if (cat?.value) p.set('categoria', cat.value); if (orden?.value) p.set('orden', orden.value); if (ofertas) p.set('ofertas', '1');
  try {
    const { productos, total } = await api.get('/productos?' + p);
    conteo.textContent = total ? `${total} ${total === 1 ? 'diseño' : 'diseños'}` : '';
    lista.replaceChildren(...(productos.length ? productos.map((x) => Object.assign(document.createElement('bd-producto'), { producto: x })) : [h('div', { class: 'estado-vacio' }, ofertas ? 'No hay ofertas por ahora. ¡Vuelve pronto!' : 'No encontramos productos con esos filtros.')]));
  } catch (e) { lista.replaceChildren(h('p', { class: 'aviso error' }, e.message)); }
}
for (const el of [q, cat, orden]) el?.addEventListener(el === q ? 'input' : 'change', () => { clearTimeout(t); t = setTimeout(cargar, el === q ? 300 : 0); });
cargar();
