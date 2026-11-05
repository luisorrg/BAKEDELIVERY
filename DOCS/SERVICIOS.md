# Dónde quedó cada servicio de SERVICIOS.rar

Los servicios venían en distintos lenguajes (Node, TypeScript, Python, C#), cada uno en el puerto 3000 y con su propia base. Se **unificaron por funcionalidad** en un solo backend sobre BD02 (no se copiaron línea por línea; se reimplementaron con la misma lógica de negocio).

| Servicio original | Dónde vive ahora |
|---|---|
| microservicio-login | `BACKEND/src/rutas/acceso.js` → `/api/auth/login` (cookie httpOnly + JWT, bloqueo por intentos) |
| servicio-roles · servicio-verificacion-rol | `servicios/sesion.js` → `requerirRol('ADMIN','REPOSTERO')`; roles en tabla `ROLES` |
| verificacion-bot | `lib/auth.js` (`crearVerificadorBot`) + componente `<bd-desafio>` (suma firmada + honeypot) |
| soa-servicio-reset-password | `acceso.js` → `/api/auth/olvide`, `/restablecer` (token de 30 min guardado como hash) |
| Inventario · CRUD INVENTARIO · soa-agregar-producto | `rutas/admin.js` → productos, categorías, stock, recetas, insumos |
| AlertaStockMinimo · MicroservicioStockMaxOfertas | `servicios/tienda.js` → `evaluarAlertas`, `descuentoSugerido` (20 % al máximo, 10 % desde 80 %) |
| servicio_proveedores | `admin.js` → `/api/admin/proveedores` |
| servicio-reporte-compras | `admin.js` → `/api/admin/compras`, `/reportes/*` (con CSV) |
| comentarios-resenas-service | `cliente.js` + `publico.js` → reseñas (solo quien compró) |
| DEVOLUCIONES MATA · garantias-devoluciones | `cliente.js` + `admin.js` → devoluciones y garantías con plazos |
| empaquetado-service | `admin.js` → `/pedidos/:id/empaque` |
| RegistroPedidosService | `tienda.js` → `confirmarPedido` (transacción: pedido + pago + venta + stock + envío) |
| serviciopago · servicio-verificacion-tarjeta | `lib/tarjeta.js`, `lib/pasarela.js`, `cliente.js` → `/api/tarjetas` |
| microservicio-historial-compras | `cliente.js` → `/api/mis-pedidos` |
| Servicio_Generar_Ticket | `lib/pdf.js` + `tienda.js` → ticket PDF de 80 mm |
| Parcial_1 (comprobante por correo) | `tienda.js` → `enviarComprobante` (SMTP o bandeja) |
| logistica_envios_python · microservicio-validacion-entregas | `admin.js` → `/envios/:id` y `/entregado`; `publico.js` → `/seguimiento/:guia` |
| domicilio | `cliente.js` → `/api/direcciones` |
| Servicio_Fondo | `admin.js` → `/api/admin/fondo` + `base.js` aplica colores |
| Encabezado · SOA Pie de página · biblioteca-menu | `compartido/js/componentes.js` (`<bd-encabezado>`, `<bd-pie>`) |
| "Botones" (servicio 28) | **No venía en el .rar**; los botones están en `compartido/css/base.css` (`.btn-*`) |
