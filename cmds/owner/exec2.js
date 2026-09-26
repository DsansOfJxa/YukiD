import cp, { exec as _exec } from 'child_process';
import { promisify } from 'util';

const exec = promisify(_exec).bind(cp);

export default {
  command: ['r', 'bash', 'sh'],
  category: 'owner',
  desc: 'Ejecuta comandos de consola del sistema operativo (solo dueño).',
  isOwner: true,
  run: async (client, m, args, usedPrefix, command, text) => {
    if (!text || !text.trim()) {
      return m.reply('⚠️ Debes escribir un comando de shell a ejecutar.');
    }

    let o;
    try {
      await m.react('🕒');
      o = await exec(text.trim(), { timeout: 30000 });
      await m.react('✔️');
    } catch (e) {
      o = e;
      await m.react('✖️');
    } finally {
      const { stdout, stderr } = o || {};
      if (stdout && stdout.trim()) {
        const out = stdout.trim();
        await m.reply(out.length > 3000 ? out.slice(0, 3000) + '\n\n⚠️ _[Salida truncada]_' : out);
      }
      if (stderr && stderr.trim()) {
        const errOut = stderr.trim();
        await m.reply(errOut.length > 3000 ? errOut.slice(0, 3000) + '\n\n⚠️ _[Stderr truncado]_' : errOut);
      }
      if (!stdout?.trim() && !stderr?.trim() && o?.message) {
        await m.reply(`❌ ${o.message}`);
      }
    }
  },
};