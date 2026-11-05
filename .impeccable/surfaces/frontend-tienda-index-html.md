---
version: 1
slug: "frontend-tienda-index-html"
primary_target: "FRONTEND/tienda/index.html"
related_targets: []
---

# Tienda BakeDelivery

Alcance: tienda pública (FRONTEND/tienda). Inicio en modo Persuade; catálogo y producto venden; carrito, checkout, cuenta y panel admin heredan tokens en modo Operate.
Audiencia: quien encarga un pastel para una fecha concreta en Los Mochis, casi siempre desde el teléfono.
Trabajo: elegir ocasión, elegir diseño real, adaptarlo y apartar fecha.

## Direction contract

THESIS: La tienda es lo que se ve al abrir la caja: papel de seda dibujado a una tinta roja con el pastel real encima. Rechaza el hero partido con botón y la fila de tarjetas iguales.

OWN-WORLD: Papel #fff7f4 cubierto de dibujos a línea en tinta cereza #c4122f (cupcake, frasco, corazón, flecha, manga, rebanada), blush #f9d5da del mármol de las fotos y texto #3a0d14. Una sola tinta en la interfaz; el relleno rojo sólido se reserva para lo activo o elegido. Títulos en Shrikhand, interfaz en Figtree. Fotos sin marco, ligeramente giradas, como puestas sobre el papel.

STORY: La persona entiende que son pasteles reales por encargo, cree que hay uno para su ocasión, elige ocasión, luego diseño, y ve desde qué fecha puede recibirlo.

FIRST VIEWPORT: Sobre el papel, la pregunta "¿Qué vamos a celebrar?" y debajo las ocasiones como enlaces enormes en Shrikhand: son la acción principal y llevan al catálogo filtrado. A la derecha, foto real grande girada que sobresale por abajo, metida bajo un pliego de papel, con etiqueta de primera fecha de entrega. Apuntar una ocasión cambia la foto.

FORM: Papel de seda en línea roja, candidato 4 de 7, seed:26e363ea2174858d. Interacción insignia: la foto sale del papel al cambiar de ocasión. Raises: etiqueta de fecha viva por diseño (Calendario de conservas); una sola tinta (Escritorio de un bit); color reservado para lo activo (Mapa de orientación); papel en toda la página (Panel lowbrow); estados con nombre propio (Ciclorama); una voz de interfaz (Terminal de fósforo).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Decisiones de la ejecución

- El rojo sólido también marca la acción principal (botón primario), además de lo activo o elegido.
- El pie cierra con la marca a todo lo ancho en Shrikhand; es el único texto por encima de 6rem.
- La etiqueta de fecha se calcula con las horas de anticipación configuradas.
