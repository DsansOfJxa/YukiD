/**
 * 👥 group_members.js — Comandos de gestión de miembros de grupo.
 * Reúne: kick, promote, demote
 */
import { getGroupMeta } from '../../utils/tools.js';
import { resolveLidToRealJid } from '../../core/utils.js';
import config from '../../config.js';

const cmdKick = {
  command: ['kick', 'echar', 'sacar', 'eliminar'],
  category: 'grupo',
  desc: 'Expulsar miembro o usar .kick @all (Solo Creador del Bot).',
  isAdmin: true,
  botAdmin: true,
  run: async (client, m, args) => {
    const text = (args.join(' ') || '').toLowerCase().trim();
    const isKickAll = text.includes('@all') || text === 'all';
    const groupInfo = await getGroupMeta(client, m.chat);
    if (!groupInfo) return m.reply('> ❌ *No se pudo obtener la información del grupo.*');

    const botJid = client.decodeJid(client.user?.id);
    const senderJid = client.decodeJid(m.sender);
    const ownerBotList = [
      botJid,
      ...(global.owner || []).map(num => client.decodeJid(num + '@s.whatsapp.net')),
      ...(config.owner || []).map(num => client.decodeJid(num + '@s.whatsapp.net'))
    ];
    const isOwner = ownerBotList.includes(senderJid);

    // Expulsión masiva
    if (isKickAll) {
      if (!isOwner) {
        return m.reply('> ❌ *Solo el creador del bot puede usar la expulsión masiva (.kick @all).*');
      }

      const ownerGroup = groupInfo.owner ? client.decodeJid(groupInfo.owner) : '';
      const targets = (groupInfo.participants || []).filter(p => {
        const jid = client.decodeJid(p.id || p.jid || p.phoneNumber);
        return !ownerBotList.includes(jid) && jid !== ownerGroup;
      });

      if (!targets.length) {
        return m.reply('> ⚠️ *No hay miembros elegibles para expulsar en este grupo.*');
      }

      await m.reply(`🚨 *INICIANDO EXPULSIÓN MASIVA* 🚨\n\n👥 *Miembros a expulsar:* ${targets.length}\n⏳ Procesando en lotes seguros...`);

      const targetJids = targets.map(p => client.decodeJid(p.id || p.jid || p.phoneNumber));
      let kickedCount = 0;
      for (let i = 0; i < targetJids.length; i += 10) {
        const batch = targetJids.slice(i, i + 10);
        try {
          await client.groupParticipantsUpdate(m.chat, batch, 'remove');
          kickedCount += batch.length;
          await new Promise(r => setTimeout(r, 1000));
        } catch (err) {
          console.error('[kickAll batch error]', err);
        }
      }

      return client.sendMessage(m.chat, {
        text: `✅ *Expulsión masiva finalizada.*\n\n🗑️ *Total expulsados:* ${kickedCount} de ${targetJids.length} miembros.`
      }, { quoted: m });
    }

    // Expulsión individual
    const rawTarget = m.mentionedJid?.[0] || (m.quoted ? m.quoted.sender : false);
    if (!rawTarget) {
      return m.reply('> ⚠️ *Etiqueta o responde al mensaje de la persona que deseas expulsar.*');
    }

    let user = await resolveLidToRealJid(rawTarget, client, m.chat);
    user = client.decodeJid(user);

    const ownerGroup = groupInfo.owner ? client.decodeJid(groupInfo.owner) : '';
    const participant = groupInfo.participants.find(p => client.decodeJid(p.id || p.jid || p.phoneNumber || p.lid) === user);

    if (!participant) {
      return client.sendMessage(m.chat, { text: `> ⚠️ *@${user.split('@')[0]}* ya no se encuentra en el grupo.`, mentions: [user] }, { quoted: m });
    }
    if (user === botJid) {
      return m.reply('> ❌ *No puedo expulsar al bot del grupo.*');
    }
    if (user === ownerGroup) {
      return m.reply('> ❌ *No se puede expulsar al creador del grupo.*');
    }
    if (ownerBotList.includes(user)) {
      return m.reply('> ❌ *No se puede expulsar al propietario del bot.*');
    }

    try {
      await client.groupParticipantsUpdate(m.chat, [user], 'remove');
      return client.sendMessage(m.chat, { text: `> 🚪 *@${user.split('@')[0]}* ha sido expulsado del grupo.*`, mentions: [user] }, { quoted: m });
    } catch (e) {
      return m.reply(`> ❌ *Error al expulsar al usuario:*\n[${e.message}]`);
    }
  }
};

