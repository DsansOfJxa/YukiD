import { xpRange } from '../../utils/tools.js';

export default {
  command: ['lboard', 'lb', 'leaderboard'],
  category: 'profile',
  desc: 'Ranking de niveles del grupo.',
  run: async (client, m, args, usedPrefix, command) => {
    const db = global.db.data
    try {
      const users = Object.entries(db.users || {}).filter(([_, data]) => (data.exp || 0) >= 1).map(([key, data]) => {
          const name = data.name || 'Usuario'
          const exp = data.exp || 0
          const level = data.level || 0
          const { min, xp } = xpRange(level, global.multiplier)
          const progreso = exp - min
          const porcentaje = xp > 0 ? Math.floor((progreso / xp) * 100) : 0
          return { jid: key, name, exp, level, progreso, xp, porcentaje }
        })
      if (users.length === 0)
        return m.reply(`No hay usuarios registrados con experiencia.`)
      const sorted = users.sort((a, b) => (b.exp || 0) - (a.exp || 0))
      const page = parseInt(args[0]) || 1
      const pageSize = 10
      const totalPages = Math.ceil(sorted.length / pageSize)
      if (isNaN(page) || page < 1 || page > totalPages) return m.reply(` La página *${page}* no existe. Hay *${totalPages}* páginas.`)
      const start = (page - 1) * pageSize
      const end = start + pageSize
      let text = `*✩ Top de usuarios con más experiencia ✩*\n\n`
      text += sorted.slice(start, end).map(({ name, exp, level, progreso, xp, porcentaje }, i) => {
          return `✩ ${start + i + 1} › *${name}*\n     XP → *${exp.toLocaleString()}*  LVL → *${level}*\n     ➨ Progreso → *${progreso} => ${xp}* _(${porcentaje}%)_`
        }).join('\n\n')
      text += `\n\n⌦ Página *${page}* de *${totalPages}*`
      if (page < totalPages)
        text += `\nPara ver la siguiente página › *${usedPrefix + command} ${page + 1}*`
      await client.sendMessage(m.chat, { text }, { quoted: m })
    } catch (e) {
      await m.reply(`> Error al ejecutar el comando.\n[Error: *${e.message}*]`)
    }
  }
}
