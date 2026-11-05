import { aFechaBd } from '../lib/util.js';
/** Registro de eventos de seguridad. La IP se guarda solo como hash. */
export const crearBitacora = (db) => async (req, evento, detalle = '', idUsuario = null) => {
  try { await db.run('INSERT INTO BITACORA_SEGURIDAD (evento, id_usuario, ip_hash, detalle, fecha) VALUES (?,?,?,?,?)', [evento, idUsuario ?? req.usuario?.id ?? null, req.ipHash, String(detalle).slice(0, 200), aFechaBd()]); }
  catch (e) { console.error('[bitacora]', e.message); }
};
export const esDuplicado = (e) => e?.code === 'ER_DUP_ENTRY' || /UNIQUE constraint/i.test(e?.message || '');
export const esErrorFk = (e) => e?.code === 'ER_ROW_IS_REFERENCED_2' || e?.code === 'ER_NO_REFERENCED_ROW_2' || /FOREIGN KEY constraint/i.test(e?.message || '');
