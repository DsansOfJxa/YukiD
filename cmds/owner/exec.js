import syntaxerror from 'syntax-error';
import { format } from 'util';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(__dirname);

export default {
  command: ['ex', 'e'],
  category: 'owner',
  desc: 'Ejecuta código JavaScript en el contexto del bot (solo para el desarrollador).',
  isOwner: true,
  run: async (client, m, args, usedPrefix, command, text) => {
    if (!text || !text.trim()) {
      return m.reply('⚠️ Debes escribir una expresión o código JavaScript a ejecutar.');
    }

    const _text = (command === 'e' ? 'return ' : '') + text.trim();
    let _return, _syntax = '';

    try {
      await m.react('🕒');
      let i = 15;
      const f = { exports: {} };
      const exec = new (async () => {}).constructor(
        'print', 'm', 'client', 'require', 'Array', 'process', 'args', 'module', 'exports', 'argument',
        _text
      );

      _return = await exec.call(
        client,
        (...args) => {
          if (--i < 1) return;
          const out = format(...args);
          return m.reply(out.length > 2500 ? out.slice(0, 2500) + '...\n[Salida truncada]' : out);
        },
        m, client, require, Array, process, args, f, f.exports, [client]
      );
      await m.react('✔️');
    } catch (e) {
      const err = syntaxerror(_text, 'Execution Function', {
        allowReturnOutsideFunction: true,
        allowAwaitOutsideFunction: true,
        sourceType: 'module',
      });
      if (err) _syntax = '```' + err + '```\n\n';
      _return = e;
      await m.react('✖️');
    } finally {
      let outputStr = _syntax + format(_return);
      if (outputStr.length > 3000) {
        outputStr = outputStr.slice(0, 3000) + '\n\n⚠️ _[Salida truncada por límite de caracteres]_';
      }
      await m.reply(outputStr);
    }
  },
};