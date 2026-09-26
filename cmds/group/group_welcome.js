/**
 * 🚪 group_welcome.js — Comandos de bienvenida, despedida y configuración de ajustes del grupo.
 * Reúne: setwelcome, setgoodbye, options
 */

const SETTINGS_MAP = {
  antilink: { key: 'antilinks', name: 'el AntiEnlace', title: 'AntiEnlace' },
  antienlaces: { key: 'antilinks', name: 'el AntiEnlace', title: 'AntiEnlace' },
  antilinks: { key: 'antilinks', name: 'el AntiEnlace', title: 'AntiEnlace' },
  alerts: { key: 'alerts', name: 'las Alertas', title: 'Alertas' },
  alertas: { key: 'alerts', name: 'las Alertas', title: 'Alertas' },
  adminonly: { key: 'adminonly', name: 'el modo Solo Admins', title: 'AdminOnly' },
  onlyadmin: { key: 'adminonly', name: 'el modo Solo Admins', title: 'AdminOnly' },
  welcome: { key: 'welcome', name: 'la Bienvenida', title: 'Bienvenida' },
  bienvenida: { key: 'welcome', name: 'la Bienvenida', title: 'Bienvenida' },
  memberwelcome: { key: 'welcome', name: 'la Bienvenida', title: 'Bienvenida' },
  goodbye: { key: 'goodbye', name: 'la Despedida', title: 'Despedida' },
  despedida: { key: 'goodbye', name: 'la Despedida', title: 'Despedida' },
  economy: { key: 'economy', name: 'la Economía RPG', title: 'Economía' },
  economia: { key: 'economy', name: 'la Economía RPG', title: 'Economía' },
  antistatus: { key: 'antistatus', name: 'el AntiEstado', title: 'AntiEstado' },
  antiestados: { key: 'antistatus', name: 'el AntiEstado', title: 'AntiEstado' },
  nsfw: { key: 'nsfw', name: 'el contenido NSFW', title: 'NSFW' }
};

const cmdSetWelcome = {
  command: ['setwelcome'],
  category: 'grupo',
  desc: 'Establecer un mensaje de bienvenida personalizado.',
  isAdmin: true,
  run: async (client, m, args, usedPrefix, command, text) => {
    const chat = global.db.data?.chats?.[m.chat];
    if (!chat) return;

    if (!args.length) {
      return m.reply(
        `👋 *Configuración de Bienvenida*\n\n` +
        `*Variables disponibles:*\n` +
        `• *@user* o *{usuario}* ➔ Mención del nuevo miembro\n` +
        `• *@group* o *{grupo}* ➔ Nombre del grupo\n` +
        `• *@desc* o *{desc}* ➔ Descripción del grupo\n` +
        `• *@members* o *{miembros}* ➔ Total de miembros\n` +
        `• *@time* o *{hora}* ➔ Fecha y hora actual\n\n` +
        `*📌 Ejemplo:* \`${usedPrefix + command} ¡Hola @user! Bienvenido a @group.\`\n` +
        `*🔄 Borrar personalizado:* \`${usedPrefix + command} clear\``
      );
    }

    if (args[0].toLowerCase() === 'clear') {
      chat.sWelcome = '';
      return m.reply('> ✅ *Mensaje de bienvenida personalizado eliminado.* Se usará la plantilla predeterminada.');
    }

    chat.sWelcome = text ? text.trim() : '';
    return m.reply('> ✅ *Mensaje de bienvenida personalizado guardado correctamente.*');
  }
};

const cmdSetGoodbye = {
  command: ['setgoodbye'],
  category: 'grupo',
  desc: 'Establecer un mensaje de despedida personalizado.',
  isAdmin: true,
  run: async (client, m, args, usedPrefix, command, text) => {
    const chat = global.db.data?.chats?.[m.chat];
    if (!chat) return;

    if (!args.length) {
      return m.reply(
        `🚪 *Configuración de Despedida*\n\n` +
        `*Variables disponibles:*\n` +
        `• *@user* o *{usuario}* ➔ Mención del usuario que sale\n` +
        `• *@group* o *{grupo}* ➔ Nombre del grupo\n` +
        `• *@members* o *{miembros}* ➔ Total de miembros restantes\n\n` +
        `*📌 Ejemplo:* \`${usedPrefix + command} Adiós @user, te extrañaremos en @group.\`\n` +
        `*🔄 Borrar personalizado:* \`${usedPrefix + command} clear\``
      );
    }

    if (args[0].toLowerCase() === 'clear') {
      chat.sGoodbye = '';
      return m.reply('> ✅ *Mensaje de despedida personalizado eliminado.* Se usará la plantilla predeterminada.');
    }

    chat.sGoodbye = text ? text.trim() : '';
    return m.reply('> ✅ *Mensaje de despedida personalizado guardado correctamente.*');
  }
};

const cmdOptions = {
  command: [
    'alerts', 'alertas',
    'antilink', 'antienlaces', 'antilinks',
    'adminonly', 'onlyadmin',
    'welcome', 'bienvenida', 'memberwelcome',
    'goodbye', 'despedida',
    'economy', 'economia',
    'nsfw',
    'antistatus', 'antiestados'
  ],
  category: 'grupo',
  desc: 'Activar o desactivar funciones del grupo.',
  isAdmin: true,
  run: async (client, m, args, usedPrefix, command) => {
    const chatData = global.db.data?.chats?.[m.chat];
    if (!chatData) return;

    const setting = SETTINGS_MAP[command.toLowerCase()];
    if (!setting) return;

    const { key, name, title } = setting;
    const stateArg = args[0]?.toLowerCase();
    const current = Boolean(chatData[key]);

    if (!stateArg) {
      return m.reply(
        `⚙️ *Ajustes de ${title}*\n\n` +
        `*Estado actual:* ${current ? '🟢 Activado' : '🔴 Desactivado'}\n\n` +
        `*Uso:*\n` +
        `• Activar: \`${usedPrefix + command} on\` o \`${usedPrefix + command} enable\`\n` +
        `• Desactivar: \`${usedPrefix + command} off\` o \`${usedPrefix + command} disable\``
      );
    }

    const isEnable = ['on', 'enable', '1', 'si', 'activar'].includes(stateArg);
    const isDisable = ['off', 'disable', '0', 'no', 'desactivar'].includes(stateArg);

    if (!isEnable && !isDisable) {
      return m.reply(`> ⚠️ *Estado inválido.* Usa \`${usedPrefix + command} on\` o \`${usedPrefix + command} off\`.`);
    }

    if (current === isEnable) {
      return m.reply(`> ⚠️ *${title}* ya se encontraba *${isEnable ? 'activado' : 'desactivado'}*.`);
    }

    chatData[key] = isEnable ? 1 : 0;
    return m.reply(`> ✅ Has *${isEnable ? 'activado' : 'desactivado'}* ${name} en este grupo.`);
  }
};

export default [cmdSetWelcome, cmdSetGoodbye, cmdOptions];
