// Datos de ejemplo. Las contraseñas se generan al azar (a menos que se indiquen) y se devuelven una sola vez.
import { hashPassword, tokenAleatorio } from '../lib/auth.js';
import { aFechaBd, soloFecha, sumarHoras } from '../lib/util.js';
import { evaluarAlertas } from './tienda.js';

// Precios, porciones y sabores de ejemplo hasta que el negocio los confirme.
const PRODUCTOS = [
  // cat, nombre, sabor, porciones, costo, precio, stock, min, max, personalizable, imagen, descripción
  ['Cumpleaños', 'Rosa brillo con moños', 'Vainilla', 12, 240, 520, 5, 2, 8, 1, 'brillo-rosa', 'Cubierta rosa con brillo, borde de betún rizado, perlas doradas, moños de listón y letrero de acrílico.'],
  ['Cumpleaños', 'Mesa rosa: pastel y cupcakes', 'Vainilla y fresa', 22, 360, 780, 4, 1, 6, 1, 'mesa-rosa', 'Pastel rosa estilo vintage con moños y una docena de cupcakes con chispas a juego.'],
  ['Cumpleaños', 'Corazón de chocoflan', 'Chocolate y flan', 8, 160, 360, 6, 2, 8, 1, 'chocoflan-corazon', 'Chocoflan en forma de corazón con borde de betún de chocolate, chispas de corazones y letrero dorado.'],
  ['Cumpleaños', 'Zanahoria con nuez', 'Zanahoria', 12, 190, 420, 5, 2, 8, 1, 'zanahoria', 'Dos capas de pan de zanahoria con betún en gotas y nuez picada.'],
  ['Baby shower', 'Ositos: ¿niño o niña?', 'Vainilla', 12, 250, 560, 4, 2, 6, 1, 'ositos', 'Betún blanco con pinceladas rosa y azul, hoja dorada, esferas y dos ositos.'],
  ['Baby shower', 'Pequeño marinero', 'Vainilla', 12, 240, 540, 4, 2, 6, 1, 'marinero', 'Betún rayado blanco y azul con velero, faro y osito marinero. Pon los meses o años que cumple.'],
  ['Mamá y papá', 'Jardín lavanda', 'Chocolate', 12, 260, 580, 4, 2, 6, 1, 'lavanda-mama', 'Betún lavanda rayado, tierra de chocolate y flores decorativas, con letrero de acrílico dorado.'],
  ['Mamá y papá', 'Chocoflan para papá', 'Chocolate y flan', 8, 150, 340, 6, 2, 8, 1, 'chocoflan-papa', 'Chocoflan con corona de betún de chocolate, perlas azules y doradas y disco dorado con mensaje.'],
  ['San Valentín', 'Caja de 6 cupcakes de corazones', 'Chocolate', 6, 95, 220, 12, 4, 20, 1, 'cupcakes-seis', 'Cupcakes de chocolate con betún blanco, chispas de corazones y un letrero para dedicar.'],
  ['San Valentín', 'Caja de 4 cupcakes de corazones', 'Chocolate', 4, 70, 160, 14, 4, 20, 1, 'cupcakes-cuatro', 'Cupcakes de chocolate con betún blanco, corazón de azúcar y un letrero dorado.'],
  ['Antojos', 'Charola de galleta con chocolate', 'Galleta y chocolate', 1, 40, 95, 25, 8, 40, 0, 'charola-oreo', 'Crema batida, migas de galleta negra y salsa de chocolate en charola individual con tapa.'],
  ['Antojos', 'Charola de galleta caramelizada', 'Galleta caramelizada', 1, 40, 95, 25, 8, 40, 0, 'charola-galleta', 'Crema batida, galleta caramelizada entera y en migas, con salsa de chocolate.'],
];
const INSUMOS = [['Harina de trigo', 'kg', 25, 10, 60, 18], ['Azúcar', 'kg', 20, 10, 50, 22], ['Mantequilla', 'kg', 4, 5, 20, 140], ['Huevo', 'pza', 90, 60, 300, 3.5], ['Cacao en polvo', 'kg', 6, 2, 12, 210], ['Crema para batir', 'l', 8, 4, 20, 65], ['Queso crema', 'kg', 3, 3, 12, 130], ['Fresas', 'kg', 5, 3, 10, 70]];

