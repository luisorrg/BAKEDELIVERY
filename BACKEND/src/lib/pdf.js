// Generador mínimo de PDF (texto, Helvetica) para tickets de 80 mm. Sin dependencias.
const ANCHO = 226.8, MARGEN = 12, INTERLINEA = 1.35;
const enc = (s) => Buffer.from(String(s), 'latin1').toString('latin1').replace(/[\\()]/g, (c) => '\\' + c).replace(/[^\x20-\xFF]/g, '?');
const anchoTexto = (t, tam, negrita) => [...t].reduce((a, c) => a + (/[ilI.,:;'|!]/.test(c) ? 0.28 : /[mwMW@]/.test(c) ? 0.85 : /[A-Z0-9]/.test(c) ? 0.62 : 0.52) * tam * (negrita ? 1.06 : 1), 0);

/** lineas: [{t, tam=9, b=false, al:'izq'|'centro'|'der'|'dos', d: texto derecho}] */
export function crearPdf(lineas) {
  const alto = MARGEN * 2 + lineas.reduce((a, l) => a + (l.tam || 9) * INTERLINEA, 0) + 10;
  let y = alto - MARGEN, ops = '';
  for (const l of lineas) {
    const tam = l.tam || 9; y -= tam * INTERLINEA;
    const f = l.b ? 'F2' : 'F1';
    const put = (t, x) => { ops += `BT /${f} ${tam} Tf ${x.toFixed(1)} ${y.toFixed(1)} Td (${enc(t)}) Tj ET\n`; };
    const w = anchoTexto(l.t || '', tam, l.b);
    if (l.al === 'centro') put(l.t, (ANCHO - w) / 2);
    else if (l.al === 'der') put(l.t, ANCHO - MARGEN - w);
    else { put(l.t || '', MARGEN); if (l.d) put(l.d, ANCHO - MARGEN - anchoTexto(l.d, tam, l.b)); }
    if (l.linea) ops += `${MARGEN} ${(y - 3).toFixed(1)} m ${ANCHO - MARGEN} ${(y - 3).toFixed(1)} l 0.5 w S\n`;
  }
  const obj = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ANCHO} ${alto.toFixed(1)}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>`,
    `<< /Length ${Buffer.byteLength(ops, 'latin1')} >>\nstream\n${ops}endstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ];
  let out = '%PDF-1.4\n'; const pos = [];
  obj.forEach((o, i) => { pos.push(Buffer.byteLength(out, 'latin1')); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${obj.length + 1}\n0000000000 65535 f \n` + pos.map((p) => String(p).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size ${obj.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, 'latin1');
}
