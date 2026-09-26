import { resolveLidToRealJid } from "../../core/utils.js";
import { getBotSettings } from "../../utils/tools.js";

export default {
  command: ['addcoin', 'addxp', 'delcoin', 'delxp', 'setcoin', 'setxp'],
  category: 'owner',
  desc: 'Añade, remueve o establece monedas (coins) y experiencia (XP) de cualquier usuario.',
  usage: '[@usuario / responder] [cantidad]',
  isOwner: true,
  run: async (client, m, args, usedPrefix, command) => {
    try {
      const mentioned = m.mentionedJid;
      let who2 = mentioned && mentioned.length > 0
        ? mentioned[0]
        : (m.quoted ? m.quoted.sender : null);

      // Si no hay mención ni quoted, intentar con argumento de número telefónico
      if (!who2 && args[0] && /^@?[0-9]{7,16}$/.test(args[0].replace(/@s\.whatsapp\.net$/, ''))) {
        who2 = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
      }

      if (!who2) {
        return m.reply(`⚠️ Por favor, menciona al usuario o cita un mensaje.\n*Ejemplo:* \`${usedPrefix + command} @usuario 1000\``);
      }

      const who = await resolveLidToRealJid(who2, client, m.chat);
      if (!who) return m.reply('❌ No se pudo resolver el usuario.');

      const bot = getBotSettings(client);
      const currency = bot.currency || '$';

      const numTxt = args.find((arg) => !isNaN(arg) && !arg.includes('@'));
      if (!numTxt) {
        return m.reply(`⚠️ Ingresa una cantidad válida.\n*Ejemplo:* \`${usedPrefix + command} @usuario 1000\``);
      }

      const val = parseInt(numTxt);
      if (isNaN(val) || val < 0) {
        return m.reply('❌ Solo se permiten números enteros positivos.');
      }

      await m.react('🕒');

      if (!global.db.data.users) global.db.data.users = {};
      if (!global.db.data.users[who]) {
        global.db.data.users[who] = { coins: 0, exp: 0, bank: 0 };
      }

      const user = global.db.data.users[who];
      user.coins = typeof user.coins === 'number' ? user.coins : 0;
      user.exp = typeof user.exp === 'number' ? user.exp : 0;

      const userTag = `@${who.split('@')[0]}`;
      let responseText = '';

      switch (command) {
        case 'addcoin':
          user.coins += val;
          responseText = `💰 *Monedas Añadidas*\nSe añadieron *+${val.toLocaleString()} ${currency}* a ${userTag}.\nSaldo actual: *${user.coins.toLocaleString()} ${currency}*`;
          break;

        case 'delcoin':
          user.coins = Math.max(0, user.coins - val);
          responseText = `💸 *Monedas Retiradas*\nSe retiraron *-${val.toLocaleString()} ${currency}* a ${userTag}.\nSaldo actual: *${user.coins.toLocaleString()} ${currency}*`;
          break;

        case 'setcoin':
          user.coins = val;
          responseText = `💵 *Saldo Establecido*\nEl saldo de ${userTag} se ha fijado en *${val.toLocaleString()} ${currency}*.`;
          break;

        case 'addxp':
          user.exp += val;
          responseText = `✨ *XP Añadida*\nSe añadieron *+${val.toLocaleString()} XP* a ${userTag}.\nXP actual: *${user.exp.toLocaleString()} XP*`;
          break;

        case 'delxp':
          user.exp = Math.max(0, user.exp - val);
          responseText = `🔻 *XP Retirada*\nSe retiraron *-${val.toLocaleString()} XP* a ${userTag}.\nXP actual: *${user.exp.toLocaleString()} XP*`;
          break;

        case 'setxp':
          user.exp = val;
          responseText = `🎯 *XP Establecida*\nLa experiencia de ${userTag} se ha fijado en *${val.toLocaleString()} XP*.`;
          break;
      }

      // Persistir inmediatamente en SQLite
      global.saveDatabaseAsync?.();

      await m.react('✔️');
      return client.sendMessage(m.chat, { text: responseText, mentions: [who] }, { quoted: m });
    } catch (error) {
      console.error('[Owner Add Error]:', error);
      await m.react('✖️');
      return m.reply(`⚠️ Se produjo un error al procesar el comando:\n${error.message}`);
    }
  },
};
