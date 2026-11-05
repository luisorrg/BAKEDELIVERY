# Checklist "20 cosas antes de publicar" y hallazgos

| # | Punto | Estado | Dónde |
|---|---|---|---|
| 1 | Política de privacidad | ✔ (texto base, revisar con abogado) | `/privacidad` |
| 2 | Términos y condiciones | ✔ (texto base) | `/terminos` |
| 3 | Claves API / secretos fuera del código | ✔ | `.env` (gitignored), `npm run secretos`, `config.js` se niega a arrancar sin ellos, `npm run verificar:secretos` |
| 4 | HTTPS | ✔ en producción | redirección 308 + HSTS (`lib/web.js`) |
| 5 | Banner de cookies | ✔ | `<bd-cookies>`; GA4 solo carga con consentimiento |
| 6 | Meta descripciones | ✔ | cada página |
| 7 | Vista previa al compartir (Open Graph) | ✔ | `og:*`, `twitter:card`, `og.png` 1200×630 |
| 8 | Favicon | ✔ | SVG + icono 180 px |
| 9 | Sitemap y robots.txt | ✔ | dinámicos (`/sitemap.xml` incluye productos) |
| 10 | Texto ALT en imágenes | ✔ | verificado en navegador |
| 11 | Imágenes comprimidas | ✔ | fotos JPG de 120–300 KB y trazos SVG de ~1 KB, `loading="lazy"` |
| 12 | Velocidad | ✔ | gzip/brotli, caché de estáticos, sin frameworks ni fuentes externas |
| 13 | Contraste de color | ✔ | revisado automáticamente (WCAG AA) |
| 14 | Móvil | ✔ | sin desbordes a 375 px, menú plegable |
| 15 | Página 404 | ✔ | `tienda/404.html` |
| 16 | Enlaces rotos | ✔ | rastreados 33 enlaces internos: 0 rotos |
| 17 | Validación de formularios | ✔ | cliente (HTML5) + servidor (`validar`) con errores por campo |
| 18 | Anti-spam | ✔ | desafío firmado + tiempo mínimo + un solo uso + honeypot + límites de peticiones |
| 19 | Analytics (GA4) | ✔ opcional | `GA_MEASUREMENT_ID`; IP anonimizada; solo con consentimiento |
| 20 | CTA claro | ✔ | "Pide tu pastel", "Agregar al carrito", "Confirmar pedido" |

## Otras protecciones
CSP estricta (sin scripts ni estilos en línea), CSRF (doble cookie + Origin), cookie de sesión httpOnly/SameSite, contraseñas con scrypt, errores de login genéricos con tiempo igualado, bloqueo por intentos, límite anti *card-testing*, nunca se guarda PAN/CVV, consultas parametrizadas, bitácora con IP en hash, derechos ARCO (exportar y eliminar cuenta), usuario de BD con permisos mínimos.

## Hallazgos en los servicios originales
- Varios `.env` con credenciales **incluida una contraseña de Gmail** dentro de los .rar → **rotarla ya**.
- Todos escuchaban en el puerto 3000 y usaban bases distintas → unificados.
- Servicios sin autenticación/validación de entradas → ahora todo pasa por sesión, rol, CSRF y validación.
