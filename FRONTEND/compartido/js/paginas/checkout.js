import '../base.js';
import { api, usuarioActual } from '../api.js';
import { h, dinero, formulario, campo, toast, vacio } from '../util.js';
import { configTienda } from '../api.js';

const u = await usuarioActual();
if (!u || u.rol !== 'CLIENTE') location.replace('/login?volver=/checkout');
const form = document.getElementById('form-pedido'), pasos = document.getElementById('pasos'), resumen = document.getElementById('resumen');
const cfg = await configTienda();
const [{ tipos }, { direcciones }, { tarjetas }] = await Promise.all([api.get('/tipos-pago'), api.get('/direcciones'), api.get('/tarjetas')]);
let entrega = 'DOMICILIO';
let estado = { direcciones, tarjetas };

const minFecha = () => { const d = new Date(Date.now() + (cfg.reglas.horasAnticipacion || 24) * 3600e3 + 60e3); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const esTarjeta = (id) => /^tarjeta/i.test(tipos.find((t) => t.id === Number(id))?.nombre || '');

async function pintarResumen() {
  const c = await api.get('/carrito?entrega=' + entrega);
  if (!c.lineas.length) { location.replace('/carrito'); return; }
  resumen.replaceChildren(h('h2', null, 'Tu pedido'), ...c.lineas.map((l) => h('p', null, `${l.cantidad} × ${l.nombre} — `, h('strong', null, dinero(l.subtotal)))),
    h('dl', null, h('dt', null, 'Subtotal'), h('dd', null, dinero(c.subtotal)), h('dt', null, 'Envío'), h('dd', null, c.costo_envio ? dinero(c.costo_envio) : entrega === 'RECOGER' ? 'Recoger en tienda' : '¡Gratis!'), h('dt', { class: 'total' }, 'Total'), h('dd', { class: 'total' }, dinero(c.total))),
    h('button', { class: 'btn btn-primario btn-grande', type: 'submit' }, 'Confirmar pedido'), h('p', { class: 'meta' }, 'Al confirmar aceptas los ', h('a', { href: '/terminos', target: '_blank', rel: 'noopener' }, 'términos y condiciones'), '.'));
}

function seccionEntrega() {
  const dirSel = h('select', { id: 'id_direccion', name: 'id_direccion', 'aria-describedby': 'err-id_direccion' }, estado.direcciones.map((d) => h('option', { value: d.id }, `${d.calle_numero}, ${d.colonia || ''} ${d.ciudad || ''}`)));
  const nueva = h('details', null, h('summary', null, '+ Agregar dirección'), campo({ nombre: 'n_calle', etiqueta: 'Calle y número', maxlength: 150 }), h('div', { class: 'fila-campos' }, campo({ nombre: 'n_colonia', etiqueta: 'Colonia', maxlength: 100 }), campo({ nombre: 'n_ciudad', etiqueta: 'Ciudad', maxlength: 100, valor: 'Los Mochis' }), campo({ nombre: 'n_cp', etiqueta: 'C.P.', maxlength: 10 })), campo({ nombre: 'n_ref', etiqueta: 'Referencias', maxlength: 200 }),
    h('button', { class: 'btn btn-secundario btn-chico', type: 'button', onClick: async () => { const v = (n) => form.elements[n].value; try { await api.post('/direcciones', { calle_numero: v('n_calle'), colonia: v('n_colonia'), ciudad: v('n_ciudad'), codigo_postal: v('n_cp'), referencias: v('n_ref') }); estado.direcciones = (await api.get('/direcciones')).direcciones; toast('Dirección guardada', 'ok'); armar(); } catch (e) { toast(e.message, 'error'); } } }, 'Guardar dirección'));
  const caja = h('div', { id: 'caja-dir' }, h('div', { class: 'campo' }, h('label', { for: 'id_direccion' }, 'Dirección de entrega *'), dirSel, h('div', { class: 'error', id: 'err-id_direccion', role: 'alert' })), nueva);
  const radio = (v, t) => h('label', null, h('input', { type: 'radio', name: 'tipo_entrega', value: v, checked: entrega === v, onChange: () => { entrega = v; caja.hidden = v !== 'DOMICILIO'; pintarResumen(); } }), ' ' + t);
  caja.hidden = entrega !== 'DOMICILIO';
  return h('fieldset', { class: 'campo' }, h('legend', { class: 'etiqueta-campo' }, '1. Entrega'), h('p', null, radio('DOMICILIO', 'A domicilio'), ' ', radio('RECOGER', `Recoger en tienda (${cfg.tienda.direccion || ''})`)), caja);
}
function seccionPago() {
  const tp = h('select', { id: 'id_tipo_pago', name: 'id_tipo_pago', onChange: () => { cajaTarjeta.hidden = !esTarjeta(tp.value); } }, tipos.map((t) => h('option', { value: t.id }, t.nombre)));
  const tarSel = h('select', { id: 'id_tarjeta', name: 'id_tarjeta' }, estado.tarjetas.map((t) => h('option', { value: t.id }, `${t.marca} •••• ${t.ultimos_digitos} (vence ${String(t.mes_expiracion).padStart(2, '0')}/${t.anio_expiracion})`)));
  const nueva = h('details', { open: !estado.tarjetas.length }, h('summary', null, '+ Agregar tarjeta'), h('p', { class: 'aviso info' }, 'Modo de pruebas: pasarela simulada. Usa 4242 4242 4242 4242, cualquier fecha futura y CVV 123. No se realiza ningún cargo real.'),
    campo({ nombre: 't_numero', etiqueta: 'Número de tarjeta', inputmode: 'numeric', autocomplete: 'off', maxlength: 23 }), h('div', { class: 'fila-campos' }, campo({ nombre: 't_mes', etiqueta: 'Mes', type: 'number', tipo: 'number', min: 1, max: 12 }), campo({ nombre: 't_anio', etiqueta: 'Año', tipo: 'number', min: 26, max: 2100 }), campo({ nombre: 't_cvv2', etiqueta: 'CVV', inputmode: 'numeric', autocomplete: 'off', maxlength: 4 })),
    h('button', { class: 'btn btn-secundario btn-chico', type: 'button', onClick: async () => { const v = (n) => form.elements[n].value; try { await api.post('/tarjetas', { numero: v('t_numero'), mes: Number(v('t_mes')), anio: Number(v('t_anio')), cvv: v('t_cvv2') }); form.elements.t_numero.value = form.elements.t_cvv2.value = ''; estado.tarjetas = (await api.get('/tarjetas')).tarjetas; toast('Tarjeta verificada y guardada', 'ok'); armar(); } catch (e) { toast(e.message, 'error'); } } }, 'Verificar y guardar tarjeta'));
  const cajaTarjeta = h('div', null, estado.tarjetas.length ? h('div', { class: 'campo' }, h('label', { for: 'id_tarjeta' }, 'Tarjeta *'), tarSel) : null, estado.tarjetas.length ? campo({ nombre: 'cvv', etiqueta: 'CVV de la tarjeta elegida *', inputmode: 'numeric', autocomplete: 'off', maxlength: 4, ayuda: 'Nunca guardamos tu CVV.' }) : null, nueva);
  cajaTarjeta.hidden = !esTarjeta(tp.value);
  return h('fieldset', { class: 'campo' }, h('legend', { class: 'etiqueta-campo' }, '3. Pago'), h('div', { class: 'campo' }, h('label', { for: 'id_tipo_pago' }, 'Forma de pago *'), tp), cajaTarjeta);
}
function armar() {
  const guardado = ['fecha_entrega', 'id_tipo_pago', 'id_direccion', 'cvv'].map((n) => [n, form.elements[n]?.value]); // conserva lo ya escrito al volver a dibujar
  pasos.replaceChildren(seccionEntrega(),
    h('fieldset', { class: 'campo' }, h('legend', { class: 'etiqueta-campo' }, '2. Fecha y hora de entrega'), campo({ nombre: 'fecha_entrega', etiqueta: 'Fecha y hora', tipo: 'datetime-local', requerido: true, min: minFecha(), ayuda: `Con al menos ${cfg.reglas.horasAnticipacion} horas de anticipación.` })),
    seccionPago());
  for (const [n, v] of guardado) if (v && form.elements[n]) form.elements[n].value = v;
  const tp = form.elements.id_tipo_pago; if (tp) tp.dispatchEvent(new Event('change'));
}
armar(); await pintarResumen();
formulario(form, async (d) => {
  const t = esTarjeta(d.id_tipo_pago);
  if (d.tipo_entrega === 'DOMICILIO' && !d.id_direccion) throw Object.assign(new Error('Agrega una dirección de entrega'), { datos: { errores: { id_direccion: 'es obligatoria' } } });
  if (t && !d.id_tarjeta) throw new Error('Agrega y verifica una tarjeta para pagar con tarjeta');
  const r = await api.post('/pedidos', { tipo_entrega: d.tipo_entrega, id_direccion: d.tipo_entrega === 'DOMICILIO' ? Number(d.id_direccion) : undefined, id_tipo_pago: Number(d.id_tipo_pago), id_tarjeta: t ? Number(d.id_tarjeta) : undefined, cvv: t ? d.cvv : undefined, fecha_entrega: new Date(d.fecha_entrega).toISOString() });
  document.dispatchEvent(new CustomEvent('bd:carrito', { detail: 0 }));
  location.href = `/pedido?id=${r.idVenta}&nuevo=1`;
});
