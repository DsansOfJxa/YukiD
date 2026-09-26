import { getGroupMeta, getBotId, getBotSettings } from '../../utils/tools.js';

export default async (client, m) => {
  if (!m.isGroup) return;
  if (m.isBot) return;

  const isEstado = m.quoted?.groupStatusMentionMessage || 
                   m.quoted?.type === 'groupStatusMentionMessage' || 
                   m.message?.groupStatusMentionMessage || 
                   m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.groupStatusMentionMessage;
                   
  if (!isEstado) return;

  const botId = getBotId(client);
  const isSelf = getBotSettings(client)?.self ?? false;
  if (isSelf) return;

  const groupMetadata = await getGroupMeta(client, m.chat);
  if (!groupMetadata) return;

  const participants = groupMetadata.participants || [];
  const groupAdmins = participants.filter(p => p.admin).map(p => p.phoneNumber || p.jid || p.id || p.lid);
  const isAdmin = groupAdmins.includes(m.sender);
  const isBotAdmin = groupAdmins.includes(botId);
  if (isAdmin || !isBotAdmin) return;

  const chat = global?.db?.data?.chats?.[m.chat];
  const primaryBotId = chat?.primaryBot;
  const isPrimary = !primaryBotId || primaryBotId === botId;
  if (!isPrimary || !chat?.antistatus) return;

  try {
    let deleteObj = null;
    let participantToUse = null;

    if (m.quoted && (m.quoted.groupStatusMentionMessage || m.quoted.type === 'groupStatusMentionMessage')) {
      const quotedKey = m.quoted.key;
      participantToUse = quotedKey.participantAlt || (quotedKey.participant ? quotedKey.participant.split(':')[0] + '@s.whatsapp.net' : m.sender);
      deleteObj = { remoteJid: m.chat, fromMe: false, id: quotedKey.id, participant: participantToUse };
    } else if (m.message?.groupStatusMentionMessage) {
      participantToUse = m.key.participantAlt || (m.key.participant ? m.key.participant.split(':')[0] + '@s.whatsapp.net' : m.sender);
      deleteObj = { remoteJid: m.chat, fromMe: false, id: m.key.id, participant: participantToUse };
    } else if (m.message?.extendedTextMessage?.contextInfo) {
      const contextInfo = m.message.extendedTextMessage.contextInfo;
      if (contextInfo.quotedMessage?.groupStatusMentionMessage || contextInfo.stanzaId) {
        participantToUse = (contextInfo.participant ? contextInfo.participant.split(':')[0] + '@s.whatsapp.net' : null) || m.sender;
        deleteObj = { remoteJid: m.chat, fromMe: false, id: contextInfo.stanzaId, participant: participantToUse };
      }
    }

    if (deleteObj) {
      await client.sendMessage(m.chat, { delete: deleteObj }).catch(err => console.error('Error al borrar status:', err));
      const currentParticipant = m.key.participantAlt || (m.key.participant ? m.key.participant.split(':')[0] + '@s.whatsapp.net' : m.sender);
      const currentDeleteObj = { remoteJid: m.chat, fromMe: false, id: m.key.id, participant: currentParticipant };
      if (currentDeleteObj.id !== deleteObj.id) {
        await client.sendMessage(m.chat, { delete: currentDeleteObj }).catch(err => console.error('Error al borrar comando actual:', err));
      }
    }

    const targetId = m.sender;
    const chatUser = chat.users?.[targetId] || {};
    if (!chatUser.warnings) chatUser.warnings = [];
    
    let warnings = chatUser.warnings;
    const now = new Date();
    const timestamp = now.toLocaleString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    
    warnings.unshift({ reason: 'Anti-Status detectado', timestamp, by: botId });
    chat.users[targetId].warnings = warnings;

    const total = warnings.length;
    const warnLimit = chat.warnLimit || 3;

    const warningList = warnings.map((w, i) => {
      const index = total - i;
      return `\`#${index}\` » ${w.reason}\n> » Fecha: ${w.timestamp}`;
    }).join('\n');

    let message = `✐ Se ha añadido una advertencia automática a @${targetId.split('@')[0]} por *Anti-Status*.\n✿ Advertencias totales \`(${total})\`:\n\n${warningList}`;
    
    if (total >= warnLimit) {
      try {
        await client.groupParticipantsUpdate(m.chat, [targetId], 'remove');
        chat.users[targetId].warnings = [];
        message += `\n\n> ❖ El usuario alcanzó el límite de advertencias y fue expulsado del grupo.`;
      } catch {
        message += `\n\n> ❖ El usuario alcanzó el límite, pero no se pudo expulsar automáticamente.`;
      }
    }
    
    await client.reply(m.chat, message, m, { mentions: [targetId] });
  } catch (error) {
    console.error('Error general en Anti-Estado:', error);
  }
};
