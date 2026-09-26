import { resolveLidToRealJid } from "../../core/utils.js"
import { xpRange } from '../../utils/tools.js';


export default {
  command: ['level', 'lvl'],
  category: 'profile',
  desc: 'Muestra tu nivel y experiencia.',
  run: async (client, m, args) => {
    const db = global.db.data
    const chatId = m.chat
    const mentioned = m.mentionedJid
    const who2 = mentioned.length > 0 ? mentioned[0] : (m.quoted ? m.quoted.sender : m.sender)
    const who = await resolveLidToRealJid(who2, client, m.chat)
    const name = who
    const user = db.users[who]
    if (!user) return m.reply(`「」 El usuario mencionado no está registrado en el bot.`)
    const users = Object.entries(db.users).map(([key, value]) => ({ ...value, jid: key }))
    const sortedLevel = users.sort((a, b) => (b.level || 0) - (a.level || 0))
    const rank = sortedLevel.findIndex(u => u.jid === who) + 1
    const { min, xp } = xpRange(user.level, global.multiplier)
    const progresoActual = user.exp - min
    const porcentaje = Math.floor((progresoActual / xp) * 100)

    const txt = `*「✿」Usuario* ◢ ${db.users[who].name} ◤

Nivel › *${user.level || 0}*
☆ Experiencia › *${user.exp?.toLocaleString() || 0}*
➨ Progreso › *${progresoActual} => ${xp}* _(${porcentaje}%)_
✐ Puesto › *#${rank}*
❒ Comandos ejecutados › *${user.usedcommands?.toLocaleString() || 0}*`
    await client.sendMessage(chatId, { text: txt, mentions: [name] }, { quoted: m })
  }
}