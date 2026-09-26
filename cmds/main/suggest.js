import { formatTime, getBotSettings } from '../../utils/tools.js';

export default {
  command: ['report', 'reporte', 'sug', 'suggest'],
  category: 'info',
  desc: 'Envía un reporte o sugerencia al desarrollador.',
  run: async (client, m, args, usedPrefix, command, text) => {
    const texto = text.trim()
    const now = Date.now()
    const userDb = global.db.data?.users?.[m.sender] || {}
    const cooldown = userDb.sugCooldown || 0
    const restante = cooldown - now
    if (restante > 0) {
      return m.reply(`Espera *${formatTime(restante)}* para volver a usar este comando.`)
    }
    if (!texto) {
      return m.reply(` Debes *escribir* el *reporte* o *sugerencia*.`)
    }
    if (texto.length < 10) {
      return m.reply(' Tu mensaje es *demasiado corto*. Explica mejor tu reporte/sugerencia (mínimo 10 caracteres)')
    }
    const fecha = new Date()
    const fechaLocal = fecha.toLocaleDateString('es-MX', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    const esReporte = ['report', 'reporte'].includes(command)
    const tipo  = esReporte ? '🆁ҽ𝕡σɾƚҽ' : '🆂մց𝕖ɾҽ𝚗cíᥲ'
    const tipo2 = esReporte ? 'Reporte' : 'Sugerencia'
    const user = m.pushName || 'Usuario desconocido'
    const numero = m.sender.split('@')[0]
    const pp = await client.profilePictureUrl(m.sender, 'image').catch(() => 'https://cdn.yuki-wabot.my.id/files/2PVh.jpeg')
    let reportMsg = `🫗۫᷒ᰰ⃘ׅ᷒  ۟　\`${tipo}\`　ׅ　ᩡ\n\n𖹭  ׄ  ְ *Nombre*\n${user}\n\n𖹭  ׄ  ְ *Número*\nwa.me/${numero}\n\n𖹭  ׄ  ְ *Fecha*\n${fechaLocal}\n\n𖹭  ׄ  ְ *Mensaje*\n${texto}\n\n`
    for (const num of (global.owner || [])) {
      try {
        await global.client.sendContextInfoIndex(`${num}@s.whatsapp.net`, reportMsg, {}, null, false, null, { banner: pp, title: tipo2, body: '✧ Antento Staff, mejoren.', redes: getBotSettings(client).link })
      } catch {}
    }
    if (global.db.data?.users?.[m.sender]) {
      global.db.data.users[m.sender].sugCooldown = now + 24 * 60 * 60000
    }
    m.reply(` Gracias por tu *${esReporte ? 'reporte' : 'sugerencia'}*\n\nTu mensaje fue enviado correctamente a los moderadores`)
  },
}

