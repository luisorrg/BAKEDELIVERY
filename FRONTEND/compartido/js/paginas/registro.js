import '../base.js';
import { api, olvidarUsuario } from '../api.js';
import { formulario } from '../util.js';
const form = document.getElementById('form'), desafio = form.querySelector('bd-desafio');
formulario(form, async (d) => {
  try { await api.post('/auth/registro', { nombre: d.nombre, correo: d.correo, telefono: d.telefono || undefined, password: d.password, acepta_privacidad: !!d.acepta_privacidad, ...desafio.valores() }); }
  catch (e) { await desafio.renovar(e.datos?.nuevo_desafio); throw e; }
  olvidarUsuario(); location.href = '/catalogo';
});
