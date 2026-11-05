import test from 'node:test';
const ANIO = new Date().getFullYear() + 3;
import assert from 'node:assert/strict';
import { validar, aFechaBd } from '../src/lib/util.js';
import { crearVerificadorBot, firmarJwt, verificarJwt, hashPassword, verificarPassword, crearLimiteIntentos } from '../src/lib/auth.js';
import { crearConfig } from '../src/config.js';
import { verificarDatosTarjeta } from '../src/lib/tarjeta.js';
import { descuentoSugerido } from '../src/servicios/tienda.js';
import { crearPdf } from '../src/lib/pdf.js';

test('validar: limpia, convierte y reporta errores por campo', () => {
  assert.deepEqual(validar({ n: ' Ana ', e: 'A@B.CO', k: '3' }, { n: { t: 'texto', req: true }, e: { t: 'email' }, k: { t: 'entero' } }), { n: 'Ana', e: 'a@b.co', k: 3 });
  assert.throws(() => validar({ e: 'mal', k: 1.5 }, { n: { t: 'texto', req: true }, e: { t: 'email' }, k: { t: 'entero' } }), (x) => x.status === 422 && !!(x.extra.errores.n && x.extra.errores.e && x.extra.errores.k));
  assert.throws(() => validar({ n: { $ne: 1 } }, { n: { t: 'texto' } }), (x) => !!x.extra.errores.n); // objetos no pasan
  assert.throws(() => validar({ p: 'corta1' }, { p: { t: 'password' } }));
});
test('contraseñas scrypt y JWT', async () => {
  const h = await hashPassword('Secreta12345');
  assert.ok(await verificarPassword('Secreta12345', h)); assert.ok(!(await verificarPassword('otra', h)));
  const t = firmarJwt({ sub: 1 }, 'x'.repeat(32), 5);
  assert.equal(verificarJwt(t, 'x'.repeat(32)).sub, 1);
  assert.equal(verificarJwt(t, 'y'.repeat(32)), null);
  assert.equal(verificarJwt(t.slice(0, -2) + 'AA', 'x'.repeat(32)), null);
  assert.equal(verificarJwt(firmarJwt({ sub: 1 }, 'x'.repeat(32), -1), 'x'.repeat(32)), null);
});
test('anti-bot: respuesta, tiempo mínimo y un solo uso', () => {
  let ahora = 1000; const bot = crearVerificadorBot('s'.repeat(32), { ahora: () => ahora });
  const d = bot.crearDesafio(); const [a, b] = d.pregunta.match(/\d+/g).map(Number);
  assert.equal(bot.verificar(d.token, a + b), false, 'demasiado rápido'); ahora += 2000;
  assert.equal(bot.verificar(d.token, a + b + 1), false, 'respuesta mala');
  assert.equal(bot.verificar(d.token, a + b), true);
  assert.equal(bot.verificar(d.token, a + b), false, 'no se reutiliza');
  assert.equal(bot.verificar(d.token.slice(0, -3) + 'abc', a + b), false, 'firma alterada');
});
test('config se niega a arrancar con secretos inseguros', () => {
  assert.throws(() => crearConfig({}), /JWT_SECRET/);
  assert.throws(() => crearConfig({ JWT_SECRET: 'a'.repeat(32), BOT_SECRET: 'a'.repeat(32) }), /distintos/);
  assert.throws(() => crearConfig({ NODE_ENV: 'production', JWT_SECRET: 'a'.repeat(32), BOT_SECRET: 'b'.repeat(32), BASE_URL: 'http://x.com' }), /DB_PASSWORD|https/);
  assert.ok(crearConfig({ JWT_SECRET: 'a'.repeat(32), BOT_SECRET: 'b'.repeat(32) }).reglas.horasAnticipacion === 24);
});
test('tarjeta: Luhn, marca, vencimiento y CVV', () => {
  assert.ok(verificarDatosTarjeta({ numero: '4242 4242 4242 4242', mes: 12, anio: ANIO, cvv: '123' }).valida);
  assert.ok(!verificarDatosTarjeta({ numero: '4242424242424241', mes: 12, anio: ANIO, cvv: '123' }).valida);
  assert.ok(!verificarDatosTarjeta({ numero: '4242424242424242', mes: 1, anio: 2020, cvv: '123' }).valida);
  assert.ok(verificarDatosTarjeta({ numero: '378282246310005', mes: 12, anio: ANIO, cvv: '1234' }).valida);
  assert.ok(!verificarDatosTarjeta({ numero: '378282246310005', mes: 12, anio: ANIO, cvv: '123' }).valida);
});
test('ofertas por sobrestock y límite de intentos', () => {
  assert.equal(descuentoSugerido(10, 10), 20); assert.equal(descuentoSugerido(8, 10), 10); assert.equal(descuentoSugerido(5, 10), 0); assert.equal(descuentoSugerido(5, 0), 0);
  const l = crearLimiteIntentos({ max: 2, ventanaMin: 1 }); l.fallo('a'); assert.equal(l.bloqueado('a'), 0); l.fallo('a'); assert.ok(l.bloqueado('a') > 0); l.reiniciar('a'); assert.equal(l.bloqueado('a'), 0);
});
test('PDF del ticket es válido', () => {
  const p = crearPdf([{ t: 'Prueba ñ é', b: true }, { t: 'a', d: '$1.00' }]).toString('latin1');
  assert.ok(p.startsWith('%PDF-1.4') && p.includes('%%EOF') && p.includes('xref'));
});
test('aFechaBd formatea UTC', () => assert.equal(aFechaBd(new Date('2026-01-02T03:04:05.006Z')), '2026-01-02 03:04:05.006'));
