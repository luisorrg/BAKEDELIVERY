import '../base.js';
import { api } from '../api.js';
import { formulario, h } from '../util.js';
const form = document.getElementById('form'), desafio = form.querySelector('bd-desafio');
formulario(form, async (d) => {
  try { const r = await api.post('/auth/olvide', { correo: d.correo, ...desafio.valores() }); form.replaceChildren(h('p', { class: 'aviso ok', role: 'status' }, r.mensaje)); }
  catch (e) { await desafio.renovar(e.datos?.nuevo_desafio); throw e; }
});
