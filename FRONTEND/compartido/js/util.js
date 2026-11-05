// Utilidades de interfaz. Se construye el DOM con textContent (nunca innerHTML con datos) para evitar XSS.
export function h(tag, props, ...hijos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k in el && k !== 'list' && k !== 'form') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of hijos.flat(Infinity)) if (c !== undefined && c !== null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const dinero = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(n) || 0);
export const fechaHora = (s) => (s ? new Date(String(s).replace(' ', 'T') + 'Z').toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
export const fecha = (s) => (s ? new Date(String(s).replace(' ', 'T') + 'Z').toLocaleDateString('es-MX', { dateStyle: 'medium' }) : '—');
export const param = (k) => new URLSearchParams(location.search).get(k);
export const textoPorciones = (n) => (n ? `${n} ${n === 1 ? 'porción' : 'porciones'}` : null);
export const estrellas = (n) => (n ? `${n} de 5` : '');
/** Primera entrega posible según las horas de anticipación; el servidor la vuelve a validar al confirmar. */
export const primeraEntrega = (horas = 24) => new Date(Date.now() + horas * 36e5).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');
export const rutaImagen = (u) => (u && (u.startsWith('/compartido/img/') || u.startsWith('https://')) ? u : '/compartido/img/placeholder.svg');
export const ESTADOS = { pendiente: 'Pendiente de pago', pagado: 'Pagado', en_preparacion: 'En preparación', listo: 'Listo', enviado: 'En camino', entregado: 'Entregado', cancelado: 'Cancelado' };

let zona;
export function toast(msg, tipo = '') {
  zona ??= document.body.appendChild(h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' }));
  const t = zona.appendChild(h('div', { class: 'toast ' + tipo }, msg));
  setTimeout(() => t.remove(), 5000);
}
export function insignia(texto, tipo = '') { return h('span', { class: 'insignia ' + tipo }, texto); }
export function colorEstado(e) { return { entregado: 'ok', pagado: 'ok', cancelado: 'error', pendiente: 'aviso' }[e] || ''; }
export const vacio = (el) => { el.replaceChildren(); return el; };

/** Formulario con validación de servidor: muestra errores junto a cada campo y bloquea el botón al enviar. */
export function formulario(form, enviar) {
  const limpiar = () => { for (const e of form.querySelectorAll('.error')) e.textContent = ''; for (const i of form.querySelectorAll('[aria-invalid]')) i.removeAttribute('aria-invalid'); };
  const mostrar = (errores = {}) => {
    let primero;
    for (const [campo, msg] of Object.entries(errores)) {
      const inp = form.elements[campo]; const err = form.querySelector(`#err-${campo}`);
      if (inp) { inp.setAttribute('aria-invalid', 'true'); primero ??= inp; }
      if (err) err.textContent = msg.charAt(0).toUpperCase() + msg.slice(1);
    }
    primero?.focus();
  };
  form.noValidate = true;
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault(); limpiar();
    const aviso = form.querySelector('.aviso.error'); if (aviso) aviso.remove();
    const nativo = [...form.elements].find((e) => e.willValidate && !e.checkValidity());
    if (nativo) { mostrar({ [nativo.name]: nativo.validationMessage }); return; }
    const boton = form.querySelector('button[type=submit]'); if (boton) boton.disabled = true;
    try { await enviar(Object.fromEntries(new FormData(form).entries())); }
    catch (e) {
      if (e.datos?.errores && !Array.isArray(e.datos.errores)) mostrar(e.datos.errores);
      const caja = h('div', { class: 'aviso error', role: 'alert' }, e.message || 'Ocurrió un error');
      form.prepend(caja);
      form.dispatchEvent(new CustomEvent('bd:error', { detail: e }));
    } finally { if (boton) boton.disabled = false; }
  });
}
/** Campo de formulario accesible: etiqueta + input + mensaje de error. */
export function campo({ nombre, etiqueta, tipo = 'text', requerido = false, ayuda, valor, ...resto }) {
  const id = 'c-' + nombre;
  const control = tipo === 'textarea' ? h('textarea', { id, name: nombre, rows: 3, required: requerido, ...resto }, valor || '') : tipo === 'select' ? h('select', { id, name: nombre, required: requerido, ...resto }, (resto.opciones || []).map((o) => h('option', { value: o.v, selected: String(o.v) === String(valor) }, o.t))) : h('input', { id, name: nombre, type: tipo, required: requerido, value: valor ?? '', ...resto });
  if (tipo === 'select') control.removeAttribute('opciones');
  control.setAttribute('aria-describedby', `err-${nombre}`);
  return h('div', { class: 'campo' }, h('label', { for: id }, etiqueta + (requerido ? ' *' : '')), control, ayuda && h('div', { class: 'ayuda' }, ayuda), h('div', { class: 'error', id: 'err-' + nombre, role: 'alert' }));
}
