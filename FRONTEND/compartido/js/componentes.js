// Web Components (sin Shadow DOM, para heredar base.css y respetar la CSP). Adaptados de los servicios
// "Encabezado", "Pie de página" y "Menú" del equipo.
import { h, dinero, estrellas, rutaImagen, textoPorciones } from './util.js';
import { api, usuarioActual, olvidarUsuario, configTienda, textoPrimeraEntrega } from './api.js';
import { leerConsentimiento, guardarConsentimiento } from './analytics.js';

const ENLACES = [['/catalogo', 'Diseños'], ['/ofertas', 'Ofertas'], ['/seguimiento', 'Seguimiento'], ['/contacto', 'Contacto']];

class BdEncabezado extends HTMLElement {
  async connectedCallback() {
    const actual = location.pathname.replace(/\/$/, '') || '/';
    const nav = h('nav', { class: 'nav', id: 'menu-principal', 'aria-label': 'Principal' }, ENLACES.map(([u, t]) => h('a', { href: u, 'aria-current': u === actual ? 'page' : false }, t)));
    const boton = h('button', { class: 'menu-boton', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'menu-principal', onClick: () => nav.classList.toggle('abierto') || boton.setAttribute('aria-expanded', nav.classList.contains('abierto')) }, 'Menú');
    boton.addEventListener('click', () => boton.setAttribute('aria-expanded', String(nav.classList.contains('abierto'))));
    this.replaceChildren(h('header', { class: 'encabezado' }, h('div', { class: 'contenedor fila' }, h('a', { class: 'marca', href: '/' }, 'BakeDelivery'), boton, nav)));
    const u = await usuarioActual();
    if (u && u.rol !== 'CLIENTE') nav.append(h('a', { href: '/admin/' }, 'Panel'));
    if (u) nav.append(h('a', { href: '/pedidos' }, 'Mis pedidos'), h('a', { href: '/cuenta', 'aria-current': actual === '/cuenta' ? 'page' : false }, u.nombre.split(' ')[0]));
    else nav.append(h('a', { href: '/login' }, 'Entrar'));
    if (!u || u.rol === 'CLIENTE') {
      const cont = h('span', { class: 'contador', 'aria-label': 'artículos en el carrito' }, '0');
      nav.append(h('a', { class: 'carrito', href: '/carrito' }, 'Carrito', cont));
      if (u) api.get('/carrito').then((c) => { cont.textContent = c.lineas.reduce((a, l) => a + l.cantidad, 0); }).catch(() => {});
      document.addEventListener('bd:carrito', (e) => { cont.textContent = e.detail ?? 0; });
    }
  }
}

class BdPie extends HTMLElement {
  connectedCallback() {
    const li = (u, t) => h('li', null, h('a', { href: u }, t));
    this.replaceChildren(h('footer', { class: 'pie' }, h('div', { class: 'contenedor' },
      h('div', { class: 'columnas' },
        h('div', null, h('h2', null, 'BakeDelivery'), h('p', null, 'Pasteles por encargo en Los Mochis, Sinaloa. Aparta tu fecha con 24 horas de anticipación.')),
        h('div', null, h('h2', null, 'Tienda'), h('ul', null, li('/catalogo', 'Diseños'), li('/ofertas', 'Ofertas'), li('/seguimiento', 'Seguimiento de pedido'), li('/contacto', 'Contacto'))),
        h('div', null, h('h2', null, 'Legal y privacidad'), h('ul', null, li('/privacidad', 'Aviso de privacidad'), li('/terminos', 'Términos y condiciones'), li('/cookies', 'Política de cookies'), h('li', null, h('button', { class: 'btn btn-chico btn-secundario', type: 'button', onClick: () => document.querySelector('bd-cookies')?.abrir() }, 'Preferencias de cookies')))),
        h('div', { id: 'pie-contacto' }, h('h2', null, 'Contacto'), h('p', { id: 'pie-datos' }, 'Cargando…'))),
      h('p', { class: 'legal' }, `© ${new Date().getFullYear()} BakeDelivery. Todos los derechos reservados. Proyecto preliminar de demostración.`)),
      h('span', { class: 'pie-marca', 'aria-hidden': 'true' }, 'BakeDelivery')));
    configTienda().then((c) => { const t = c.tienda || {}; this.querySelector('#pie-datos').replaceChildren(t.direccion || '', h('br'), t.telefono ? `Tel. ${t.telefono}` : 'Teléfono por confirmar', h('br'), t.correo ? h('a', { href: `mailto:${t.correo}` }, t.correo) : ''); });
  }
}