export async function sembrar(db, { adminPass, clientePass, reposteroPass } = {}) {
  const claves = { admin: adminPass || tokenAleatorio(9) + '7a', repostero: reposteroPass || tokenAleatorio(9) + '5b', cliente: clientePass || tokenAleatorio(9) + '3c' };
  const f = aFechaBd();
  const rol = async (n) => (await db.one('SELECT id FROM ROLES WHERE nombre_rol = ?', [n])).id;
  const usuario = async (nombre, correo, pass, r) => (await db.run("INSERT INTO USUARIOS (nombre, correo, telefono, password_hash, id_rol, estado, fecha_registro) VALUES (?,?,?,?,?,'activo',?)", [nombre, correo, '6680000000', await hashPassword(pass), await rol(r), f])).insertId;
  await usuario('Administrador', 'admin@bakedelivery.local', claves.admin, 'ADMIN');
  await usuario('Rosa Repostera', 'repostero@bakedelivery.local', claves.repostero, 'REPOSTERO');
  const uc = await usuario('Clara Cliente', 'cliente@bakedelivery.local', claves.cliente, 'CLIENTE');
  const idCliente = (await db.run('INSERT INTO CLIENTES (id_usuario) VALUES (?)', [uc])).insertId;
  await db.run('INSERT INTO DIRECCIONES (id_cliente, calle_numero, colonia, ciudad, codigo_postal, referencias) VALUES (?,?,?,?,?,?)', [idCliente, 'Av. Los Mochis 123', 'Centro', 'Los Mochis', '81200', 'Portón blanco']);

  const prov = (await db.run('INSERT INTO PROVEEDORES (nombre, razon_social, rfc, correo, telefono) VALUES (?,?,?,?,?)', ['Insumos del Valle', 'Insumos del Valle SA de CV', 'IVA010101AB1', 'ventas@insumosvalle.example', '6681112233'])).insertId;
  for (const [n, u, a, mi, ma, c] of INSUMOS) { const id = (await db.run('INSERT INTO INSUMOS (nombre, unidad_medida, stock_actual, stock_minimo, stock_maximo, costo_unitario, id_proveedor) VALUES (?,?,?,?,?,?,?)', [n, u, a, mi, ma, c, prov])).insertId; await evaluarAlertas(db, { idInsumo: id }); }

  const ids = [];
  // Se insertan al revés porque el catálogo muestra primero lo más nuevo.
  for (const [cat, nombre, sabor, porc, costo, precio, st, mi, ma, pers, img, desc] of [...PRODUCTOS].reverse()) {
    const c = await db.one('SELECT id FROM CATEGORIAS WHERE nombre = ?', [cat]);
    const id = (await db.run('INSERT INTO PRODUCTOS (id_categoria, nombre, descripcion, sabor, porciones, costo, precio, es_personalizable, activo, imagen_url) VALUES (?,?,?,?,?,?,?,?,1,?)', [c.id, nombre, desc, sabor, porc, costo, precio, pers, `/compartido/img/fotos/${img}.jpg`])).insertId;
    await db.run('INSERT INTO STOCK (id_producto, stock_actual, stock_minimo, stock_maximo) VALUES (?,?,?,?)', [id, st, mi, ma]);
    await evaluarAlertas(db, { idProducto: id }); ids.push(id);
  }
  ids.reverse();
  await db.run("INSERT INTO PROMOCIONES (id_producto, porcentaje_descuento, motivo, fecha_inicio, fecha_fin, activa) VALUES (?,?,?,?,?,1)", [ids[11], 15, 'Oferta de la semana', soloFecha(new Date(Date.now() - 864e5)), soloFecha(new Date(Date.now() + 30 * 864e5))]);

  // Un pedido ya entregado para poder probar reseñas, devoluciones y garantías.
  const tp = await db.one("SELECT id FROM TIPOS_PAGO WHERE nombre LIKE 'Efectivo%'");
  const dir = await db.one('SELECT id FROM DIRECCIONES WHERE id_cliente = ?', [idCliente]);
  const hace = aFechaBd(sumarHoras(new Date(), -30));
  const car = (await db.run("INSERT INTO CARRITO (id_cliente, fecha_creacion, estado) VALUES (?,?,'convertido')", [idCliente, hace])).insertId;
  const ped = (await db.run("INSERT INTO PEDIDOS (id_carrito, id_cliente, id_direccion, id_tipo_pago, tipo_entrega, fecha_pedido, fecha_entrega_programada, costo_envio, total, estado) VALUES (?,?,?,?,'DOMICILIO',?,?,?,?,'entregado')", [car, idCliente, dir.id, tp.id, hace, aFechaBd(sumarHoras(new Date(), -6)), 50, 570])).insertId;
  const v = (await db.run('INSERT INTO VENTAS (id_pedido, id_cliente, fecha, total) VALUES (?,?,?,?)', [ped, idCliente, hace, 570])).insertId;
  await db.run('INSERT INTO DETALLE_VENTAS (id_venta, id_producto, cantidad, precio_unitario) VALUES (?,?,?,?)', [v, ids[0], 1, 520]);
  await db.run('INSERT INTO PAGOS (id_pedido, id_tipo_pago, monto, estado, fecha) VALUES (?,?,?,?,?)', [ped, tp.id, 570, 'aprobado', hace]);
  await db.run('INSERT INTO COMPROBANTES (id_venta, folio, fecha_emision, enviado_correo) VALUES (?,?,?,0)', [v, `BD-DEMO-${String(v).padStart(5, '0')}`, hace]);
  const env = (await db.run("INSERT INTO ENVIOS (id_venta, id_direccion, num_guia, estado, fecha_estimada_entrega) VALUES (?,?,'BDDEMO0001','entregado',?)", [v, dir.id, hace])).insertId;
  await db.run("INSERT INTO VALIDACION_ENTREGA (id_envio, fecha_entrega_real, evidencia, estado) VALUES (?,?,'Recibió Clara','entregado')", [env, aFechaBd(sumarHoras(new Date(), -6))]);
  await db.run('UPDATE STOCK SET stock_actual = stock_actual WHERE id_producto = ?', [ids[0]]);
  return claves;
}
