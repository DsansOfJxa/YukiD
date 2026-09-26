import { resolveLidToRealJid } from '../../core/utils.js';
import { getCachedPushName } from '../../core/message.js';

export default {
  command: ['getpic', 'getpp', 'dlpp', 'profilepic', 'getdp', 'getpicture', 'pfp'],
  category: 'profile',
  desc: 'Obtén la foto de perfil en alta calidad de un usuario, mención, número o tu propia foto.',
  usage: '.getpic [@usuario / respuesta / número / vacio para tu foto]',

  run: async (client, m, args, usedPrefix, command) => {
    let target = null;
    let pushName = null;

    const mentioned = m.mentionedJid || [];
    if (mentioned.length > 0) {
      target = mentioned[0];
    } else if (m.quoted) {
      target = m.quoted.sender;
      pushName = m.quoted.pushName;
    } else if (args[0]) {
      const cleanNum = args[0].replace(/\D/g, '');
      if (cleanNum.length >= 10) {
        target = cleanNum + '@s.whatsapp.net';
      } else {
        return m.reply('❌ Número inválido. Usa un formato válido como: `573001234567` o `+584127631398`.');
      }
    } else {
      target = m.sender;
      pushName = m.pushName;
    }

    await m.react('🕒');

    const realJid = await resolveLidToRealJid(target, client, m.chat);
    const cleanNumber = realJid.split('@')[0].split(':')[0];
    const displayNumber = cleanNumber.length >= 10 ? `+${cleanNumber}` : '';

    let displayName = pushName || getCachedPushName?.(realJid) || global.db?.data?.users?.[realJid]?.name || '';
    if (!displayName && client?.getName) {
      try {
        const n = await client.getName(realJid);
        if (n && !n.startsWith('+')) displayName = n;
      } catch {}
    }
    if (!displayName) displayName = cleanNumber;

    try {
      const ppUrl = await client.profilePictureUrl(realJid, 'image');
      if (!ppUrl) throw new Error('No HD picture');

      const caption = `📸 *Foto de Perfil*\n\n` +
        `👤 *Usuario:* ${displayName}\n` +
        `📱 *Número:* ${displayNumber || cleanNumber}`;

      await client.sendMessage(m.chat, {
        image: { url: ppUrl },
        caption,
        mentions: [realJid]
      }, { quoted: m });
      await m.react('✔️');
    } catch (e) {
      await m.react('❌');
      return m.reply(`❌ No se pudo obtener la foto de perfil de *@${cleanNumber}* (${displayName}).\n\n> Es posible que el usuario no tenga foto de perfil configurada o sus ajustes de privacidad estén restringidos.`, { mentions: [realJid] });
    }
  }
};
