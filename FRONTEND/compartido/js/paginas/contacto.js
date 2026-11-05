import '../base.js';
import { api, configTienda } from '../api.js';
import { formulario, h } from '../util.js';
const form = document.getElementById('form'), desafio = form.querySelector('bd-desafio');
configTienda().then((c) => { const t = c.tienda; document.getElementById('datos-tienda').replaceChildren(t.direccion || '', h('br'), t.telefono ? `Tel. ${t.telefono}` : '', h('br'), t.correo || ''); });
formulario(form, async (d) => {
  try { const r = await api.post('/contacto', { nombre: d.nombre, correo: d.correo, asunto: d.asunto, mensaje: d.mensaje, acepta_privacidad: !!d.acepta_privacidad, ...desafio.valores() }); form.replaceChildren(h('p', { class: 'aviso ok', role: 'status' }, r.mensaje)); }
  catch (e) { await desafio.renovar(e.datos?.nuevo_desafio); throw e; }
});
