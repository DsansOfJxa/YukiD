/**
 * ⚠️ group_warns.js — Sistema de advertencias (warns) del grupo.
 * Reúne: warn, warns, delwarn, setwarnlimit
 */
import { resolveLidToRealJid } from "../../core/utils.js";

function getFormattedDate() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const cmdWarn = {
  command: ['warn', 'advertir'],
  category: 'grupo',
  desc: 'Advertir a un usuario en el grupo por infringir normas.',
  isAdmin: true,
  run: async (client, m, args) => {
    const chat = global.db.data?.chats?.[m.chat];
    if (!chat) return;

    const rawTarget = m.mentionedJid?.[0] || (m.quoted ? m.quoted.sender : false);
    if (!rawTarget) return m.reply('> ⚠️ *Debes mencionar o responder al usuario que deseas advertir.*');

    const targetId = client.decodeJid(await resolveLidToRealJid(rawTarget, client, m.chat));
    const reason = (m.mentionedJid?.length > 0 ? args.slice(1).join(' ') : args.join(' ')).trim() || 'Sin motivo especificado';

    try {
      if (!chat.users) chat.users = {};
      if (!chat.users[targetId]) chat.users[targetId] = {};
      const user = chat.users[targetId];
      if (!Array.isArray(user.warnings)) user.warnings = [];

      const timestamp = getFormattedDate();
      user.warnings.unshift({ reason, timestamp, by: client.decodeJid(m.sender) });
      const total = user.warnings.length;

      const warningList = user.warnings.map((w, i) => {
        const index = total - i;
        return `\`#${index}\` ${w.reason} _(${w.timestamp})_`;
      }).join('\n');

      let message = `⚠️ *ADVERTENCIA AÑADIDA*\n\n> 👤 *Usuario:* @${targetId.split('@')[0]}\n> 📊 *Total de advertencias:* \`${total}\`\n\n${warningList}`;

      const warnLimit = chat.warnLimit || 3;
      const expulsar = Boolean(chat.expulsar);

      if (total >= warnLimit) {
        if (expulsar) {
          try {
            await client.groupParticipantsUpdate(m.chat, [targetId], 'remove');
            user.warnings = [];
            message += `\n\n🚪 *El usuario ha alcanzado el límite de advertencias (${warnLimit}) y fue expulsado.*`;
          } catch {
            message += `\n\n⚠️ *El usuario alcanzó el límite (${warnLimit}), pero el bot no pudo expulsarlo (verifica permisos de admin).*`;
          }
        } else {
          message += `\n\n⚠️ *El usuario ha alcanzado el límite de advertencias (${warnLimit}).*`;
        }
      }

      return client.sendMessage(m.chat, { text: message, mentions: [targetId] }, { quoted: m });
    } catch (e) {
      return m.reply(`> ❌ *Error al registrar advertencia:*\n[${e.message}]`);
    }
  }
};

const cmdWarns = {
  command: ['warns', 'advertencias', 'verwarns'],
  category: 'grupo',
  desc: 'Ver el historial de advertencias de un usuario.',
  isAdmin: true,
  run: async (client, m) => {
    const chat = global.db.data?.chats?.[m.chat];
    if (!chat) return;

    const rawTarget = m.mentionedJid?.[0] || (m.quoted ? m.quoted.sender : false);
    if (!rawTarget) return m.reply('> ⚠️ *Menciona o responde a un usuario para ver sus advertencias.*');

    const userId = client.decodeJid(await resolveLidToRealJid(rawTarget, client, m.chat));
    const user = chat.users?.[userId];
    const total = user?.warnings?.length || 0;

    if (total === 0) {
      return client.sendMessage(m.chat, { text: `> ✅ *@${userId.split('@')[0]}* no tiene advertencias acumuladas.`, mentions: [userId] }, { quoted: m });
    }

    const warningList = user.warnings.map((w, i) => {
      const index = total - i;
      const author = w.by ? ` • Por: @${w.by.split('@')[0]}` : '';
      return `\`#${index}\` ${w.reason}\n> 📅 ${w.timestamp}${author}`;
    }).join('\n\n');

    const mentions = [userId, ...user.warnings.map(w => w.by).filter(Boolean)];
    const text = `📋 *HISTORIAL DE ADVERTENCIAS*\n\n> 👤 *Usuario:* @${userId.split('@')[0]}\n> ⚠️ *Total:* \`${total}\`\n\n${warningList}`;

    return client.sendMessage(m.chat, { text, mentions }, { quoted: m });
  }
};

