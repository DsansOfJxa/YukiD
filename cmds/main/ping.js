import { getBotSettings } from '../../utils/tools.js';

export default {
  command: ['ping', 'speed', 'latencia'],
  category: 'info',
  desc: 'Muestra la latencia actual del bot.',
  run: async (client, m) => {
    const start = Date.now()
    const sent = await client.sendMessage(m.chat, { text: '`❏ ¡Pong!`' + `\n*${getBotSettings(client)?.namebot || 'Bot'}*`}, { quoted: m })
    const latency = Date.now() - start
    await client.sendMessage(m.chat, { text: `✿ *Pong!*\nTiempo ${latency.toFixed(4).split(".")[0]}ms`, edit: sent.key }, { quoted: m })
  },
};
