import axios from 'axios';

export default {
  command: ['qc'],
  category: 'stickers',
  desc: 'Crea un sticker estilo cita de mensaje con foto de perfil y nombre.',
  usage: '.qc [texto] o responde a un mensaje.',
  cooldown: 4,
  run: async (client, m, args, usedPrefix, command, text) => {
    try {
      let textFinal = args.join(' ').trim() || m.quoted?.text;
      if (!textFinal) {
        return client.reply(m.chat, `📝 Ingresa un texto o responde a un mensaje para crear la cita.\nEjemplo: *${usedPrefix + command}* Hola a todos`, m);
      }

      if (textFinal.length > 120) {
        await m.react('✖️');
        return client.reply(m.chat, `❌ El texto no puede superar los 120 caracteres.`, m);
      }

      let target = m.quoted ? m.quoted.sender : m.sender;
      const pp = await client.profilePictureUrl(target).catch(() => 'https://cdn.yuki-wabot.my.id/files/2PVh.jpeg');
      const db = global.db.data;
      const userGlobal = db.users[target] || {};

      // Priorizar el pushName de WhatsApp para la burbuja de la cita
      const targetPushName = m.quoted?.pushName || (target === m.sender ? m.pushName : null);
      const nombre = (targetPushName && targetPushName.trim()) || userGlobal.name || `@${target.split('@')[0]}`;

      await m.react('🕒');

      const quoteObj = {
        type: 'quote',
        format: 'png',
        backgroundColor: '#000000',
        width: 512,
        height: 768,
        scale: 2,
        messages: [{
          entities: [],
          avatar: true,
          from: { id: 1, name: nombre, photo: { url: pp } },
          text: textFinal,
          replyMessage: {}
        }]
      };

      const QUOTE_ENDPOINTS = [
        'https://bot.lyo.su/quote/generate',
        'https://quote.yuri.ly/generate',
        'https://qc.botcahx.eu.org/generate'
      ];

      let res;
      let apiError = null;
      for (const endpoint of QUOTE_ENDPOINTS) {
        try {
          res = await axios.post(endpoint, quoteObj, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 8000
          });
          if (res.data?.result?.image) {
            apiError = null;
            break;
          }
        } catch (err) {
          apiError = err;
        }
      }

      if (apiError || !res?.data?.result?.image) {
        throw apiError || new Error('No se pudo conectar a los servidores de Quote.');
      }

      const buffer = Buffer.from(res.data.result.image, 'base64');
      const user = db.users[m.sender] || {};
      const senderPushName = (m.pushName && m.pushName.trim()) || user.name || m.sender.split('@')[0];
      const authorDisplay = senderPushName.startsWith('@') ? senderPushName : `@${senderPushName}`;

      const meta1 = user.metadatos ? String(user.metadatos).trim() : '';
      const meta2 = user.metadatos2 ? String(user.metadatos2).trim() : '';
      const packname = meta1 || 'YukiBot Quotes';
      const author = meta1 ? (meta2 || '') : authorDisplay;

      // Envío en memoria directo sin escribir en disco
      await client.sendImageAsSticker(m.chat, buffer, m, { packname, author });
      await m.react('✔️');
    } catch (e) {
      await m.react('✖️');
      return m.reply(`> ❌ Error al generar la cita.\n[Error: *${e.message}*]`);
    }
  }
};
