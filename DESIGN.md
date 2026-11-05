---
name: BakeDelivery
description: Papel de seda a una tinta roja, con el pastel real encima.
colors:
  rosa: "#c4122f"
  rosa-osc: "#970b22"
  rosa-claro: "#fde4e7"
  blush: "#f9d5da"
  crema: "#fff7f4"
  blanco: "#fffdfc"
  texto: "#3a0d14"
  suave: "#6e3a42"
  borde: "#f1c4cb"
  linea: "#b7636f"
  ok: "#1f6237"
  error: "#8f0a1e"
  aviso: "#754a00"
typography:
  marca-pie:
    fontFamily: "Shrikhand, Georgia, serif"
    fontSize: "min(13.2vw, 12rem)"
    fontWeight: 400
    lineHeight: 0.92
  display:
    fontFamily: "Shrikhand, Georgia, serif"
    fontSize: "clamp(2.3rem, min(5.2vw, 9svh), 5.2rem)"
    fontWeight: 400
    lineHeight: 1.12
  headline:
    fontFamily: "Shrikhand, Georgia, serif"
    fontSize: "clamp(2.2rem, 5vw, 3.6rem)"
    fontWeight: 400
    lineHeight: 1.08
  title:
    fontFamily: "Shrikhand, Georgia, serif"
    fontSize: "clamp(1.7rem, 3.4vw, 2.5rem)"
    fontWeight: 400
    lineHeight: 1.08
  subtitle:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "1.12rem"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.55
  button:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
  label:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "0.84rem"
    fontWeight: 700
rounded:
  radio: "3px"
  foto: "0"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  seccion: "48px"
  banda: "72px"
components:
  button-primary:
    backgroundColor: "{colors.rosa}"
    textColor: "#ffffff"
    typography: "{typography.button}"
    rounded: "{rounded.radio}"
    padding: "11px 22px"
    height: "46px"
  button-primary-hover:
    backgroundColor: "{colors.rosa-osc}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.rosa}"
    typography: "{typography.button}"
    rounded: "{rounded.radio}"
    padding: "11px 22px"
    height: "46px"
  button-secondary-hover:
    backgroundColor: "{colors.rosa-claro}"
    textColor: "{colors.rosa-osc}"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.error}"
    typography: "{typography.button}"
    rounded: "{rounded.radio}"
    padding: "11px 22px"
    height: "46px"
  button-small:
    typography: "{typography.button}"
    rounded: "{rounded.radio}"
    padding: "6px 14px"
    height: "36px"
  input:
    backgroundColor: "{colors.blanco}"
    textColor: "{colors.texto}"
    typography: "{typography.body}"
    rounded: "{rounded.radio}"
    padding: "11px 14px"
    height: "46px"
  tab-selected:
    backgroundColor: "{colors.rosa}"
    textColor: "#ffffff"
    padding: "10px 16px"
  date-tag:
    backgroundColor: "{colors.crema}"
    textColor: "{colors.rosa}"
    typography: "{typography.label}"
    rounded: "{rounded.foto}"
    padding: "5px 12px"
  panel-card:
    backgroundColor: "{colors.blanco}"
    textColor: "{colors.texto}"
    rounded: "{rounded.radio}"
    padding: "24px"
---

# Design System: BakeDelivery

## Overview

**Creative North Star: "Papel de seda en línea roja"**

La tienda es lo que se ve al abrir la caja: papel de seda dibujado a una tinta roja, con el pastel real encima. El papel cubre la página con cupcakes, frascos, corazones, flechas, mangas y rebanadas a línea; las fotos se apoyan sobre él sin marco, un poco giradas, como puestas a mano. Rechaza el hero partido con botón y la fila de tarjetas iguales.

Hay dos densidades sobre la misma base. La tienda que vende (inicio, catálogo, producto) es grande, suelta y fotográfica. Lo operativo (carrito, checkout, cuenta, formularios y panel) hereda los mismos tokens, pero se ordena en superficies claras con borde fino, tablas y campos de 46px. El panel admin se queda sin papel de fondo: ahí se trabaja, no se antoja.

