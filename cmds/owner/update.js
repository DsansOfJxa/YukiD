import { exec } from 'child_process';
import { promisify } from 'util';
import seeCommands, { registry } from '../../core/system/commandLoader.js';

const execAsync = promisify(exec);

export default {
  command: ['fix', 'update', 'actualizar'],
  category: 'owner',
  desc: 'Actualiza el repositorio vía git pull y recarga todos los comandos en memoria sin perder plugins.',
  isOwner: true,
  run: async (client, m) => {
    await m.react('🕒');
    try {
      let gitOutput = '';
      try {
        const { stdout, stderr } = await execAsync('git pull');
        gitOutput = (stdout || stderr || '').trim();
      } catch (gitErr) {
        gitOutput = `Git info: ${gitErr.message}`;
      }

      // Recargar todos los comandos usando el registro oficial que soporta arrays y hooks
      await seeCommands();
      const totalCmds = registry?.comandos?.size || global.comandos?.size || 0;

      let msg = `🔄 *ACTUALIZACIÓN Y RECARGA* 🔄\n\n`;
      if (gitOutput.includes('Already up to date.') || gitOutput.includes('Ya está actualizado.')) {
        msg += `📦 *Repositorio:* Ya se encuentra en la versión más reciente.\n`;
      } else {
        msg += `📦 *Git output:*\n\`\`\`\n${gitOutput.slice(0, 600)}\n\`\`\`\n\n`;
      }
      msg += `⚡ *Comandos en memoria:* ${totalCmds} activos correctamente.`;

      await m.react('✔️');
      await client.sendMessage(m.chat, { text: msg }, { quoted: m });
    } catch (e) {
      await m.react('✖️');
      await m.reply(`❌ Error durante la recarga: ${e.message}`);
    }
  },
};
