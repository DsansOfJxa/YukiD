import chalk from 'chalk'
import { getGroupMeta, getBotId, getBotSettings } from '../../utils/tools.js';

function formatWelcomeGoodbyeText(template, { phone, groupName, groupDesc, memberCount }) {
  if (!template) return '';
  const now = new Date();
  const timeFormatted = now.toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: true
  });

  return template
    .replace(/@user|\{user\}|\{usuario\}/gi, `@${phone}`)
    .replace(/@group|\{group\}|\{grupo\}/gi, groupName || 'el grupo')
    .replace(/@desc|\{desc\}|\{description\}/gi, groupDesc || 'Sin descripción')
    .replace(/@members|\{members\}|\{miembros\}|\{total\}/gi, String(memberCount || 1))
    .replace(/@time|\{time\}|\{hora\}/gi, timeFormatted);
}

export default async (client, m) => {
  // Remove previous listeners to prevent duplication on reconnect
  client.ev.removeAllListeners('group-participants.update');
  client.ev.on('group-participants.update', async (anu) => {
    try {
      // Ignorar eventos acumulados mientras el bot estuvo apagado (primeros 15s desde conexión)
      if (!global.botReady || (Date.now() - (global.bootTime || 0)) < 15000) return;

      const metadata = await getGroupMeta(client, anu.id)
      const groupAdmins = metadata?.participants.filter(p => (p.admin === 'admin' || p.admin === 'superadmin')) || []
      const chat = global?.db?.data?.chats?.[anu.id]
      const botId = getBotId(client)
      const primaryBotId = chat?.primaryBot
      const memberCount = metadata?.participants?.length || 1
      const isSelf = getBotSettings(client)?.self ?? false
      if (isSelf) return
      
      for (const p of anu.participants) {
        const jid = typeof p === 'string' ? p : (p.id || p.phoneNumber || String(p));
        const phone = jid.split('@')[0];
        const pp = await client.profilePictureUrl(jid, 'image').catch(_ => 'https://cdn.yuki-wabot.my.id/files/2PVh.jpeg');
        const botSettings = getBotSettings(client)
        const newsletterJid = (botSettings.newsletter_id && botSettings.newsletter_id.endsWith('@newsletter'))
          ? botSettings.newsletter_id
          : '120363401404146384@newsletter';
        const fakeContext = {
          contextInfo: {
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
              newsletterJid: newsletterJid,
              serverMessageId: '100',
              newsletterName: botSettings.nameid || botSettings.namebot || 'YukiBot'
            },
            externalAdReply: {
              title: botSettings.namebot,
              body: global.dev || '',
              mediaUrl: null,
              description: null,
              previewType: 'PHOTO',
              thumbnailUrl: botSettings.icon,
              sourceUrl: botSettings.link,
              mediaType: 1,
              renderLargerThumbnail: false
            },
            mentionedJid: [jid]
          }
        }

        const nowStr = new Date().toLocaleString('es-ES', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
        });

        if (anu.action === 'add' && chat?.welcome && (!primaryBotId || primaryBotId === botId)) {
          let caption;
          if (chat.sWelcome && chat.sWelcome.trim()) {
            caption = formatWelcomeGoodbyeText(chat.sWelcome, {
              phone, groupName: metadata.subject, groupDesc: metadata?.desc || '', memberCount
            });
          } else {
            caption = `╭┈──̇─̇─̇────̇─̇─̇──◯◝\n` +
              `┊「 *Bienvenido (⁠ ⁠ꈍ⁠ᴗ⁠ꈍ⁠)* 」\n` +
              `┊︶︶︶︶︶︶︶︶︶︶︶\n` +
              `┊  *Nombre ›* @${phone}\n` +
              `┊  *Grupo ›* ${metadata.subject}\n` +
              `┊  *Miembros ›* #${memberCount}\n` +
              `┊  *Fecha ›* ${nowStr}\n` +
              `┊┈─────̇─̇─̇─────◯◝\n` +
              `┊➤ *Usa .menu para ver los comandos.*\n` +
              `┊➤ *Ahora somos ${memberCount} miembros en el grupo.*\n` +
              `┊ ︿︿︿︿︿︿︿︿︿︿︿\n` +
              `╰─────────────────╯`;
          }
          await client.sendMessage(anu.id, { image: { url: pp }, caption, mentions: [jid], ...fakeContext })     
        }

        if ((anu.action === 'remove' || anu.action === 'leave') && chat?.goodbye && (!primaryBotId || primaryBotId === botId)) {
          let caption;
          if (chat.sGoodbye && chat.sGoodbye.trim()) {
            caption = formatWelcomeGoodbyeText(chat.sGoodbye, {
              phone, groupName: metadata.subject, groupDesc: metadata?.desc || '', memberCount
            });
          } else {
            caption = `╭┈──̇─̇─̇────̇─̇─̇──◯◝\n` +
              `┊「 *Hasta pronto (⁠╥⁠﹏⁠╥⁠)* 」\n` +
              `┊︶︶︶︶︶︶︶︶︶︶︶\n` +
              `┊  *Nombre ›* @${phone}\n` +
              `┊  *Grupo ›* ${metadata.subject}\n` +
              `┊  *Miembros ›* #${memberCount}\n` +
              `┊  *Fecha ›* ${nowStr}\n` +
              `┊┈─────̇─̇─̇─────◯◝\n` +
              `┊➤ *Ojalá vuelva pronto al grupo.*\n` +
              `┊➤ *Ahora somos ${memberCount} miembros.*\n` +
              `┊ ︿︿︿︿︿︿︿︿︿︿︿\n` +
              `╰─────────────────╯`;
          }
          await client.sendMessage(anu.id, { image: { url: pp }, caption, mentions: [jid], ...fakeContext });
        }
        if (anu.action === 'promote' && chat?.alerts && (!primaryBotId || primaryBotId === botId)) {
          const usuario = anu.author || anu.actor || ''
          const byStr = usuario ? ` por *@${usuario.split('@')[0]}*` : ''
          const adminMentions = groupAdmins.map(v => v.id || v.jid).filter(Boolean)
          const mentions = [jid, ...(usuario ? [usuario] : []), ...adminMentions]
          await client.sendMessage(anu.id, { text: `「」 *@${phone}* ha sido promovido a Administrador${byStr}.`, mentions }).catch(() => {})
        }
        if (anu.action === 'demote' && chat?.alerts && (!primaryBotId || primaryBotId === botId)) {
          const usuario = anu.author || anu.actor || ''
          const byStr = usuario ? ` por *@${usuario.split('@')[0]}*` : ''
          const adminMentions = groupAdmins.map(v => v.id || v.jid).filter(Boolean)
          const mentions = [jid, ...(usuario ? [usuario] : []), ...adminMentions]
          await client.sendMessage(anu.id, { text: `「」 *@${phone}* ha sido degradado de Administrador${byStr}.`, mentions }).catch(() => {})
        }
      }
    } catch (err) {
      console.log(chalk.gray(`[ BOT  ]  → ${err}`))
    }
  })
  // Remove previous stub handler to prevent duplication on reconnect
  if (client._stubHandler) client.ev.off('messages.upsert', client._stubHandler);
  client._stubHandler = async ({ messages }) => {
    const m = messages?.[0]
    if (!m || !m.messageStubType) return
    const id = m.key?.remoteJid
    if (!id) return
    const chat = global.db.data.chats[id]
    const botId = getBotId(client)
    const primaryBotId = chat?.primaryBot
    if (!chat?.alerts || (primaryBotId && primaryBotId !== botId)) return
    const isSelf = getBotSettings(client)?.self ?? false
    if (isSelf) return
    const actor = m.key?.participant || m.participant || m.key?.remoteJid || ''
    const phone = actor.split('@')[0] || ''
    const groupMetadata = await getGroupMeta(client, id)
    const groupAdmins = groupMetadata?.participants?.filter(p => (p.admin === 'admin' || p.admin === 'superadmin')) || []
    const adminMentions = groupAdmins.map(v => v.id || v.jid).filter(Boolean)
    const mentions = [actor, ...adminMentions].filter(Boolean)
    if (m.messageStubType == 21) {
      await client.sendMessage(id, { text: `「」 @${phone} cambió el nombre del grupo a *${m.messageStubParameters?.[0] || ''}*`, mentions }).catch(() => {})
    }
    if (m.messageStubType == 22) {
      await client.sendMessage(id, { text: `「」 @${phone} cambió el icono del grupo.`, mentions }).catch(() => {})
    }
    if (m.messageStubType == 23) {
      await client.sendMessage(id, { text: `「」 @${phone} restableció el enlace del grupo.`, mentions }).catch(() => {})
    }
    if (m.messageStubType == 24) {
      await client.sendMessage(id, { text: `「」 @${phone} cambió la descripción del grupo.`, mentions }).catch(() => {})
    }
    if (m.messageStubType == 25) {
      await client.sendMessage(id, { text: `「」 @${phone} cambió los ajustes del grupo para permitir que ${m.messageStubParameters?.[0] == 'on' ? 'solo admins' : 'todos'} puedan configurar el grupo.`, mentions }).catch(() => {})
    }
    if (m.messageStubType == 26) {
      await client.sendMessage(id, { text: `「」 @${phone} cambió los ajustes del grupo para permitir que ${m.messageStubParameters?.[0] === 'on' ? 'solo los administradores puedan enviar mensajes al grupo.' : 'todos los miembros puedan enviar mensajes al grupo.'}`, mentions }).catch(() => {})
    }
  }
  client.ev.on('messages.upsert', client._stubHandler);
}