**Key Characteristics:**
- Una sola tinta decorativa: todo dibujo y toda línea salen del mismo rojo cereza.
- Foto real, cuadrada de esquinas y levemente girada, siempre por encima de la interfaz.
- Shrikhand para lo que se dice en voz alta, Figtree para todo lo que se opera.
- Relleno rojo escaso: señala qué hacer y qué está activo.
- Esquinas casi rectas (3px) y línea de 1.5px, como corte y trazo sobre papel.

## Colors

Una tinta cereza sobre papel rosado muy claro, con un vino oscuro como texto; los colores de estado solo aparecen para informar.

### Primary
- **Tinta Cereza** (#c4122f): títulos Shrikhand, enlaces, línea de 1.5px, dibujos a línea y relleno de acción principal o de lo activo. El texto blanco sobre ella da 6.04:1.
- **Cereza Profunda** (#970b22): hover de botones y enlaces.
- **Cereza Lavada** (#fde4e7): fondo de hover del botón secundario, fondo de avisos y base de la foto mientras carga.

### Secondary
- **Blush de Mármol** (#f9d5da): fondo del pie y enlaces sobre la barra oscura del panel. Sale del mármol de las fotos.

### Neutral
- **Papel** (#fff7f4): fondo de la página y de las bandas sin dibujos, bajo el mosaico de `papel.svg`.
- **Blanco Cálido** (#fffdfc): superficies operativas, campos, tablas y aviso de cookies.
- **Vino** (#3a0d14): texto principal, ocasiones en reposo, barra del panel y toasts.
- **Vino Suave** (#6e3a42): metadatos, migas, ayuda y placeholders.
- **Borde Rosado** (#f1c4cb): línea fina de 1px en tarjetas, tablas y separadores operativos.
- **Línea de Campo** (#b7636f): borde de campos en reposo.

### Estados
- **Hecho** (#1f6237), **Error** (#8f0a1e), **Pendiente** (#754a00): insignias, avisos, toasts y calificación. Comunican estado; no decoran.

### Named Rules
**La Regla del Rojo Sólido.** El relleno rojo sólido marca la acción principal y lo activo o elegido, y nada más: botón primario, pestaña seleccionada, entrada actual del menú del panel, paso cumplido del seguimiento. Si un elemento no es lo que hay que pulsar ni lo que está activo, va a línea. La etiqueta de descuento, la insignia de error y las barras de la gráfica hoy van rellenas: son desviaciones del build, no precedente.

**La Regla de la Tinta Única.** Los dibujos existen en una sola tinta (#c4122f), a trazo y sin relleno. En el papel va al 17% de opacidad con trazo de 2.4; en línea dentro de una frase, al 100% con trazo de 2.6. Ninguna ilustración introduce un segundo color.

## Typography

**Display Font:** Shrikhand (con Georgia, serif)
**Body Font:** Figtree (con system-ui, -apple-system, Segoe UI, Roboto, sans-serif)

**Character:** Shrikhand es una itálica gorda, de rótulo de pastelería, con mucha voz y un solo peso. Figtree es geométrica y amable, y hace que precios, fechas y formularios se lean sin esfuerzo. Ambas se sirven desde `compartido/fuentes/`.

### Hierarchy
- **Marca del pie** (400, `min(13.2vw, 12rem)`, 0.92): cierre de cada página de la tienda, decorativo y oculto a lectores de pantalla.
- **Display** (400, `clamp(2.3rem, min(5.2vw, 9svh), 5.2rem)`, 1.12): las ocasiones de la portada.
- **Headline** (400, `clamp(2.2rem, 5vw, 3.6rem)`, 1.08): h1 de página. En la portada baja a `clamp(1.5rem, 2.4vw, 2.1rem)` para ceder el protagonismo a las ocasiones; en formularios estrechos, a `clamp(1.7rem, 3vw, 2.2rem)`.
- **Title** (400, `clamp(1.7rem, 3.4vw, 2.5rem)`, 1.08): h2 de sección.
- **Subtitle** (700, 1.12rem, 1.3): h3 y nombre del diseño, en Figtree y color de texto.
- **Body** (400, 17px, 1.55): texto corrido, con 46ch como medida en los párrafos de venta.
- **Label** (700, 0.84rem): etiquetas e insignias. Sin mayúsculas forzadas ni tracking.

Las cifras de precios, totales y contadores usan `tabular-nums`.

### Named Rules
**La Regla de las 6rem.** Ningún texto pasa de 6rem. La única excepción es la marca del pie, que cierra la página a todo lo ancho; las ocasiones, lo más grande después de ella, se detienen en 5.2rem.

**La Regla del Peso Único.** Shrikhand solo existe en 400 y `font-synthesis: none` impide simular negritas. El énfasis se da con tamaño o color, nunca con peso. Dentro del panel, los h2 pasan a Figtree 800.

## Layout

Contenedor de hasta 1200px con 16px de margen por lado. Las secciones se separan con 48px; las bandas de frase larga respiran 72px. Los diseños van en rejilla de 3 columnas con la columna central desplazada 44px, para que no se lea como fila de tarjetas; en inicio, un mosaico de 12 columnas deja una foto a 8 columnas y las demás a 4. Lo operativo usa dos columnas 1.4fr / 1fr con el resumen fijo a 92px del borde superior.

La respuesta móvil se apoya en 860px: la rejilla pasa a 2 columnas con las pares desplazadas 24px, y los bloques dobles se apilan. El menú colapsa a 900px, y los botones de cookies comparten fila bajo 560px. Toda foto y etiqueta conserva su giro en móvil. En el panel, el menú lateral de 240px se vuelve tira horizontal bajo 860px.

**La Regla de la Frase Limpia.** Una frase larga en Shrikhand va sobre Papel liso, sin el mosaico de dibujos debajo. El texto corto de la portada y las secciones sí puede vivir sobre el papel dibujado.

## Elevation & Depth

El sistema es plano salvo por lo que está físicamente puesto sobre el papel. Fotos, etiquetas de fecha, tarjetas y capas flotantes proyectan sombras suaves y cálidas teñidas de vino, con desplazamiento vertical y dispersión negativa. La interfaz de lectura y las bandas se separan con línea, no con sombra.

### Shadow Vocabulary
- **Foto puesta** (`box-shadow: 0 16px 28px -14px rgba(58, 13, 20, .42)`): fotos, toasts, aviso de cookies y hover de tarjetas enlazadas.
- **Apoyo leve** (`box-shadow: 0 8px 18px -12px rgba(58, 13, 20, .3)`): tarjetas, etiqueta de fecha y hover del botón primario.
- **Pliego** (`filter: drop-shadow(0 -7px 9px rgba(58, 13, 20, .2))`): el borde del papel que tapa la foto de portada.
- **Diálogo** (`box-shadow: 0 20px 60px rgba(58, 13, 20, .35)`): diálogos del panel.

### Named Rules
**La Regla de la Foto Puesta.** En las pantallas de venta, la foto no lleva marco, borde ni esquina redondeada: se sostiene con la sombra y un giro de entre 0.6° y 3°. Al apuntarla se endereza y sube 5px.

## Shapes

Todo lo que se pulsa o contiene tiene esquinas casi rectas (3px): botones, campos, tablas, avisos y tarjetas. Fotos y etiquetas sobre foto quedan con corte recto (0), como papel y fotografía. El único círculo es el punto de la línea de seguimiento. La diagonal del pliego (`clip-path`) es propia de la portada, no una forma general.

Hay dos pesos de línea: 1.5px de Tinta Cereza para divisiones con intención (encabezado, bandas, pie, pestañas, totales, botones) y 1px de Borde Rosado para contenedores operativos.

## Components

### Buttons
Firmes y directos: el rojo dice qué sigue y la línea ofrece lo demás.
- **Shape:** esquinas casi rectas (3px), borde de 1.5px y altura mínima de 46px.
- **Primary:** Tinta Cereza con texto blanco, Figtree 700. La variante grande es para el cierre de compra (14px 30px, 1.08rem).
- **Hover / Focus:** el primario pasa a Cereza Profunda con apoyo leve; el foco global es un contorno de 2.5px en Vino con 2px de separación.
- **Secondary:** transparente con línea roja, hover en Cereza Lavada. Sobre el pie y la barra del panel adopta Vino o Blush para conservar contraste.
- **Danger:** transparente con línea y texto de Error, porque no es la acción principal.
- **Disabled:** opacidad 0.55 y `not-allowed`.

### Aviso de cookies
**La Regla del Peso Igual.** "Aceptar analítica" y "Solo necesarias" llevan el mismo botón secundario. Aceptar y rechazar pesan lo mismo; ninguna opción se viste de acción principal. Bajo 560px se reparten la fila a partes iguales.

Es una capa fija de Blanco Cálido con línea roja de 1.5px y sombra de foto, centrada hasta 620px.

### Etiquetas e insignias
- **Etiqueta de fecha:** Papel con línea y texto cereza, corte recto, girada -2° y montada sobre la esquina inferior de la foto. Muestra la primera fecha real de entrega, calculada con la anticipación configurada.
- **Etiqueta de foto:** esquina superior izquierda, girada -3°; "Agotado" va en Vino.
- **Insignia:** a línea, 1px de borde y color del estado.

### Cards / Containers
- **Diseños:** no son tarjetas. La foto 4:5 va suelta sobre el papel, con nombre, sabor y precio debajo, y todo el bloque es enlace.
- **Superficies operativas:** Blanco Cálido, 3px, borde de 1px, 24px de padding y apoyo leve. Son para formularios, resúmenes y datos.

### Inputs / Fields
- **Style:** Blanco Cálido, línea de campo de 1.5px, 3px y 46px de altura; etiqueta en negrita arriba.
- **Focus:** borde y contorno de 2px en Tinta Cereza.
- **Error / Disabled:** borde y contorno en Error, con mensaje debajo en 0.92rem semibold.

### Navigation
Encabezado fijo de 68px sobre Papel liso, cerrado por línea cereza de 1.5px. Enlaces Figtree 600 en Vino; hover y página actual en cereza con subrayado separado 6px. El carrito es el único enlace con caja y se rellena de rojo solo en hover. Bajo 900px se abre con el botón "Menú", de 44px de alto.

### Pestañas
Texto Vino Suave sobre una línea cereza de 1.5px; la seleccionada se rellena de Tinta Cereza con texto blanco.

### Enlaces de ocasión
Signature de la portada: la ocasión es el enlace y la acción principal, en Display color Vino con su conteo en Figtree 600. Al apuntarla o enfocarla pasa a cereza, avanza 12px y cambia la foto, que sale del papel con un giro de -2.5° en 0.8s con la curva de salida. Sin puntero hace una sola pasada automática, salvo con movimiento reducido.

### Frase con trazos
Banda de Papel liso entre líneas cereza con una frase Shrikhand (hasta 3.5rem, 1.3) en la que los dibujos a línea se intercalan en el texto, a 1.25em y con `alt` vacío.

### Seguimiento
Línea vertical de 2px con puntos de 16px: pendientes en Borde Rosado, cumplidos en Tinta Cereza y el paso actual en negrita cereza.

## Do's and Don'ts

### Do:
- **Do** poner la foto real como el elemento más fuerte de cada pantalla de venta, sin marco y girada entre 0.6° y 3°.
- **Do** reservar el relleno rojo sólido para la acción principal y lo activo o elegido.
- **Do** dar el mismo botón secundario a las dos opciones del aviso de cookies.
- **Do** mantener todo el texto por debajo de 6rem, salvo la marca del pie.
- **Do** usar `var(--rosa)` y demás tokens: el panel puede sobrescribir `--rosa` y `--crema` desde su configuración.
- **Do** dibujar ilustraciones nuevas a línea, sin relleno, en #c4122f y con trazo redondeado.
- **Do** decir la fecha real de entrega junto a la foto o al pedido.
- **Do** resolver el movimiento con `--salida` y anularlo con `prefers-reduced-motion`.

### Don't:
- **Don't** resolver la portada con un hero partido y su botón, ni los diseños con una fila de tarjetas iguales.
- **Don't** enmarcar, redondear ni meter en una tarjeta con borde las fotos de producto.
- **Don't** usar el rojo sólido para decorar, para promociones ni para resaltar lo que no se pulsa ni está activo.
- **Don't** convertir "Aceptar analítica" en botón primario.
- **Don't** aplicar negritas a Shrikhand ni usarla en párrafos, precios o etiquetas de campo.
- **Don't** añadir un segundo color de tinta a dibujos o papel.
- **Don't** colocar una frase larga en Shrikhand sobre el papel dibujado.
- **Don't** usar sombras duras sin desenfoque.
- **Don't** escribir estilos en línea: la CSP los bloquea.
