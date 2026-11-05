import '../base.js';
import { api, textoPrimeraEntrega } from '../api.js';
import { h, vacio, rutaImagen } from '../util.js';

const lista = document.getElementById('ocasiones'), foto = document.getElementById('portada-foto'), dest = document.getElementById('destacados');
const tarjeta = (p) => { const e = document.createElement('bd-producto'); e.producto = p; return e; };
document.getElementById('primera-fecha').textContent = await textoPrimeraEntrega();
try {
  const [{ categorias }, { productos }, ofertas] = await Promise.all([api.get('/categorias'), api.get('/productos?limite=60'), api.get('/productos?ofertas=1&limite=3')]);
  const inicial = foto.querySelector('img');
  const pasos = [];
  const enlaces = categorias.map((c) => {
    const delGrupo = productos.filter((p) => p.id_categoria === c.id);
    // La foto que se ve al llegar ya es de una ocasión: se reutiliza en vez de cargarla dos veces.
    const img = delGrupo.find((p) => p.imagen_url === inicial.getAttribute('src')) ? inicial : delGrupo[0] && foto.appendChild(h('img', { src: rutaImagen(delGrupo[0].imagen_url), alt: delGrupo[0].nombre, width: 1200, height: 1500 }));
    const a = h('a', { href: `/catalogo?categoria=${c.id}`, class: img === inicial ? 'activa' : '' }, c.nombre, h('small', null, `${delGrupo.length} ${delGrupo.length === 1 ? 'diseño' : 'diseños'}`));
    const activar = () => { if (!img) return; for (const e of lista.querySelectorAll('a')) e.classList.toggle('activa', e === a); for (const i of foto.querySelectorAll('img')) i.classList.toggle('activa', i === img); };
    a.addEventListener('pointerenter', activar); a.addEventListener('focus', activar);
    pasos.push(activar);
    return h('li', null, a);
  });
  lista.replaceChildren(...enlaces);
  // Sin puntero no hay hover: una sola pasada por las ocasiones para que la foto se vea cambiar.
  if (matchMedia('(hover: none)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches) [...pasos.slice(1), pasos[0]].forEach((p, i) => setTimeout(p, 900 * (i + 1)));
  // La foto de portada no se repite justo debajo.
  const unoPorOcasion = categorias.map((c) => productos.find((p) => p.id_categoria === c.id && p.imagen_url !== inicial.getAttribute('src'))).filter(Boolean);
  vacio(dest).append(...[...unoPorOcasion, ...productos.filter((p) => !unoPorOcasion.includes(p) && p.imagen_url !== inicial.getAttribute('src'))].slice(0, 5).map(tarjeta));
  if (ofertas.productos.length >= 3) { document.getElementById('bloque-ofertas').hidden = false; document.getElementById('ofertas').append(...ofertas.productos.map(tarjeta)); }
} catch (e) { dest.replaceChildren(h('p', { class: 'aviso error' }, 'No pudimos cargar el catálogo. ' + e.message)); }
