import { api, olvidarUsuario } from '/compartido/js/api.js';
import { formulario } from '/compartido/js/util.js';
formulario(document.getElementById('form'), async (d) => {
  const { usuario } = await api.post('/auth/login', { correo: d.correo, password: d.password });
  olvidarUsuario();
  if (usuario.rol === 'CLIENTE') { await api.post('/auth/logout'); throw new Error('Esta cuenta no tiene acceso al panel.'); }
  location.href = '/admin/';
});
