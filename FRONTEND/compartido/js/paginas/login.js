import '../base.js';
import { api, olvidarUsuario } from '../api.js';
import { formulario, param } from '../util.js';
formulario(document.getElementById('form'), async (d) => {
  const { usuario } = await api.post('/auth/login', { correo: d.correo, password: d.password });
  olvidarUsuario();
  const volver = param('volver');
  location.href = volver && /^\/[a-z0-9\-_/?=&.%]*$/i.test(volver) && !volver.startsWith('//') ? volver : usuario.rol === 'CLIENTE' ? '/catalogo' : '/admin/';
});
