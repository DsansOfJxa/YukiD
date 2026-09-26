import os from 'os';
import { runtime, getBotId, getBotSettings } from '../../utils/tools.js';


export default {
  command: ['infobot', 'infosocket'],
  category: 'info',
  desc: 'Muestra información técnica del bot.',
  run: async (client, m, args, usedPrefix, command) => {
    const botId = getBotId(client)
    const botSettings = getBotSettings(client)
    const botname = botSettings.botname
    const namebot = botSettings.namebot
    const monedas = botSettings.currency
    const banner = botSettings.banner || ''
    const prefijo = botSettings.prefix
    const owner = botSettings.owner
    const canalId = botSettings.id
    const canalName = botSettings.nameid
    const link = botSettings.link
    let desar = 'Oculto'
    if (owner && !isNaN(owner.replace(/@s\.whatsapp\.net$/, ''))) {
      const userData = global.db.data?.users?.[owner]
      desar = userData?.genre || 'Oculto'
    }
    const platform = os.type()
    const now = new Date()
    const colombianTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Bogota' }))
    const nodeVersion = process.version
    const sistemaUptime = runtime(os.uptime())
    const uptime = process.uptime()
    const uptimeDate = new Date(colombianTime.getTime() - uptime * 1000)
    const formattedUptimeDate = uptimeDate.toLocaleString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).replace(/^./, m => m.toUpperCase())

    try {
    const message = `✐ Información del bot *${botname}!*

✿ *Nombre Corto ›* ${namebot}
✿ *Nombre Largo ›* ${botname}
✦ *Moneda ›* ${monedas}
✦ *Prefijo${Array.isArray(prefijo) && prefijo.length > 1 ? 's' : ''} ›* ${prefijo === true ? '`sin prefijos`' : (Array.isArray(prefijo) ? prefijo : [prefijo || '/']).map(p => `\`${p}\``).join(', ')}


❒ *Plataforma ›* ${platform}
❒ *NodeJS ›* ${nodeVersion}
❒ *Activo desde ›* ${formattedUptimeDate}
❒ *Sistema Activo ›* ${sistemaUptime}
❒ *${desar === 'Hombre' ? 'Dueño' : desar === 'Mujer' ? 'Dueña' : 'Dueño(a)'} ›* ${owner ? (!isNaN(owner.replace(/@s\.whatsapp\.net$/, '')) ? `@${owner.split('@')[0]}` : owner) : "Oculto por privacidad"}

\`Enlace:\` ${link}`.trim()
      const safeCanalId = (canalId && canalId.endsWith('@newsletter')) ? canalId : '120363401404146384@newsletter';
      const isVideo = banner && (banner.includes('.mp4') || banner.includes('.webm'));
      await client.sendMessage(m.chat, isVideo ? {
            video: { url: banner },
            gifPlayback: true,
            caption: message,
            contextInfo: {
              mentionedJid: [owner, m.sender],
              isForwarded: true,
              forwardedNewsletterMessageInfo: {
                newsletterJid: safeCanalId,
                serverMessageId: '100',
                newsletterName: canalName || 'YukiBot'
              }
            }
          } : {
            text: message,
            contextInfo: {
              mentionedJid: [owner, m.sender],
              isForwarded: true,
              forwardedNewsletterMessageInfo: {
                newsletterJid: safeCanalId,
                serverMessageId: '100',
                newsletterName: canalName || 'YukiBot'
              },
              externalAdReply: {
                title: botname,
                body: `${namebot}, mᥲძᥱ ᥕі𝗍һ ᑲᥡ ⁱᵃᵐ|𝔇ĕ𝐬†𝓻⊙γ𒆜`,
                showAdAttribution: false,
                thumbnailUrl: banner || 'https://cdn.yuki-wabot.my.id/files/2PVh.jpeg',
                mediaType: 1,
                previewType: 0,
                renderLargerThumbnail: true
              }
            }
          }, { quoted: m });
   } catch (e) {
     return m.reply(`> Error al ejecutar el comando.\n[Error: *${e.message}*]`)
   }
  }
};
