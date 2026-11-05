import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancar, navegador, dormir, entregaEn } from './ayuda.js';

const ANIO = new Date().getFullYear() + 3;
let app;
before(async () => { app = await arrancar(); });
after(async () => { await app.cerrar(); });

const desafios = async (n, nav) => { const l = []; for (let i = 0; i < n; i++) l.push((await nav.get('/api/verificacion/desafio')).datos); await dormir(1600); return l.map((d) => { const [a, b] = d.pregunta.match(/\d+/g).map(Number); return { bot_token: d.token, bot_respuesta: String(a + b), sitio_web: '' }; }); };

test('seguridad: cabeceras, CSRF y 404', async () => {
  const r = await fetch(app.base + '/api/config');
  assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff'); assert.equal(r.headers.get('x-frame-options'), 'DENY');
  assert.ok(!(await r.text()).match(/secret|password/i));
  const sinCsrf = await fetch(app.base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(sinCsrf.status, 403);
  const n = navegador(app.base);
  assert.equal((await n.api('POST', '/api/auth/logout', {}, { origin: 'https://malo.example' })).status, 403);
  assert.equal((await n.get('/api/no-existe')).status, 404);
  assert.equal((await fetch(app.base + '/pagina-que-no-existe')).status, 404);
  assert.match(await (await fetch(app.base + '/robots.txt')).text(), /Disallow: \/admin/);
  assert.match(await (await fetch(app.base + '/sitemap.xml')).text(), /<urlset/);
});

test('rutas protegidas exigen sesión y rol', async () => {
  const n = navegador(app.base);
  assert.equal((await n.get('/api/carrito')).status, 401);
  assert.equal((await n.get('/api/admin/resumen')).status, 401);
  await n.post('/api/auth/login', { correo: 'cliente@bakedelivery.local', password: app.claves.cliente });
  assert.equal((await n.get('/api/admin/resumen')).status, 403);
  assert.equal((await n.get('/api/admin/usuarios')).status, 403);
  const rep = navegador(app.base);
  await rep.post('/api/auth/login', { correo: 'repostero@bakedelivery.local', password: app.claves.repostero });
  assert.equal((await rep.get('/api/admin/resumen')).status, 200);
  assert.equal((await rep.get('/api/admin/usuarios')).status, 403, 'el repostero no administra usuarios');
  assert.equal((await rep.get('/api/carrito')).status, 403);
});

test('login: errores genéricos y bloqueo por intentos', async () => {
  const n = navegador(app.base);
  const a = await n.post('/api/auth/login', { correo: 'nadie@x.com', password: 'Whatever12345' });
  const b = await n.post('/api/auth/login', { correo: 'cliente@bakedelivery.local', password: 'Equivocada123' });
  assert.equal(a.status, 401); assert.equal(a.datos.error, b.datos.error);
  for (let i = 0; i < 5; i++) await n.post('/api/auth/login', { correo: 'repostero@bakedelivery.local', password: 'Equivocada123' });
  const c = await n.post('/api/auth/login', { correo: 'repostero@bakedelivery.local', password: app.claves.repostero });
  assert.equal(c.status, 429);
});

test('registro con anti-bot, honeypot y duplicados', async () => {
  const n = navegador(app.base);
  const [d1, d2, d3] = await desafios(3, n);
  const datos = { nombre: 'Luis Prueba', correo: 'luis@example.com', password: 'ClaveSegura123', acepta_privacidad: true };
  assert.equal((await n.post('/api/auth/registro', { ...datos, ...d1, sitio_web: 'http://spam' })).status, 400, 'honeypot');
  assert.equal((await n.post('/api/auth/registro', { ...datos, bot_token: d2.bot_token, bot_respuesta: '99' })).status, 422, 'respuesta mala');
  assert.equal((await n.post('/api/auth/registro', { ...datos, ...d3, acepta_privacidad: false })).status, 422, 'sin aceptar privacidad');
  const [d4, d5] = await desafios(2, n);
  const ok = await n.post('/api/auth/registro', { ...datos, ...d4 });
  assert.equal(ok.status, 201); assert.equal((await n.get('/api/auth/yo')).datos.usuario.correo, 'luis@example.com');
  assert.equal((await n.post('/api/auth/registro', { ...datos, ...d5 })).status, 409);
});

test('compra completa: carrito → tarjeta → pedido → ticket → inventario', async () => {
  const n = navegador(app.base);
  await n.post('/api/auth/login', { correo: 'cliente@bakedelivery.local', password: app.claves.cliente });
  const prods = (await n.get('/api/productos')).datos.productos;
  const pastel = prods.find((p) => p.es_personalizable && p.precio >= 500), conchas = prods.find((p) => /Charola/.test(p.nombre));
  assert.equal((await n.post('/api/carrito/items', { id_producto: pastel.id, cantidad: 1, personalizacion: { mensaje_pastel: 'Feliz cumple Ana', relleno: 'Fresa' } })).status, 201);
  assert.equal((await n.post('/api/carrito/items', { id_producto: pastel.id, cantidad: 40 })).status, 409, 'más que el stock');
  const carro = (await n.post('/api/carrito/items', { id_producto: conchas.id, cantidad: 2 })).datos;
  assert.equal(carro.lineas.length, 2); assert.equal(carro.costo_envio, 0, 'envío gratis ≥ $600');
  assert.ok(carro.lineas[0].personalizacion.mensaje_pastel === 'Feliz cumple Ana');
  const dir = (await n.get('/api/direcciones')).datos.direcciones[0];
  const tipos = (await n.get('/api/tipos-pago')).datos.tipos; const tTarjeta = tipos.find((t) => /Tarjeta/.test(t.nombre)).id;
  // tarjeta rechazada al registrar, y válida
  assert.equal((await n.post('/api/tarjetas', { numero: '4000000000000002', mes: 12, anio: ANIO, cvv: '123' })).status, 402);
  assert.equal((await n.post('/api/tarjetas', { numero: '4242424242424241', mes: 12, anio: ANIO, cvv: '123' })).status, 422);
  const t = await n.post('/api/tarjetas', { numero: '4242 4242 4242 4242', mes: 12, anio: ANIO, cvv: '123' }); assert.equal(t.status, 201);
  const lista = (await n.get('/api/tarjetas')).datos.tarjetas; assert.ok(!JSON.stringify(lista).includes('tok_') && !JSON.stringify(lista).includes('4242424242424242'));
  const base = { tipo_entrega: 'DOMICILIO', id_direccion: dir.id, id_tipo_pago: tTarjeta, id_tarjeta: t.datos.id, cvv: '123' };
  assert.equal((await n.post('/api/pedidos', { ...base, fecha_entrega: entregaEn(2) })).status, 422, 'falta anticipación');
  assert.equal((await n.post('/api/pedidos', { ...base, cvv: '12', fecha_entrega: entregaEn(48) })).status, 422, 'CVV inválido');
  
  const p = await n.post('/api/pedidos', { ...base, fecha_entrega: entregaEn(48) });
  assert.equal(p.status, 201, JSON.stringify(p.datos)); assert.ok(p.datos.pagado && p.datos.folio.startsWith('BD-'));
  assert.equal((await n.get('/api/carrito')).datos.lineas.length, 0, 'carrito vacío tras comprar');
  const det = (await n.get(`/api/mis-pedidos/${p.datos.idVenta}`)).datos.pedido; assert.equal(det.estado, 'pagado'); assert.ok(det.num_guia);
  assert.ok(!('correo' in det));
  const pdf = await n.get(`/api/mis-pedidos/${p.datos.idVenta}/ticket.pdf`); assert.equal(pdf.status, 200); assert.ok(pdf.datos.subarray(0, 5).toString() === '%PDF-');
  const admin = navegador(app.base); await admin.post('/api/auth/login', { correo: 'admin@bakedelivery.local', password: app.claves.admin });
  // cancelar devuelve existencias
  const st0 = (await admin.get(`/api/admin/productos/${pastel.id}`)).datos.producto.stock;
  assert.equal((await n.post(`/api/mis-pedidos/${p.datos.idVenta}/cancelar`)).status, 200);
  assert.equal((await admin.get(`/api/admin/productos/${pastel.id}`)).datos.producto.stock, st0 + 1);
  assert.equal((await n.post(`/api/mis-pedidos/${p.datos.idVenta}/cancelar`)).status, 409, 'ya cancelado');
  // otro cliente no ve el pedido
  const otro = navegador(app.base); const [d] = await desafios(1, otro);
  await otro.post('/api/auth/registro', { nombre: 'Otra Persona', correo: 'otra@example.com', password: 'ClaveSegura123', acepta_privacidad: true, ...d });
  assert.equal((await otro.get(`/api/mis-pedidos/${p.datos.idVenta}`)).status, 404);
});

test('pago rechazado al cobrar no genera pedido ni toca el stock', async () => {
  const n = navegador(app.base); await n.post('/api/auth/login', { correo: 'cliente@bakedelivery.local', password: app.claves.cliente });
  const prod = (await n.get('/api/productos')).datos.productos[0];
  await n.post('/api/carrito/items', { id_producto: prod.id, cantidad: 1 });
  const dir = (await n.get('/api/direcciones')).datos.direcciones[0];
  const tt = (await n.get('/api/tipos-pago')).datos.tipos.find((t) => /Tarjeta/.test(t.nombre)).id;
  const tar = await n.post('/api/tarjetas', { numero: '4000000000000341', mes: 12, anio: ANIO, cvv: '123' }); assert.equal(tar.status, 201, 'se registra bien ' + JSON.stringify(tar.datos));
  const r = await n.post('/api/pedidos', { tipo_entrega: 'DOMICILIO', id_direccion: dir.id, id_tipo_pago: tt, id_tarjeta: tar.datos.id, cvv: '123', fecha_entrega: entregaEn(48) });
  assert.equal(r.status, 402); assert.equal(r.datos.codigo, 'tarjeta_rechazada');
  assert.equal((await n.get('/api/carrito')).datos.lineas.length, 1, 'el carrito se conserva');
  await n.del(`/api/carrito/items/${(await n.get('/api/carrito')).datos.lineas[0].id}`);
});

test('devoluciones, garantías y reseñas sobre el pedido entregado', async () => {
  const n = navegador(app.base); await n.post('/api/auth/login', { correo: 'cliente@bakedelivery.local', password: app.claves.cliente });
  const ped = (await n.get('/api/mis-pedidos')).datos.pedidos.find((p) => p.estado === 'entregado');
  const det = (await n.get(`/api/mis-pedidos/${ped.id_venta}`)).datos.pedido; const idp = det.items[0].id_producto;
  assert.equal((await n.post('/api/devoluciones', { id_venta: ped.id_venta, id_producto: idp, cantidad: 5, motivo: 'Llegó dañado' })).status, 409, 'más de lo comprado');
  assert.equal((await n.post('/api/devoluciones', { id_venta: ped.id_venta, id_producto: idp, cantidad: 1, motivo: 'Llegó dañado' })).status, 201);
  assert.equal((await n.post('/api/garantias', { id_venta: ped.id_venta, id_producto: idp, motivo: 'Sabor extraño' })).status, 201);
  assert.equal((await n.post('/api/garantias', { id_venta: ped.id_venta, id_producto: idp, motivo: 'Sabor extraño' })).status, 409);
  assert.equal((await n.post(`/api/productos/${idp}/resenas`, { calificacion: 5, comentario: 'Delicioso' })).status, 201);
  const otro = (await n.get('/api/productos')).datos.productos.find((p) => p.id !== idp);
  assert.equal((await n.post(`/api/productos/${otro.id}/resenas`, { calificacion: 5 })).status, 422, 'solo productos comprados');
  assert.equal((await n.get(`/api/productos/${idp}/resenas`)).datos.resenas[0].nombre, 'Clara');
});

test('panel: producto con alertas, ofertas sugeridas, compras y reportes', async () => {
  const a = navegador(app.base); await a.post('/api/auth/login', { correo: 'admin@bakedelivery.local', password: app.claves.admin });
  const cat = (await a.get('/api/admin/categorias')).datos.categorias[0].id;
  const nuevo = await a.post('/api/admin/productos', { nombre: 'Brownie', id_categoria: cat, costo: 20, precio: 45, stock_actual: 10, stock_minimo: 3, stock_maximo: 10, imagen_url: '/compartido/img/brownie.svg' });
  assert.equal(nuevo.status, 201); assert.deepEqual(nuevo.datos.alertas, ['MAXIMO']); assert.equal(nuevo.datos.descuento_sugerido, 20);
  assert.ok((await a.get('/api/admin/ofertas-sugeridas')).datos.sugerencias.some((s) => s.id === nuevo.datos.id));
  assert.equal((await a.post('/api/admin/productos', { nombre: 'Malo', id_categoria: cat, costo: 50, precio: 10 })).status, 422, 'precio < costo');
  assert.equal((await a.post('/api/admin/productos', { nombre: 'XSS', id_categoria: cat, costo: 1, precio: 5, imagen_url: 'javascript:alert(1)' })).status, 422);
  const aj = await a.post(`/api/admin/productos/${nuevo.datos.id}/stock`, { delta: -8 }); assert.deepEqual(aj.datos.alertas, ['MINIMO']);
  assert.equal((await a.post(`/api/admin/productos/${nuevo.datos.id}/stock`, { delta: -50 })).status, 409, 'no deja stock negativo');
  const pv = (await a.get('/api/admin/proveedores')).datos.proveedores[0].id, ins = (await a.get('/api/admin/insumos')).datos.insumos[0];
  const c = await a.post('/api/admin/compras', { id_proveedor: pv, items: [{ id_insumo: ins.id, cantidad: 10, costo_unitario: 20 }] }); assert.equal(c.datos.total, 200);
  assert.equal((await a.put(`/api/admin/compras/${c.datos.id}/recibir`)).status, 200);
  assert.equal((await a.put(`/api/admin/compras/${c.datos.id}/recibir`)).status, 409, 'no se recibe dos veces');
  assert.equal((await a.get('/api/admin/insumos')).datos.insumos.find((i) => i.id === ins.id).stock_actual, ins.stock_actual + 10);
  const rep = await a.get('/api/admin/reportes/ventas?desde=2020-01-01'); assert.equal(rep.status, 200); assert.ok(rep.datos.filas.length >= 1);
  const csv = await a.get('/api/admin/reportes/ventas?desde=2020-01-01&formato=csv'); assert.match(csv.datos.toString(), /dia,pedidos,total/);
  assert.equal((await a.put('/api/admin/fondo', { color_primario: 'rojo' })).status, 422);
  assert.equal((await a.put('/api/admin/fondo', { color_primario: '#e8a0b4' })).status, 200);
  assert.ok((await a.get('/api/admin/bitacora')).datos.eventos.length > 0);
  const ev = JSON.stringify((await a.get('/api/admin/bitacora')).datos.eventos); assert.ok(!/127\.0\.0\.1/.test(ev), 'la bitácora no guarda IP en claro');
});

test('privacidad: exportar y eliminar cuenta (ARCO), recuperación sin enumeración', async () => {
  const n = navegador(app.base); const [d1, d2] = await desafios(2, n);
  const r1 = await n.post('/api/auth/olvide', { correo: 'cliente@bakedelivery.local', ...d1 });
  const r2 = await n.post('/api/auth/olvide', { correo: 'noexiste@example.com', ...d2 });
  assert.equal(r1.datos.mensaje, r2.datos.mensaje);
  const tmp = navegador(app.base); const [d3] = await desafios(1, tmp);
  await tmp.post('/api/auth/registro', { nombre: 'Borrar Yo', correo: 'borrar@example.com', password: 'ClaveSegura123', acepta_privacidad: true, ...d3 });
  const ex = await tmp.get('/api/cuenta/exportar'); assert.equal(ex.status, 200); assert.equal(ex.datos.usuario.correo, 'borrar@example.com'); assert.ok(!('password_hash' in ex.datos.usuario));
  assert.equal((await tmp.del('/api/cuenta', { password: 'mala-mala-123' })).status, 422);
  assert.equal((await tmp.del('/api/cuenta', { password: 'ClaveSegura123' })).status, 200);
  assert.equal((await tmp.post('/api/auth/login', { correo: 'borrar@example.com', password: 'ClaveSegura123' })).status, 401);
});

test('contacto y seguimiento público', async () => {
  const n = navegador(app.base); const [d] = await desafios(1, n);
  assert.equal((await n.post('/api/contacto', { nombre: 'Ana', correo: 'ana@example.com', asunto: 'Pedido grande', mensaje: 'Quiero cotizar una mesa de dulces', acepta_privacidad: true, ...d })).status, 201);
  const s = await n.get('/api/seguimiento/bddemo0001'); assert.equal(s.status, 200); assert.ok(!('id_direccion' in s.datos.envio));
  assert.equal((await n.get('/api/seguimiento/NOEXISTE')).status, 404);
});
