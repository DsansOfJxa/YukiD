import { getBotId, getBotSettings } from '../../utils/tools.js';

export default {
  command: ['config', 'settings', 'ajustes'],
  category: 'owner',
  desc: 'Panel de control visual para configurar parámetros globales del bot en caliente.',
  usage: '[opción] [valor]',
  isOwner: true,

  run: async (client, m, args, usedPrefix, command) => {
    const settings = getBotSettings(client);

    if (!args[0]) {
      const panel = `╭━━━━ ⚙️ *PANEL DE CONTROL* ━━━━╮
┃ 
┃ 1️⃣ *Nombre Corto:* ${settings.namebot || 'YukiBot'}
┃    Usa: *${usedPrefix + command} namebot [nuevo]*
┃
┃ 2️⃣ *Prefijo actual:* ${settings.prefix || '.'}
┃    Usa: *${usedPrefix + command} prefix [nuevo]*
┃
┃ 3️⃣ *Moneda de Economía:* ${settings.currency || '$'}
┃    Usa: *${usedPrefix + command} currency [símbolo]*
┃
┃ 4️⃣ *Autoleer Mensajes:* ${settings.autoread ? '✅ Activado' : '❌ Desactivado'}
┃    Usa: *${usedPrefix + command} autoread [on/off]*
┃
┃ 5️⃣ *Modo Privado (Self):* ${settings.self ? '✅ Activado' : '❌ Desactivado'}
┃    Usa: *${usedPrefix + command} self [on/off]*
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
      return m.reply(panel);
    }

    const opcion = args[0].toLowerCase();
    const valor = args.slice(1).join(' ').trim();

    if (!valor && !['autoread', 'self'].includes(opcion)) {
      return m.reply(`⚠️ Debes especificar un valor nuevo.\n*Ejemplo:* \`${usedPrefix + command} ${opcion} NuevoValor\``);
    }

    switch (opcion) {
      case 'namebot':
      case 'nombre':
        settings.namebot = valor;
        await m.reply(`✅ Nombre del bot actualizado a: *${valor}*`);
        break;

      case 'prefix':
      case 'prefijo':
        settings.prefix = valor;
        await m.reply(`✅ Prefijo actualizado a: *${valor}*`);
        break;

      case 'currency':
      case 'moneda':
        settings.currency = valor;
        await m.reply(`✅ Símbolo monetario actualizado a: *${valor}*`);
        break;

      case 'autoread':
        if (args[1] === 'on' || args[1] === '1') settings.autoread = true;
        else if (args[1] === 'off' || args[1] === '0') settings.autoread = false;
        else settings.autoread = !settings.autoread;
        await m.reply(`✅ Autoleer cambiado a: *${settings.autoread ? 'Activado' : 'Desactivado'}*`);
        break;

      case 'self':
      case 'privado':
        if (args[1] === 'on' || args[1] === '1') settings.self = true;
        else if (args[1] === 'off' || args[1] === '0') settings.self = false;
        else settings.self = !settings.self;
        await m.reply(`✅ Modo Privado (Self) cambiado a: *${settings.self ? 'Activado' : 'Desactivado'}*`);
        break;

      default:
        return m.reply('❌ Opción no válida. Usa el comando sin parámetros para ver el menú de opciones.');
    }

    // Persistencia atómica inmediata en SQLite
    global.saveDatabaseAsync?.();
  },
};