class BdCookies extends HTMLElement {
  connectedCallback() { if (!leerConsentimiento()) this.abrir(); }
  abrir() {
    const decidir = (v) => { guardarConsentimiento(v); this.replaceChildren(); document.dispatchEvent(new CustomEvent('bd:consentimiento')); };
    this.replaceChildren(h('div', { class: 'cookies', role: 'dialog', tabindex: '-1', 'aria-labelledby': 'ck-t', 'aria-describedby': 'ck-d' },
      h('h2', { id: 'ck-t' }, 'Tu privacidad importa'),
      h('p', { id: 'ck-d' }, 'Usamos una cookie de sesión necesaria para que funcione tu cuenta y tu carrito. Si aceptas, también usamos Google Analytics (anónimo) para mejorar la tienda. Puedes cambiarlo cuando quieras. ', h('a', { href: '/cookies' }, 'Más información')),
      h('div', { class: 'acciones' }, h('button', { class: 'btn btn-secundario', type: 'button', onClick: () => decidir(true) }, 'Aceptar analítica'), h('button', { class: 'btn btn-secundario', type: 'button', onClick: () => decidir(false) }, 'Solo necesarias'))));
    this.querySelector('.cookies')?.focus();
  }
}

/** Pregunta anti-bot + campo trampa (honeypot). `valores()` devuelve lo que el servidor espera. */
class BdDesafio extends HTMLElement {
  async connectedCallback() {
    this.pregunta = h('label', { for: 'bot_respuesta' }, 'Cargando verificación…');
    this.respuesta = h('input', { id: 'bot_respuesta', name: 'bot_respuesta', inputmode: 'numeric', autocomplete: 'off', required: true, 'aria-describedby': 'err-bot_respuesta' });
    this.trampa = h('div', { class: 'trampa', 'aria-hidden': 'true' }, h('label', null, 'No llenes este campo', h('input', { name: 'sitio_web', tabindex: '-1', autocomplete: 'off' })));
    this.replaceChildren(h('div', { class: 'desafio campo' }, this.pregunta, this.respuesta, h('div', { class: 'ayuda' }, 'Verificación para evitar mensajes automáticos (spam).'), h('div', { class: 'error', id: 'err-bot_respuesta', role: 'alert' })), this.trampa);
    await this.renovar();
  }
  async renovar(d) {
    d ??= await api.get('/verificacion/desafio');
    this.token = d.token; this.pregunta.textContent = d.pregunta; this.respuesta.value = '';
  }
  valores() { return { bot_token: this.token, bot_respuesta: this.respuesta.value.trim(), sitio_web: this.trampa.querySelector('input').value }; }
}

class BdProducto extends HTMLElement {
  set producto(p) {
    const agotado = !p.disponible;
    const fecha = h('span', { class: 'fecha-tag' }, 'Desde mañana');
    textoPrimeraEntrega().then((t) => { fecha.textContent = `Desde ${t}`; });
    this.replaceChildren(h('article', { class: 'producto' },
      h('div', { class: 'foto' },
        p.descuento ? h('span', { class: 'etiqueta' }, `-${Math.round(p.descuento)}%`) : agotado ? h('span', { class: 'etiqueta agotado' }, 'Agotado') : null,
        h('img', { src: rutaImagen(p.imagen_url), alt: p.nombre, width: 400, height: 500, loading: 'lazy' }),
        agotado ? null : fecha),
      h('div', { class: 'cuerpo' }, h('h3', null, h('a', { href: `/producto?id=${p.id}` }, p.nombre)),
        h('span', { class: 'meta' }, [p.sabor, textoPorciones(p.porciones)].filter(Boolean).join(' · ')),
        p.calificacion ? h('span', { class: 'estrellas' }, estrellas(p.calificacion), ` (${p.num_resenas})`) : null,
        h('div', { class: 'pie-tarjeta' }, h('span', { class: 'precio' }, p.descuento ? h('span', { class: 'tachado' }, dinero(p.precio)) : null, dinero(p.precio_final))))));
  }
}
for (const [n, c] of [['bd-encabezado', BdEncabezado], ['bd-pie', BdPie], ['bd-cookies', BdCookies], ['bd-desafio', BdDesafio], ['bd-producto', BdProducto]]) if (!customElements.get(n)) customElements.define(n, c);
export { olvidarUsuario };