const cmdPromote = {
  command: ['promote', 'promover', 'daradmin'],
  category: 'grupo',
  desc: 'Promover a un miembro a administrador.',
  isAdmin: true,
  botAdmin: true,
  run: async (client, m) => {
    const rawTarget = m.mentionedJid?.[0] || (m.quoted ? m.quoted.sender : false);
    if (!rawTarget) return m.reply('> ⚠️ *Menciona o responde al usuario que deseas promover a administrador.*');

    const who = client.decodeJid(await resolveLidToRealJid(rawTarget, client, m.chat));
    try {
      const groupMetadata = await getGroupMeta(client, m.chat);
      const participant = groupMetadata?.participants?.find(p => client.decodeJid(p.id || p.jid || p.lid || p.phoneNumber) === who);

      if (!participant) {
        return m.reply('> ❌ *El usuario no pertenece a este grupo.*');
      }
      if (participant.admin) {
        return client.sendMessage(m.chat, { text: `> ⚠️ *@${who.split('@')[0]}* ya es administrador del grupo.`, mentions: [who] }, { quoted: m });
      }

      await client.groupParticipantsUpdate(m.chat, [participant.id || who], 'promote');
      return client.sendMessage(m.chat, { text: `> 🛡️ *@${who.split('@')[0]}* ahora es administrador del grupo.*`, mentions: [who] }, { quoted: m });
    } catch (e) {
      return m.reply(`> ❌ *Error al promover al usuario:*\n[${e.message}]`);
    }
  }
};

const cmdDemote = {
  command: ['demote', 'degradar', 'quitaradmin'],
  category: 'grupo',
  desc: 'Quitar el rango de administrador a un miembro.',
  isAdmin: true,
  botAdmin: true,
  run: async (client, m) => {
    const rawTarget = m.mentionedJid?.[0] || (m.quoted ? m.quoted.sender : false);
    if (!rawTarget) return m.reply('> ⚠️ *Menciona o responde al usuario que deseas degradar de administrador.*');

    const who = client.decodeJid(await resolveLidToRealJid(rawTarget, client, m.chat));
    try {
      const groupMetadata = await getGroupMeta(client, m.chat);
      const participant = groupMetadata?.participants?.find(p => client.decodeJid(p.id || p.jid || p.lid || p.phoneNumber) === who);

      if (!participant) {
        return m.reply('> ❌ *El usuario no pertenece a este grupo.*');
      }
      if (!participant.admin) {
        return client.sendMessage(m.chat, { text: `> ⚠️ *@${who.split('@')[0]}* no es administrador del grupo.`, mentions: [who] }, { quoted: m });
      }
      if (who === client.decodeJid(groupMetadata.owner)) {
        return m.reply('> ❌ *No se puede degradar al creador del grupo.*');
      }

      await client.groupParticipantsUpdate(m.chat, [participant.id || who], 'demote');
      return client.sendMessage(m.chat, { text: `> 👤 *@${who.split('@')[0]}* ha sido degradado de administrador.*`, mentions: [who] }, { quoted: m });
    } catch (e) {
      return m.reply(`> ❌ *Error al degradar al usuario:*\n[${e.message}]`);
    }
  }
};

export default [cmdKick, cmdPromote, cmdDemote];
