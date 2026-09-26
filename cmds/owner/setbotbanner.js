import { getBotSettings } from '../../utils/tools.js';

export default {
  command: ['setbanner', 'setbotbanner', 'setmenubanner'],
  category: 'owner',
  desc: 'Cambiar el banner oficial del bot (usado en menús, infobot y perfiles).',
  usage: '[url / responder a imagen]',
  isOwner: true,
  run: async (client, m, args) => {
    const config = getBotSettings(client);

    const value = args.join(' ').trim();
    if (!value && !m.quoted && !m.message?.imageMessage && !m.message?.videoMessage) {
      return m.reply('✎ Debes enviar o citar una imagen, o ingresar una URL directa para cambiar el banner del bot.');
    }

    if (value.startsWith('http://') || value.startsWith('https://')) {
      config.banner = value;
      config.icon = value;
      global.saveDatabaseAsync?.();
      return m.reply(`✅ Se ha actualizado el banner de *${config.botname || 'YukiBot'}*!\nURL: ${value}`);
    }

    const q = m.quoted ? m.quoted : m.message?.imageMessage ? m : m;
    const mime = (q.msg || q).mimetype || q.mediaType || '';

    if (!/image\/(png|jpe?g|gif)|video\/mp4/.test(mime)) {
      return m.reply('⚠️ Por favor responde a una imagen o video válido.');
    }

    try {
      await m.react('⏳');
      await m.reply('⏳ *Procesando y subiendo nuevo banner, espera un momento...*');

      let buffer;
      if (typeof q.download === 'function') {
        buffer = await q.download();
      } else {
        const { downloadContentFromMessage } = await import('@whiskeysockets/baileys');
        const msgContent = q.msg || q;
        const type = mime.split('/')[0];
        const stream = await downloadContentFromMessage(msgContent, type);
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        buffer = Buffer.concat(chunks);
      }

      if (!buffer || buffer.length === 0) {
        await m.react('❌');
        return m.reply('❌ No se pudo descargar el archivo multimedia.');
      }

      const url = await uploadImage(buffer, mime);
      if (!url) {
        await m.react('❌');
        return m.reply('❌ No se pudo subir la imagen a los servidores de almacenamiento.');
      }

      config.banner = url;
      config.icon = url;
      global.saveDatabaseAsync?.();

      await m.react('✔️');
      return m.reply(`✅ *¡Banner actualizado exitosamente!* ✿\nNuevo enlace: ${url}`);
    } catch (e) {
      console.error('[SetBanner Error]:', e);
      await m.react('❌');
      return m.reply(`❌ Error al actualizar el banner: ${e.message}`);
    }
  },
};

async function uploadImage(buffer, mime) {
  const ext = mime.split('/')[1] || 'jpg';
  const blob = new Blob([buffer], { type: mime });

  // 1. Intentar Catbox
  try {
    const fd = new FormData();
    fd.append('reqtype', 'fileupload');
    fd.append('fileToUpload', blob, `banner.${ext}`);
    const res = await fetch('https://catbox.moe/user/api.php', {
      method: 'POST',
      body: fd,
      signal: AbortSignal.timeout(12000),
    });
    if (res.ok) {
      const txt = await res.text();
      if (txt.startsWith('http')) return txt.trim();
    }
  } catch {}

  // 2. Fallback Uguu
  try {
    const fd = new FormData();
    fd.append('files[]', blob, `banner.${ext}`);
    const res = await fetch('https://uguu.se/upload.php', {
      method: 'POST',
      body: fd,
      signal: AbortSignal.timeout(12000),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.files?.[0]?.url) return json.files[0].url;
    }
  } catch {}

  return null;
}
