import '../base.js';
import { api } from '../api.js';
import { formulario, h, fechaHora, param } from '../util.js';
const form = document.getElementById('form'), salida = document.getElementById('resultado');
export const PASOS = [['preparando', 'Preparando tu pedido'], ['en_ruta', 'En camino'], ['entregado', 'Entregado']];
async function consultar(guia) {
  const { envio } = await api.get('/seguimiento/' + encodeURIComponent(guia.trim()));
  const i = PASOS.findIndex(([k]) => k === envio.estado);
  salida.replaceChildren(h('h2', null, `Guía ${envio.num_guia}`), h('ol', { class: 'seguimiento' }, PASOS.map(([k, t], n) => h('li', { class: n < i ? 'hecho' : n === i ? 'hecho actual' : '' }, t))), envio.estado === 'cancelado' ? h('p', { class: 'aviso error' }, 'Este envío fue cancelado.') : null,
    h('p', { class: 'meta' }, envio.fecha_entrega_real ? `Entregado: ${fechaHora(envio.fecha_entrega_real)}` : `Entrega estimada: ${fechaHora(envio.fecha_estimada_entrega)}`));
}
formulario(form, async (d) => { salida.replaceChildren(); try { await consultar(d.guia); } catch (e) { if (e.status === 404) throw Object.assign(e, { datos: { errores: { guia: 'No encontramos esa guía' } } }); throw e; } });
if (param('guia')) { form.elements.guia.value = param('guia'); consultar(param('guia')).catch(() => {}); }
