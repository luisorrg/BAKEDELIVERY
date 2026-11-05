// Envío de correo: SMTP si hay configuración y nodemailer instalado; si no, se guarda en storage/bandeja/.
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { esc } from './util.js';

export function crearCorreo(config) {
  let transporte;
  return {
    async enviar({ para, asunto, html, texto, adjuntos = [] }) {
      if (config.smtp) {
        try {
          transporte ??= (await import('nodemailer')).default.createTransport({ host: config.smtp.host, port: config.smtp.port, secure: config.smtp.port === 465, auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined });
          await transporte.sendMail({ from: config.remitente, to: para, subject: asunto, html, text: texto, attachments: adjuntos });
          return { enviado: true, modo: 'smtp' };
        } catch (e) { console.error('[correo] SMTP falló:', e.message); }
      }
      await mkdir(config.carpetaBandeja, { recursive: true });
      const nombre = `${Date.now()}-${para.replace(/[^a-z0-9@.]/gi, '_')}.txt`;
      await writeFile(path.join(config.carpetaBandeja, nombre), `Para: ${para}\nAsunto: ${asunto}\nAdjuntos: ${adjuntos.map((a) => a.filename).join(', ') || '-'}\n\n${texto || html}\n`);
      return { enviado: false, modo: 'bandeja' };
    },
  };
}

export const plantillaCorreo = (config, titulo, cuerpoHtml) => `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;background:#fff7ef;border:1px solid #f3d3dc;border-radius:12px;padding:24px;color:#4a3340">
<h2 style="color:#c76a86;margin-top:0">${esc(config.tienda.nombre)}</h2><h3>${esc(titulo)}</h3>${cuerpoHtml}
<p style="font-size:12px;color:#8a7380;margin-top:24px">${esc(config.tienda.nombre)} · ${esc(config.tienda.direccion)}</p></div>`;
