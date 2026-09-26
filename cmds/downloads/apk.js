import { search, download } from 'aptoide-scraper'
import { getBuffer } from "../../core/message.js"

export default {
  command: ['apk', 'aptoide', 'apkdl'],
  category: 'downloads',
  heavy: true,
  desc: 'Descargar APKs.',
  run: async (client, m, args, usedPrefix, command) => {
    if (!args || !args.length) {
      return m.reply(' Por favor, ingresa el nombre de la aplicación.')
    }
    const query = args.join(' ').trim()
    try {
      const searchA = await search(query)
      if (!searchA || searchA.length === 0) {
        return m.reply(' No se encontraron resultados.')
      }
      const apkInfo = await download(searchA[0].id)
      if (!apkInfo) {
        return m.reply(' No se pudo obtener la información de la aplicación.')
      }
      const { name, package: id, size, icon, dllink: downloadUrl, lastup } = apkInfo
      const caption = `✰ ᩧ　𓈒　ׄ　Aptoide 　ׅ　✿\n\n` +
        `➩ *Nombre ›* ${name}\n` +
        `*Paquete ›* ${id}\n` +
        `✿ *Última actualización ›* ${lastup}\n` +
        `☆ *Tamaño ›* ${size}`
      const sizeBytes = parseSize(size)
      if (sizeBytes > 524288000) {
        return m.reply(` El archivo es demasiado grande (${size}).\nDescárgalo directamente desde aquí:\n${downloadUrl}`)
      }
      await client.sendMessage(m.chat, { document: { url: downloadUrl }, mimetype: 'application/vnd.android.package-archive', fileName: `${name}.apk`, caption }, { quoted: m })
     } catch (e) {
      await m.reply(`> Error al descargar la APK.\n[Error: *${e.message}*]`)
    }
  },
}

function parseSize(sizeStr) {
  if (!sizeStr) return 0
  const parts = sizeStr.trim().toUpperCase().split(' ')
  const value = parseFloat(parts[0])
  const unit = parts[1] || 'B'
  switch (unit) {
    case 'KB': return value * 1024
    case 'MB': return value * 1024 * 1024
    case 'GB': return value * 1024 * 1024 * 1024
    default: return value
  }
}
