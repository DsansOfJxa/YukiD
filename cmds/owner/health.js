import { UI } from '../../utils/ui.js';
import { resetAllApis } from '../../utils/healthChecker.js';

export default {
  command: ['health', 'api', 'apis'],
  category: 'owner',
  isOwner: true,
  desc: 'Verifica o restablece el estado de salud de los servicios y APIs externas.',
  run: async (client, m, args) => {
    if (args[0] === 'reset' || args[0] === 'reactivar' || args[0] === 'clear') {
      resetAllApis();
      return m.reply('✅ Todas las APIs externas han sido restablecidas manualmente a **ONLINE** en el HealthChecker y Circuit Breaker.');
    }

    const key = (
      await client.sendMessage(
        m.chat,
        { text: `> ${UI?.symbols?.loading || '⏳'} Comprobando el estado de los servicios, por favor espera...` },
        { quoted: m }
      )
    ).key;

    const endpoints = [
      { name: 'Pollinations AI (Image/Text)', url: 'https://image.pollinations.ai/prompt/test?width=10&height=10' },
      { name: 'Siputzx API', url: 'https://api.siputzx.my.id/api/ai/gemini' },
      { name: 'Ryzen VIP API', url: 'https://api.ryzendesu.vip/api/ai/gemini-pro' },
      { name: 'Midvash (Bible API)', url: 'https://api.midvash.com/api/v1/bible/es/rvr1960/juan/3/16' },
      { name: 'TinyURL Service', url: 'https://tinyurl.com/api-create.php?url=https://google.com' },
    ];

    let resultsText = '';
    let onlineCount = 0;
    let checkedCount = 0;

    for (const ep of endpoints) {
      if (!ep.url) continue;
      checkedCount++;
      const start = Date.now();
      try {
        const res = await fetch(ep.url, {
          method: 'GET',
          signal: AbortSignal.timeout(4000),
        });
        const ms = Date.now() - start;

        // Códigos 200, 400, o 401 indican que el servidor está alcanzable
        if (res.ok || res.status === 400 || res.status === 401 || res.status === 403) {
          const succSymbol = UI?.symbols?.success || '🟢';
          resultsText += `\n${succSymbol} *${ep.name}*\n⏱️ ${ms}ms · Status: ${res.status}`;
          onlineCount++;
        } else {
          const warnSymbol = UI?.symbols?.warn || '🟡';
          resultsText += `\n${warnSymbol} *${ep.name}*\n⚠️ Inestable (${res.status})`;
        }
      } catch (err) {
        const errSymbol = UI?.symbols?.error || '🔴';
        resultsText += `\n${errSymbol} *${ep.name}*\n❌ Fuera de línea (${err.name === 'TimeoutError' ? 'Timeout' : 'Error'})`;
      }
    }

    const report =
      `╭━━━━ 🌐 *ESTADO DE SERVICIOS* ━━━━╮\n` +
      `│ Total verificados: ${checkedCount}\n` +
      `│ En línea: ${onlineCount} | Fuera de línea: ${checkedCount - onlineCount}\n` +
      `├──────────────────────────┤` +
      `${resultsText}\n` +
      `╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

    await client.sendMessage(m.chat, { text: report, edit: key });
  },
};
