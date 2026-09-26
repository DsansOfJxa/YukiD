import { getGroupMeta, getBotId, getBotSettings } from '../../utils/tools.js';

// ── Anti-Link: WhatsApp groups/channels ──
const linkRegex = /(https?:\/\/)?(chat\.whatsapp\.com\/[0-9A-Za-z]{20,26}|whatsapp\.com\/channel\/[0-9A-Za-z]{20,26})/i
const allowedLinks = ['https://whatsapp.com/channel/0029Vb64nWqLo4hb8cuxe23n']

// ── Anti-Phishing: suspicious/scam URLs ──
const URL_REGEX = /(https?:\/\/[^\s]+)/gi;
const SUSPICIOUS_KEYWORDS = [
  'free-robux', 'free-nitro', 'robux-gratis', 'whatsapp-gold',
  'generator', 'hack', 'regalo', 'premio', 'money-free',
  'coin-gratis', 'giftcard', 'virus', 'wa.me/settings',
  'bit.ly/', 'cutt.ly/', 'tinyurl.com/', 'is.gd/', 'v.ht/',
  'peligro', 'phishing', 'steamcommunnity', 'steam-free'
];

export default async (client, m) => {
  if (!m.isGroup || !m.text) return
  // Quick regex pre-check before expensive getGroupMeta call
  if (!linkRegex.test(m.text) && !URL_REGEX.test(m.text)) return

  try {
    const groupMetadata = await getGroupMeta(client, m.chat)
    if (!groupMetadata) return
    const participants = groupMetadata.participants || []
    const groupAdmins = participants.filter(p => p.admin).map(p => p.phoneNumber || p.jid || p.id || p.lid)
    const isAdmin = groupAdmins.includes(m.sender)
    const botId = getBotId(client)
    const isBotAdmin = groupAdmins.includes(botId)
    const isSelf = getBotSettings(client)?.self ?? false
    if (isSelf || isAdmin || !isBotAdmin) return

    const chat = global?.db?.data?.chats?.[m.chat]
    const primaryBotId = chat?.primaryBot
    const isPrimary = !primaryBotId || primaryBotId === botId
    if (!isPrimary || !chat?.antilinks) return

    const command = (m.command || '').toLowerCase()
    const userName = global.db.data.users[m.sender]?.name || 'Usuario'

    // ── Check 1: WhatsApp group/channel links ──
    const isGroupLink = linkRegex.test(m.text)
    const hasAllowedLink = allowedLinks.some(link => m.text.includes(link))

    if (isGroupLink && !hasAllowedLink) {
      await client.sendMessage(m.chat, { delete: { remoteJid: m.chat, fromMe: false, id: m.key.id, participant: m.key.participant || m.sender } }).catch(() => {})
      if (command !== 'invite') {
        const isChannelLink = /whatsapp\.com\/channel\//i.test(m.text)
        await client.reply(m.chat, `> Se ha eliminado a *${userName}* del grupo por \`Anti-Link\`, no permitimos enlaces de *${isChannelLink ? 'canales' : 'otros grupos'}*.`, null).catch(() => {})
        await client.groupParticipantsUpdate(m.chat, [m.sender], 'remove').catch(() => {})
      }
      return
    }

    // ── Check 2: Phishing/suspicious URLs ──
    const hasUrl = URL_REGEX.test(m.text)
    if (!hasUrl) return

    const textLower = m.text.toLowerCase()
    const isSuspicious = SUSPICIOUS_KEYWORDS.some(keyword => textLower.includes(keyword))
    if (!isSuspicious) return

    await client.sendMessage(m.chat, { delete: { remoteJid: m.chat, fromMe: false, id: m.key.id, participant: m.key.participant || m.sender } }).catch(() => {})
    if (command !== 'invite') {
      await client.reply(m.chat, `> ⚠️ Se ha eliminado a *${userName}* del grupo por \`Anti-Phishing\`.\nSe detectó un enlace *sospechoso/peligroso*.`, null).catch(() => {})
      await client.groupParticipantsUpdate(m.chat, [m.sender], 'remove').catch(() => {})
    }
  } catch (err) {
    console.error('Error en antilink:', err)
  }
}
