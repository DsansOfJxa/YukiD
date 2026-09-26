import os from 'os'
import { bytesToSize, getBotId, getBotSettings } from '../../utils/tools.js'

function getDefaultHostId() {
  if (process.env.HOSTNAME) {
    return process.env.HOSTNAME.split('-')[0]
  }
  return 'default_host_id'
}

const format = bytesToSize

export default {
  command: ['status', 'server', 'servidor'],
  category: 'info',
  desc: 'Muestra el estado del servidor y del bot.',
  run: async (client, m) => {
    const hostId = getDefaultHostId()
    let gCount = 0; if(global.db.data.chats) for(let c in global.db.data.chats) gCount++;
    const registeredGroups = gCount;

    let uCount = 0; if (global.db.data.users) for(let u in global.db.data.users) uCount++;
    const userCount = uCount || '0'
    const botId = getBotId(client)
    const botSettings = getBotSettings(client)
    const botname = botSettings.botname
    const totalCommands = Object.values(global.db.data.users).reduce((acc, user) => acc + (user.usedcommands || 0), 0)
    const estadoBot = `「」 Estado de *${botname}* (●\´ϖ\`●)
◇ *Usuarios registrados ›* ${userCount.toLocaleString()}
◇ *Grupos registrados ›* ${registeredGroups.toLocaleString()}
◇ *Comandos ejecutados ›* ${toNum(totalCommands)}`
    const sistema = os.type()
    const cpu = os.cpus().length
    const ramTotal = format(os.totalmem())
    const ramUsada = format(os.totalmem() - os.freemem())
    const arquitectura = os.arch()
    const estadoServidor = `➭ Estado del Servidor *₍ᐢ..ᐢ₎♡*

*Sistema ›* ${sistema}
*CPU ›* ${cpu} cores
*RAM ›* ${ramTotal}
*RAM Usado ›* ${ramUsada}
*Arquitectura ›* ${arquitectura}
*Host ID ›* ${hostId}

*❑ Uso de Memoria NODEJS*
◆ *Ram Utilizada* › ${format(process.memoryUsage().rss)}
◆ *Heap Reservado* › ${format(process.memoryUsage().heapTotal)}
◆ *Heap Usado* › ${format(process.memoryUsage().heapUsed)}
◆ *Módulos Nativos* › ${format(process.memoryUsage().external)}
◆ *Buffers de Datos* › ${format(process.memoryUsage().arrayBuffers)}`
    const mensajeEstado = `${estadoBot}\n\n${estadoServidor}`
    await client.reply(m.chat, mensajeEstado, m)
  }
}

function toNum(number) {
  if (number >= 1000 && number < 1000000) {
    return (number / 1000).toFixed(1) + 'k'
  } else if (number >= 1000000) {
    return (number / 1000000).toFixed(1) + 'M'
  } else {
    return number.toString()
  }
}