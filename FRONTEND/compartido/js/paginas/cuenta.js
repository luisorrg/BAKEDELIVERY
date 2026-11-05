import '../base.js';
import { api, usuarioActual, olvidarUsuario } from '../api.js';
import { h, formulario, campo, toast, fecha } from '../util.js';
const u = await usuarioActual();
if (!u) location.replace('/login?volver=/cuenta');
const panel = document.getElementById('panel'), tabs = document.getElementById('pestanas');
const secciones = { datos: 'Mis datos', direcciones: 'Direcciones', tarjetas: 'Tarjetas', privacidad: 'Privacidad' };
if (u.rol !== 'CLIENTE') { delete secciones.direcciones; delete secciones.tarjetas; }

const vistas = {
  async datos() {
    const { cuenta } = await api.get('/cuenta');
    const f = h('form', { class: 'tarjeta estrecho', novalidate: true }, h('h2', null, 'Datos personales'), campo({ nombre: 'nombre', etiqueta: 'Nombre', requerido: true, valor: cuenta.nombre, maxlength: 100 }), campo({ nombre: 'telefono', etiqueta: 'Teléfono', tipo: 'tel', valor: cuenta.telefono || '', maxlength: 20 }), h('p', { class: 'meta' }, `Correo: ${cuenta.correo} · Cliente desde ${fecha(cuenta.fecha_registro)}`), h('button', { class: 'btn btn-primario', type: 'submit' }, 'Guardar cambios'));
    formulario(f, async (d) => { await api.put('/cuenta', { nombre: d.nombre, telefono: d.telefono || undefined }); olvidarUsuario(); toast('Datos actualizados', 'ok'); });
    const p = h('form', { class: 'tarjeta estrecho', novalidate: true }, h('h2', null, 'Cambiar contraseña'), campo({ nombre: 'actual', etiqueta: 'Contraseña actual', tipo: 'password', requerido: true, autocomplete: 'current-password' }), campo({ nombre: 'nueva', etiqueta: 'Nueva contraseña', tipo: 'password', requerido: true, autocomplete: 'new-password', minlength: 10, ayuda: 'Mínimo 10 caracteres, con letras y números.' }), h('button', { class: 'btn btn-secundario', type: 'submit' }, 'Cambiar contraseña'));
    formulario(p, async (d) => { await api.put('/cuenta/password', { actual: d.actual, nueva: d.nueva }); p.reset(); toast('Contraseña actualizada', 'ok'); });
    return [f, h('p'), p, h('p'), h('button', { class: 'btn btn-secundario', type: 'button', onClick: async () => { await api.post('/auth/logout'); olvidarUsuario(); location.href = '/'; } }, 'Cerrar sesión')];
  },
  async direcciones() {
    const { direcciones } = await api.get('/direcciones');
    const f = h('form', { class: 'tarjeta', novalidate: true }, h('h3', null, 'Agregar dirección'), campo({ nombre: 'calle_numero', etiqueta: 'Calle y número', requerido: true, maxlength: 150 }), h('div', { class: 'fila-campos' }, campo({ nombre: 'colonia', etiqueta: 'Colonia', maxlength: 100 }), campo({ nombre: 'ciudad', etiqueta: 'Ciudad', maxlength: 100, valor: 'Los Mochis' }), campo({ nombre: 'codigo_postal', etiqueta: 'C.P.', maxlength: 10 })), campo({ nombre: 'referencias', etiqueta: 'Referencias', maxlength: 200 }), h('button', { class: 'btn btn-primario', type: 'submit' }, 'Guardar'));
    formulario(f, async (d) => { await api.post('/direcciones', Object.fromEntries(Object.entries(d).filter(([, v]) => v))); mostrar('direcciones'); });
    return [...direcciones.map((d) => h('div', { class: 'tarjeta' }, h('strong', null, d.calle_numero), h('p', { class: 'meta' }, [d.colonia, d.ciudad, d.codigo_postal].filter(Boolean).join(', '), d.referencias ? ` · ${d.referencias}` : ''), h('button', { class: 'btn btn-chico btn-peligro', type: 'button', onClick: async () => { try { await api.del(`/direcciones/${d.id}`); mostrar('direcciones'); } catch (e) { toast(e.message, 'error'); } } }, 'Eliminar'))), f];
  },
  async tarjetas() {
    const { tarjetas } = await api.get('/tarjetas');
    const f = h('form', { class: 'tarjeta', novalidate: true }, h('h3', null, 'Agregar tarjeta'), h('p', { class: 'aviso info' }, 'Modo de pruebas (pasarela simulada): 4242 4242 4242 4242, fecha futura, CVV 123. No guardamos tu número completo ni tu CVV.'), campo({ nombre: 'numero', etiqueta: 'Número', requerido: true, inputmode: 'numeric', autocomplete: 'off', maxlength: 23 }), h('div', { class: 'fila-campos' }, campo({ nombre: 'mes', etiqueta: 'Mes', tipo: 'number', min: 1, max: 12, requerido: true }), campo({ nombre: 'anio', etiqueta: 'Año', tipo: 'number', requerido: true }), campo({ nombre: 'cvv', etiqueta: 'CVV', requerido: true, inputmode: 'numeric', autocomplete: 'off', maxlength: 4 })), h('button', { class: 'btn btn-primario', type: 'submit' }, 'Verificar y guardar'));
    formulario(f, async (d) => { await api.post('/tarjetas', { numero: d.numero, mes: Number(d.mes), anio: Number(d.anio), cvv: d.cvv }); mostrar('tarjetas'); });
    return [...tarjetas.map((t) => h('div', { class: 'tarjeta' }, h('strong', null, `${t.marca} •••• ${t.ultimos_digitos}`), h('p', { class: 'meta' }, `Vence ${String(t.mes_expiracion).padStart(2, '0')}/${t.anio_expiracion}`), h('button', { class: 'btn btn-chico btn-peligro', type: 'button', onClick: async () => { try { await api.del(`/tarjetas/${t.id}`); mostrar('tarjetas'); } catch (e) { toast(e.message, 'error'); } } }, 'Eliminar'))), f];
  },
  async privacidad() {
    const f = h('form', { class: 'tarjeta estrecho', novalidate: true }, h('h2', null, 'Eliminar mi cuenta'), h('p', null, 'Anonimizaremos tus datos personales y cerraremos tu sesión. Los registros de venta se conservan sin tus datos, como exige la ley.'), campo({ nombre: 'password', etiqueta: 'Confirma tu contraseña', tipo: 'password', requerido: true, autocomplete: 'current-password' }), h('button', { class: 'btn btn-peligro', type: 'submit' }, 'Eliminar mi cuenta'));
    formulario(f, async (d) => { if (!confirm('Esta acción no se puede deshacer. ¿Continuar?')) return; await api.del('/cuenta', { password: d.password }); olvidarUsuario(); location.href = '/'; });
    return [h('div', { class: 'tarjeta estrecho' }, h('h2', null, 'Tus derechos ARCO'), h('p', null, 'Puedes descargar una copia de tus datos (acceso/portabilidad), corregirlos en “Mis datos” o eliminar tu cuenta.'), h('a', { class: 'btn btn-secundario', href: '/api/cuenta/exportar', download: 'mis-datos-bakedelivery.json' }, 'Descargar mis datos'), h('p'), h('a', { href: '/privacidad' }, 'Leer el aviso de privacidad')), h('p'), u.rol === 'CLIENTE' ? f : null];
  },
};
async function mostrar(k) {
  for (const b of tabs.children) b.setAttribute('aria-selected', String(b.dataset.k === k));
  panel.replaceChildren(h('p', null, 'Cargando…'));
  try { panel.replaceChildren(...(await vistas[k]()).filter(Boolean)); } catch (e) { panel.replaceChildren(h('p', { class: 'aviso error' }, e.message)); }
}
for (const [k, t] of Object.entries(secciones)) tabs.append(h('button', { role: 'tab', type: 'button', dataset: { k }, onClick: () => mostrar(k) }, t));
mostrar('datos');
