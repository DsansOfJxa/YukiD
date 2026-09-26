import { formatTime, getGroupMeta, getBotId, getBotSettings } from '../../utils/tools.js';

const linkRegex = /chat\.whatsapp\.com\/([0-9A-Za-z]{20,24})(?:\s+[0-9]{1,3})?/i;

async function getGroupName(client, chatId) {
  try {
    const metadata = await getGroupMeta(client, chatId);
    return metadata.subject || 'Grupo desconocido';
  } catch {
    return 'Chat privado';
  }
}

export default {
  command: ['invite', 'invitar'],
  category: 'info',
  desc: 'Invita al bot a otro grupo.',
  run: async (client, m, args) => {
    const user = global.db.data.users[m.sender] || {};
    const grupo = m.isGroup ? await getGroupName(client, m.chat) : 'Chat privado';
    const botId = getBotId(client);
    const botSettings = getBotSettings(client);
    const botname = botSettings.botname;
    const dueño = botSettings.owner;
    const cooldown = 600000;
    const nextTime = user.jointime + cooldown;    
    if (new Date() - user.jointime < cooldown) {
      return m.reply(`Espera *${formatTime(nextTime - new Date())}* para volver a enviar otra invitacion.`);
    }
    if (!args || !args.length) {
      return m.reply(' Ingresa el enlace para invitar al bot a tu grupo.');
    }
    const link = args.join(' ');
    const match = link.match(linkRegex);    
    if (!match || !match[1]) {
      return m.reply(' El enlace ingresado no es válido o está incompleto.');
    }
    const isOficialBot = botId === getBotId(global.client);
    const botType = isOficialBot ? 'Principal/Owner' : 'Sub Bot';
    const pp = await client.profilePictureUrl(m.sender, 'image').catch(() => 'https://cdn.yuki-wabot.my.id/files/2PVh.jpeg');    
    const sugg = `𝗦𝗢𝗟𝗜𝗖𝗜𝗧𝗨𝗗 𝗥𝗘𝗖𝗜𝗕𝗜𝗗𝗔
    
✩ *Usuario ›* ${global.db.data.users[m.sender].name}
✿ *Enlace ›* ${args.join(' ')}
✿ *Chat ›* ${grupo}

➤ 𝗜𝗡𝗙𝗢 𝗕𝗢𝗧
♡ *Socket ›* ${botType}
★ *Nombre ›* ${botname}
❐ *Versión ›* ${global.version}`;    
    if (typeof sugg !== 'string' || !sugg.trim()) return;
    if (isOficialBot) {
      const lista = dueño ? [dueño] : (global.owner || []).map(num => `${num}@s.whatsapp.net`);
      for (const destino of lista) {
        try {
          await global.client.sendContextInfoIndex(destino, sugg, {}, null, false, null, { banner: pp, title: 'Invitación', body: '✿ New invitation to the Sokect.', redes: botSettings.link });
        } catch {}
      }
    } else {
      const destino = dueño || botId;
      try {
        await global.client.sendContextInfoIndex(destino, sugg, {}, null, false, null, { banner: pp, title: 'Invitación', body: '✿ New invitation to the Sokect.', redes: botSettings.link });
      } catch {}
    }    
    await m.reply('El enlace fue enviado correctamente. ¡Gracias por tu invitación! ฅ^•ﻌ•^ฅ');
    user.jointime = Date.now();
  },
};


