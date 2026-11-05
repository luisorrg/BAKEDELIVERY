// Arranque común de todas las páginas: tema (servicio "fondo"), componentes y analítica con consentimiento.
import './componentes.js';
import { iniciarAnalytics } from './analytics.js';
import { configTienda } from './api.js';
export { configTienda };
configTienda().then((c) => {
  const f = c.fondo || {};
  if (/^#[0-9a-f]{6}$/i.test(f.color_primario)) document.documentElement.style.setProperty('--rosa', f.color_primario);
  if (/^#[0-9a-f]{6}$/i.test(f.color_fondo)) document.documentElement.style.setProperty('--crema', f.color_fondo);
  iniciarAnalytics(c.gaId);
  document.dispatchEvent(new CustomEvent('bd:config', { detail: c }));
});
document.addEventListener('bd:consentimiento', () => configTienda().then((c) => iniciarAnalytics(c.gaId)));
