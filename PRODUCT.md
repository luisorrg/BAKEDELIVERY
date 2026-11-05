# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Personas en Los Mochis, Sinaloa, que encargan un pastel o postres para una fecha concreta: cumpleaños, baby shower, Día de las Madres, Día del Padre, San Valentín. Llegan normalmente desde el teléfono. Además, el personal de la repostería (admin y repostero) usa un panel para pedidos, inventario y reportes.

## Product Purpose

Tienda en línea de repostería por encargo: el cliente elige un diseño real, lo adapta con mensaje y decoración, programa la entrega con 24 h de anticipación y sigue su pedido. Éxito: que el cliente encuentre un diseño para su ocasión y complete el encargo sin escribir por mensaje.

## Positioning

Cada diseño es un pastel que la repostería ya hizo, fotografiado en su propio set, y se pide adaptado a la ocasión. No es un catálogo genérico de sabores.

## Operating Context

Compra por encargo con anticipación mínima de 24 h. Entrega a domicilio ($50, gratis desde $600) o recogida en tienda. Devolución a 3 días y garantía de 7 días. Pago con pasarela simulada por ahora.

## Capabilities and Constraints

- HTML + JS + Web Components sin frameworks; DOM armado con `h()`; CSP estricta, sin estilos en línea.
- Catálogo, carrito, personalización, checkout, seguimiento, cuenta (ARCO), reseñas, devoluciones y panel admin.
- La compra se organiza por ocasión; cada producto es un diseño base personalizable.
- Precios, porciones y sabores del catálogo son de ejemplo hasta que el negocio los confirme.

## Brand Commitments

- Nombre: BakeDelivery.
- Voz: español de México, cercana y clara.
- Las fotos con etiqueta de otra marca se recortan para que no se vea.

## Evidence on Hand

12 fotos reales de producto en `FRONTEND/compartido/img/fotos/`. No hay testimonios, cifras de clientes ni premios: no inventarlos. Fuera del sitio por decisión del usuario: pastel con el rostro de un cantante, pastel de Teen Titans con el nombre de un niño y mini pastel con la foto de una pareja.

## Product Principles

- La foto real manda; la interfaz la acompaña.
- La ocasión guía la búsqueda, no la taxonomía interna.
- Fecha, anticipación y costos se dicen antes de pagar, sin sorpresas.
- Privacidad y seguridad no se cambian por estética.

## Accessibility & Inclusion

Contraste AA, navegación por teclado, ALT en imágenes y uso cómodo en móvil sin scroll horizontal.
