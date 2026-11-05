# BakeDelivery — tienda en línea de repostería (versión preliminar)

Dos sitios en uno, con un solo backend:

| Quién | Dónde | Qué hace |
|---|---|---|
| **Comprador** | `http://localhost:3000/` | Catálogo, ofertas, personalizar pasteles, carrito, pago, seguimiento, cuenta, postventa |
| **Vendedor** | `http://localhost:3000/admin` | Pedidos, productos, inventario y alertas, compras/proveedores, postventa, reportes, usuarios, apariencia |

```
BAKEDELIVERY/
├── BACKEND/    Node 22 (API + servidor web). Sin frameworks: solo mysql2 (nodemailer opcional)
├── DATABASE/   bd02_reposteria.sql (MySQL 8, 35 tablas) + diagrama
├── FRONTEND/   tienda/ (cliente) · admin/ (vendedor) · compartido/ (CSS, Web Components, imágenes)
└── DOCS/       SERVICIOS.md (qué servicio vive dónde) · SEGURIDAD.md (checklist de 20 puntos)
```

## Probarlo en 1 minuto (sin MySQL)
```bash
cd BACKEND
node scripts/demo.js        # Node >= 22.5. Base SQLite en memoria + datos de ejemplo
```
Abre http://localhost:3000. La consola imprime las contraseñas de los 3 usuarios de ejemplo (se generan al azar en cada arranque).

## Instalación real (MySQL)
```bash
cd BACKEND
npm install
npm run secretos            # crea .env con JWT_SECRET, BOT_SECRET y contraseñas de BD (nunca se suben a Git)
docker compose up -d        # MySQL 8 local (o usa tu propio MySQL y ajusta .env)
npm run db:crear            # solo si NO usas docker (con docker el SQL se carga solo)
npm run seed                # datos de ejemplo; muestra las contraseñas UNA vez
npm start
```
Pruebas automáticas: `npm test` (18 pruebas: seguridad, compra completa, panel, privacidad). Revisión de secretos en el código: `npm run verificar:secretos`.

## Reglas de negocio (configurables en `.env`)
Pedidos con **24 h** de anticipación · envío **$50** (gratis desde **$600**) · devolución hasta **3 días** · garantía **7 días** · bloqueo de cuenta tras **5** intentos fallidos (15 min).

## Tarjetas de prueba (pasarela simulada, no hay cargos reales)
`4242 4242 4242 4242` aprobada · `…0002` rechazada · `…9995` sin fondos · `…0341` se registra pero **rechaza al pagar**. Fecha futura y CVV de 3 dígitos (Amex: 4).

## Antes de publicar (pendientes reales)
1. **Rotar la contraseña de aplicación de Gmail** que venía en el `.env` de los servicios originales (quedó expuesta en el .rar) y no reutilizarla.
2. Reemplazar la pasarela simulada (`BACKEND/src/lib/pasarela.js`) por Stripe/Conekta/Mercado Pago con campos seguros del proveedor (PCI-DSS).
3. Que un abogado revise aviso de privacidad, términos y cookies (son textos base).
4. Poner el sitio detrás de HTTPS (`NODE_ENV=production`, `BASE_URL=https://…`, `TRUST_PROXY=1` si hay proxy) y configurar SMTP.
5. Contador de intentos y límites de peticiones están en memoria: con varias instancias usar Redis.
