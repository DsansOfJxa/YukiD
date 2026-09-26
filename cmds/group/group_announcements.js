/**
 * 📢 group_announcements.js — Comandos de control del bot y llamado a administradores.
 * Reúne: bot, admins
 */
import { getGroupMeta, getBotSettings } from '../../utils/tools.js';

const cmdBot = {
  command: ['bot', 'botoff', 'boton'],
  category: 'grupo',
  desc: 'Activar o desactivar las respuestas del bot en el grupo.',
  isAdmin: true,
  run: async (client, m, args, usedPrefix, command) => {
    const chat = global.db.data?.chats?.[m.chat];
    if (!chat) return;

    let action = args[0]?.toLowerCase();
    if (command === 'botoff') action = 'off';
    if (command === 'boton') action = 'on';

    const isCurrentlyBanned = Boolean(chat.isBanned);
    const botname = getBotSettings(client)?.botname || 'Bot';

    if (['off', 'disable', 'apagar', 'desactivar'].includes(action)) {
      if (isCurrentlyBanned) {
        return m.reply(`> ⚠️ *${botname}* ya se encontraba *desactivado* en este grupo.`);
      }
      chat.isBanned = true;
      return m.reply(`> 🛑 Has *desactivado* a *${botname}* en este grupo.`);
    }

    if (['on', 'enable', 'activar', 'encender'].includes(action)) {
      if (!isCurrentlyBanned) {
        return m.reply(`> ⚠️ *${botname}* ya se encontraba *activado* en este grupo.`);
      }
      chat.isBanned = false;
      return m.reply(`> ✅ Has *activado* a *${botname}* en este grupo.`);
    }

    return m.reply(
      `> 🤖 *Control de Estado del Bot*\n\n` +
      `*Estado actual:* ${isCurrentlyBanned ? '🔴 Desactivado' : '🟢 Activado'}\n\n` +
      `*Uso:* \`${usedPrefix + command} on\` | \`${usedPrefix + command} off\``
    );
  }
};

const cmdAdmins = {
  command: ['admins', 'administradores', 'reportar', 'report'],
  customPrefix: /^(\.|#|\/|!)?(admins|administradores|reportar|report)\b/i,
  category: 'grupo',
  desc: 'Mencionar a todos los administradores del grupo para reportes o emergencias.',
  run: async (client, m, args) => {
    if (!m.isGroup) return m.reply('❌ Este comando solo se puede usar en grupos.');
    const groupInfo = await getGroupMeta(client, m.chat);
    const participants = groupInfo?.participants || [];
    const admins = participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');

    if (!admins.length) return m.reply('⚠️ No se encontraron administradores en este grupo.');

    const reason = args.join(' ').trim() || (m.quoted ? (m.quoted.text || m.quoted.caption || '') : '');
    const adminJids = admins.map(a => client.decodeJid(a.id || a.jid || a.phoneNumber)).filter(Boolean);

    let teks = `🚨 *LLAMADO A ADMINISTRADORES* 🚨\n\n`;
    teks += `👥 *Grupo:* ${groupInfo.subject || 'Grupo'}\n`;
    teks += `👤 *Solicitado por:* @${m.sender.split('@')[0]}\n`;
    if (reason) {
      teks += `💬 *Motivo:* ${reason}\n`;
    }
    teks += `\n📢 *Administradores (${admins.length}):*\n`;
    teks += admins.map(adm => `• @${client.decodeJid(adm.id || adm.jid || adm.phoneNumber).split('@')[0]}`).join('\n');
    teks += `\n\n> ⚠️ *Por favor, atender esta solicitud.*`;

    return client.sendMessage(m.chat, {
      text: teks,
      mentions: [m.sender, ...adminJids]
    }, { quoted: m });
  }
};

export default [cmdBot, cmdAdmins];