const cmdDelWarn = {
  command: ['delwarn', 'unwarn', 'quitarwarn'],
  category: 'grupo',
  desc: 'Eliminar una o todas las advertencias de un usuario.',
  isAdmin: true,
  run: async (client, m, args) => {
    const chat = global.db.data?.chats?.[m.chat];
    if (!chat) return;

    const rawTarget = m.mentionedJid?.[0] || (m.quoted ? m.quoted.sender : false);
    if (!rawTarget) return m.reply('> ⚠️ *Debes mencionar o responder al usuario cuya advertencia deseas eliminar.*');

    const targetId = client.decodeJid(await resolveLidToRealJid(rawTarget, client, m.chat));
    const user = chat.users?.[targetId];
    const total = user?.warnings?.length || 0;

    if (total === 0) {
      return client.sendMessage(m.chat, { text: `> ℹ️ El usuario *@${targetId.split('@')[0]}* no tiene advertencias para eliminar.`, mentions: [targetId] }, { quoted: m });
    }

    const rawIndex = m.mentionedJid?.length > 0 ? args[1] : args[0];

    if (rawIndex?.toLowerCase() === 'all' || rawIndex?.toLowerCase() === 'todas') {
      user.warnings = [];
      return client.sendMessage(m.chat, { text: `> ✅ *Se han eliminado todas las advertencias de @${targetId.split('@')[0]}.*`, mentions: [targetId] }, { quoted: m });
    }

    const index = parseInt(rawIndex);
    if (isNaN(index) || index < 1 || index > total) {
      return m.reply(`> ⚠️ *Especifica un número de advertencia válido entre 1 y ${total}, o escribe "all" para borrar todas.*\n*Ejemplo:* \`.delwarn 1\` o \`.delwarn all\``);
    }

    const realIndex = total - index;
    user.warnings.splice(realIndex, 1);
    return client.sendMessage(m.chat, { text: `> ✅ *Se eliminó la advertencia #${index} de @${targetId.split('@')[0]}.*`, mentions: [targetId] }, { quoted: m });
  }
};

const cmdSetWarnLimit = {
  command: ['setwarnlimit', 'warnlimit'],
  category: 'grupo',
  desc: 'Configurar el límite de advertencias antes de expulsar a un usuario.',
  isAdmin: true,
  run: async (client, m, args, usedPrefix, command) => {
    const chat = global.db.data?.chats?.[m.chat];
    if (!chat) return;

    const raw = args[0];
    const limit = parseInt(raw);

    if (isNaN(limit) || limit < 0 || limit > 10) {
      return m.reply(
        `⚙️ *Configuración de Límite de Advertencias*\n\n` +
        `*Estado actual:* ${chat.expulsar ? `\`${chat.warnLimit || 3}\` advertencias` : '`Desactivado`'}\n\n` +
        `*Uso:*\n` +
        `• Establecer límite: \`${usedPrefix + command} 3\` (de 1 a 10)\n` +
        `• Desactivar auto-expulsión: \`${usedPrefix + command} 0\``
      );
    }

    if (limit === 0) {
      chat.warnLimit = 0;
      chat.expulsar = false;
      return m.reply('> 🛑 *Se ha desactivado la auto-expulsión por advertencias.*');
    }

    chat.warnLimit = limit;
    chat.expulsar = true;
    return m.reply(`> ✅ *Límite de advertencias establecido en \`${limit}\`.* Los usuarios serán expulsados automáticamente al alcanzarlo.`);
  }
};

export default [cmdWarn, cmdWarns, cmdDelWarn, cmdSetWarnLimit];
