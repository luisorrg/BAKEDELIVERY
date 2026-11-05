// Google Analytics 4 SOLO si hay ID configurado y el visitante aceptó cookies de analítica.
const LLAVE = 'bd_consentimiento';
export const leerConsentimiento = () => { try { return JSON.parse(localStorage.getItem(LLAVE)); } catch { return null; } };
export function guardarConsentimiento(analitica) {
  try { localStorage.setItem(LLAVE, JSON.stringify({ analitica, fecha: new Date().toISOString() })); } catch { /* modo privado */ }
  if (!analitica) borrarCookiesGa();
}
function borrarCookiesGa() { for (const c of document.cookie.split('; ')) { const n = c.split('=')[0]; if (n.startsWith('_ga')) document.cookie = `${n}=; Max-Age=0; Path=/`; } }
let cargado = false;
export function iniciarAnalytics(gaId) {
  if (cargado || !gaId || !leerConsentimiento()?.analitica) return;
  cargado = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date()); window.gtag('config', gaId, { anonymize_ip: true });
  const s = document.createElement('script'); s.async = true; s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`; document.head.append(s);
}
export const evento = (nombre, datos = {}) => { if (cargado && window.gtag) window.gtag('event', nombre, datos); };
