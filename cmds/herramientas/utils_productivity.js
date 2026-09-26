/**
 * 📅 utils_productivity.js — Comandos de productividad, recordatorios y visualización ViewOnce.
 * Reúne: read, recordar
 */
import { downloadContentFromMessage } from '@whiskeysockets/baileys';

const cmdReadViewOnce = {
  command: ['readviewonce', 'read', 'readvo', 'viewonce', 'vv'],
  category: 'herramientas', 
  desc: 'Ver mensaje ViewOnce.',
  description: 'Re-send a view-once image, video or audio.',
  usage: '.viewonce (responder a un mensaje de vista única)',
  run: async (client, m) => {
    try {
      const targetId = m.quoted?.id || m.msg?.contextInfo?.stanzaId;
      if (!m.quoted && !targetId) {
        return await client.sendMessage(m.chat, {
          text: '⚠️ Por favor, responde a un mensaje de "Ver una vez" (ViewOnce) para recuperarlo.'
        }, { quoted: m });
      }

      // 1. Buscar el mensaje original en buffer y store para recuperar el mediaKey completo si WhatsApp lo omitió en el quoted stub
      const bufferedMsg = targetId ? (global.msgBuffer?.[m.chat]?.find(msg => (msg.id === targetId || msg.key?.id === targetId))) : null;
      const storedMsg = targetId ? (global.msgStore?.get(m.chat + ':' + targetId) || global.msgStore?.get(targetId)) : null;

      // 2. Extraer candidatos de mensaje en orden de prioridad
      const candidates = [
        bufferedMsg?.message,
        bufferedMsg?.msg,
        bufferedMsg,
        storedMsg,
        m.quoted?.message,
        m.quoted?.msg,
        m.quoted,
        m.message?.extendedTextMessage?.contextInfo?.quotedMessage
      ].filter(Boolean);

      let mediaMsg = null;
      let mediaType = null;
      let caption = '';

      for (const cand of candidates) {
        const unwrapped = cand.viewOnceMessage?.message || 
                          cand.viewOnceMessageV2?.message || 
                          cand.viewOnceMessageV2Extension?.message || 
                          cand.ephemeralMessage?.message || 
                          cand;

        const img = unwrapped.imageMessage || (cand.imageMessage?.viewOnce ? cand.imageMessage : null);
        const vid = unwrapped.videoMessage || (cand.videoMessage?.viewOnce ? cand.videoMessage : null);
        const aud = unwrapped.audioMessage || (cand.audioMessage?.viewOnce ? cand.audioMessage : null);

        if (img && (img.mediaKey || img.url || img.directPath)) {
          mediaMsg = img;
          mediaType = 'image';
          caption = img.caption || caption;
          if (img.mediaKey) break;
        } else if (vid && (vid.mediaKey || vid.url || vid.directPath)) {
          mediaMsg = vid;
          mediaType = 'video';
          caption = vid.caption || caption;
          if (vid.mediaKey) break;
        } else if (aud && (aud.mediaKey || aud.url || aud.directPath)) {
          mediaMsg = aud;
          mediaType = 'audio';
          if (aud.mediaKey) break;
        }
      }

      if (!mediaMsg) {
        return await client.sendMessage(m.chat, {
          text: '⚠️ No se detectó ningún archivo multimedia de "Ver una vez" en el mensaje respondido.'
        }, { quoted: m });
      }

      if (!mediaMsg.mediaKey) {
        return await client.sendMessage(m.chat, {
          text: '⚠️ No se puede derivar la clave de medios (el mensaje de vista única fue enviado antes de que el bot estuviera conectado o expiró del servidor de WhatsApp).'
        }, { quoted: m });
      }

      await m.react?.('🕒');

      // 3. Descargar el buffer multimedia
      let buffer = null;
      try {
        const stream = await downloadContentFromMessage(mediaMsg, mediaType);
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        buffer = Buffer.concat(chunks);
      } catch (dlErr) {
        if (m.quoted?.download) {
          buffer = await m.quoted.download().catch(() => null);
        }
        if (!buffer || buffer.length === 0) throw dlErr;
      }

      // 4. Re-enviar el archivo multimedia
      if (mediaType === 'image') {
        await client.sendMessage(m.chat, {
          image: buffer,
          caption: caption || ''
        }, { quoted: m });
      } else if (mediaType === 'video') {
        await client.sendMessage(m.chat, {
          video: buffer,
          caption: caption || '',
          mimetype: mediaMsg.mimetype || 'video/mp4'
        }, { quoted: m });
      } else if (mediaType === 'audio') {
        await client.sendMessage(m.chat, {
          audio: buffer,
          mimetype: mediaMsg.mimetype || 'audio/ogg; codecs=opus',
          ptt: mediaMsg.ptt || false
        }, { quoted: m });
      }

      await m.react?.('✔️');
    } catch(error) {
      console.error('Error in viewonceCommand:', error);
      await m.react?.('❌');
      await client.sendMessage(m.chat, {
        text: `❌ Falló al recuperar el archivo multimedia: ${error.message || error}`
      }, { quoted: m });
    }
  }
};

const cmdRecordar = {
  command: ['recordar', 'rec', 'remind'],
  category: 'herramientas', desc: 'Establecer recordatorios.',
  run: async (client, m, args, usedPrefix, command) => {
    const input = args.join(' ').trim();
    const dividerMatch = input.match(/\s*\|\s*/);
    
    if (!dividerMatch) {
        return m.reply(` Formato incorrecto. Usa el separador |\n*Ejemplo:* ${usedPrefix + command} 10 | sacar la basura`);
    }
    
    const [tiempoRaw, ...msgArr] = input.split(dividerMatch[0]);
    const mensaje = msgArr.join(dividerMatch[0]).trim();
    const minutos = parseFloat(tiempoRaw);
    
    if (isNaN(minutos) || minutos <= 0) return m.reply(` Por favor ingresa minutos válidos.\n*Ejemplo:* ${usedPrefix + command} 5 | apagar el horno`);
    if (minutos > 1440) return m.reply(` El tiempo límite es de 1440 minutos (24 horas).`);
    
    m.reply(`⏰ *Recordatorio Guardado*\n\nTe notificaré en *${minutos} minuto(s)* sobre:\n"${mensaje}"`);
    
    setTimeout(async () => {
      try {
        await client.sendMessage(m.chat, { 
          text: `⏰ *RECORDATORIO* ⏰\n\nHola @${m.sender.split('@')[0]}:\n\n*${mensaje}*`,
          mentions: [m.sender]
        });
      } catch (e) {}
    }, minutos * 60 * 1000);
  }
};

export default [cmdReadViewOnce, cmdRecordar];
