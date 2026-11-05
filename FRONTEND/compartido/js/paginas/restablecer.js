import '../base.js';
import { api } from '../api.js';
import { formulario, h, param } from '../util.js';
const token = param('token') || '', estado = document.getElementById('estado'), form = document.getElementById('form');
const { valido } = await api.get('/auth/restablecer/validar?token=' + encodeURIComponent(token)).catch(() => ({ valido: false }));
if (!valido) estado.replaceChildren(h('p', { class: 'aviso error' }, 'El enlace no es válido o ya venció.'), h('a', { href: '/olvide' }, 'Solicitar uno nuevo'));
else {
  form.hidden = false;
  formulario(form, async (d) => { await api.post('/auth/restablecer', { token, password: d.password }); form.replaceChildren(h('p', { class: 'aviso ok' }, 'Contraseña actualizada.'), h('a', { class: 'btn btn-primario', href: '/login' }, 'Iniciar sesión')); });
}
