/**
 * 🏦 rpg_bank.js — Comandos de finanzas, banco y transferencias RPG.
 * Incluye: balance, deposit, withdraw, givecoins, trade, economyboard
 */
import { getBotCurrency } from '../../utils/tools.js';
import { resolveLidToRealJid } from '../../core/utils.js';
import { RARE_MAP } from './rpg_shop.js';

const cmdBalance = {
  command: ['balance', 'bal', 'saldo', 'coins', 'money'],
  category: 'economia',
  desc: 'Ver el balance de monedas y salud actual.',
  economy: true,
  run: async (client, m) => {
    const currency = getBotCurrency(client);
    const user = global.db.data?.users?.[m.sender] || {};
    const coins = user.coins || 0;
    const bank = user.bank || 0;
    const total = coins + bank;
    const health = user.health ?? 100;
    const name = user.name || m.sender.split('@')[0];

    const text = `「✿」 *Balance de ${name}*\n\n` +
      `🪙 *Cartera:* ¥${coins.toLocaleString()} ${currency}\n` +
      `🏦 *Banco:* ¥${bank.toLocaleString()} ${currency}\n` +
      `💰 *Total:* ¥${total.toLocaleString()} ${currency}\n` +
      `❤️ *Salud:* ${health}/100`;

    return client.sendMessage(m.chat, { text }, { quoted: m });
  }
};

const cmdDeposit = {
  command: ['dep', 'deposit', 'd', 'depositar'],
  category: 'economia',
  desc: 'Depositar monedas de la cartera en el banco para protegerlas.',
  economy: true,
  run: async (client, m, args) => {
    const currency = getBotCurrency(client);
    const user = global.db.data?.users?.[m.sender];
    if (!user) return;

    if (!args[0]) {
      return m.reply(`🏦 Ingresa la cantidad de *${currency}* a depositar.\n*Uso:* \`.dep <cantidad>\` o \`.dep all\``);
    }

    const isAll = args[0].toLowerCase() === 'all' || args[0].toLowerCase() === 'todo';
    const amount = isAll ? (user.coins || 0) : parseInt(args[0]);

    if (isNaN(amount) || amount <= 0) {
      return m.reply('⚠️ Ingresa una cantidad válida para depositar.');
    }

    if ((user.coins || 0) < amount) {
      return m.reply(`❌ No tienes suficientes *${currency}* en cartera para depositar esa cantidad.`);
    }

    user.coins = (user.coins || 0) - amount;
    user.bank = (user.bank || 0) + amount;

    return m.reply(`✅ Has depositado *¥${amount.toLocaleString()} ${currency}* en tu cuenta bancaria.`);
  }
};

const cmdWithdraw = {
  command: ['withdraw', 'with', 'retirar'],
  category: 'economia',
  desc: 'Retirar monedas del banco hacia la cartera.',
  economy: true,
  run: async (client, m, args, usedPrefix, command) => {
    const currency = getBotCurrency(client);
    const user = global.db.data?.users?.[m.sender];
    if (!user) return;

    if (!args[0]) {
      return m.reply(`🏦 Ingresa la cantidad de *${currency}* a retirar.\n*Uso:* \`${usedPrefix + command} <cantidad>\` o \`${usedPrefix + command} all\``);
    }

    const isAll = args[0].toLowerCase() === 'all' || args[0].toLowerCase() === 'todo';
    const amount = isAll ? (user.bank || 0) : parseInt(args[0]);

    if (isNaN(amount) || amount <= 0) {
      return m.reply('⚠️ Ingresa una cantidad válida para retirar.');
    }

    if ((user.bank || 0) < amount) {
      return m.reply(`❌ Fondos insuficientes en el banco (*¥${(user.bank || 0).toLocaleString()} ${currency}* disponibles).`);
    }

    user.bank = (user.bank || 0) - amount;
    user.coins = (user.coins || 0) + amount;

    return m.reply(`✅ Has retirado *¥${amount.toLocaleString()} ${currency}* del banco.`);
  }
};

const cmdGiveCoins = {
  command: ['givecoins', 'pay', 'coinsgive', 'transferir'],
  category: 'economia',
  desc: 'Transferir monedas de tu banco al banco de otro usuario.',
  economy: true,
  group: true,
  run: async (client, m, args, usedPrefix, command) => {
    const db = global.db.data;
    const currency = getBotCurrency(client);
    const mentioned = m.mentionedJid || [];
    const targetRaw = m.quoted ? m.quoted.sender : mentioned[0] || (args[1] ? (args[1].replace(/[@ .+-]/g, '') + '@s.whatsapp.net') : null);

    if (!targetRaw) {
      return m.reply(`⚠️ Menciona al usuario a quien deseas transferir *${currency}*.\n*Ejemplo:* \`${usedPrefix + command} 5000 @usuario\``);
    }

    const who = await resolveLidToRealJid(targetRaw, client, m.chat);
    if (!who || !(who in db.users)) {
      return m.reply('❌ El usuario mencionado no está registrado en el bot.');
    }
    if (who === m.sender) {
      return m.reply('❌ No puedes transferirte monedas a ti mismo.');
    }

    const senderUser = db.users[m.sender];
    const targetUser = db.users[who];

    const inputAmount = (args[0] || '').toLowerCase();
    const amount = inputAmount === 'all' ? (senderUser.bank || 0) : parseInt(inputAmount);

    if (isNaN(amount) || amount <= 0) {
      return m.reply(`⚠️ Ingresa una cantidad válida de *${currency}* para transferir.`);
    }

    senderUser.bank = senderUser.bank || 0;
    if (senderUser.bank < amount) {
      return m.reply(`❌ No tienes suficientes fondos en el banco para transferir.\n*Tu saldo bancario:* ¥${senderUser.bank.toLocaleString()} ${currency}`);
    }

    senderUser.bank -= amount;
    targetUser.bank = (targetUser.bank || 0) + amount;

    const targetName = targetUser.name || who.split('@')[0];
    return client.sendMessage(m.chat, {
      text: `💸 *TRANSFERENCIA BANCARIA EXITOSA*\n\n` +
        `Enviare *¥${amount.toLocaleString()} ${currency}* a *${targetName}*.\n` +
        `🏦 Tu nuevo saldo bancario: *¥${senderUser.bank.toLocaleString()}*`,
      mentions: [who]
    }, { quoted: m });
  }
};

const cmdTrade = {
  command: ['trade', 'tradear', 'intercambiar'],
  category: 'economia',
  desc: 'Intercambia un artículo raro con otro jugador.',
  economy: true,
  usage: '.trade @usuario <item_id>',
  cooldown: 5,
  run: async (client, m, args, usedPrefix) => {
    const mentioned = m.mentionedJid || [];
    const targetRaw = mentioned[0] || (m.quoted ? m.quoted.sender : null);
    if (!targetRaw) {
      return m.reply(`⚠️ Menciona al usuario con quien deseas intercambiar.\n*Uso:* \`${usedPrefix}trade @usuario <item_id>\``);
    }

    const target = await resolveLidToRealJid(targetRaw, client, m.chat);
    if (target === m.sender) {
      return m.reply('❌ No puedes hacer un intercambio contigo mismo.');
    }

    const itemId = args.find(a => !a.startsWith('@'))?.toLowerCase();
    if (!itemId) {
      return m.reply(`⚠️ Especifica el ID del artículo raro a tradear.\n*Ejemplo:* \`${usedPrefix}trade @usuario gema_dragon\``);
    }

    const db = global.db.data;
    const senderUser = db.users[m.sender] || {};
    const receiverUser = db.users[target];
    if (!receiverUser) {
      return m.reply('❌ Ese usuario no se encuentra registrado en el bot.');
    }

    senderUser.inventory ??= [];
    receiverUser.inventory ??= [];

    const idx = senderUser.inventory.indexOf(itemId);
    if (idx === -1) {
      return m.reply(`❌ No posees \`${itemId}\` en tu inventario.`);
    }

    const rareItem = RARE_MAP.get(itemId);
    if (!rareItem) {
      return m.reply('❌ Solo puedes transferir artículos raros (provenientes de cofres). Los ítems estándar de la tienda no son transferibles.');
    }

    // Transferencia segura
    senderUser.inventory.splice(idx, 1);
    receiverUser.inventory.push(itemId);

    const senderName = senderUser.name || m.sender.split('@')[0];
    const receiverName = receiverUser.name || target.split('@')[0];

    return client.sendMessage(m.chat, {
      text: `🔄 *INTERCAMBIO COMPLETADO*\n\n` +
        `*${senderName}* le ha entregado *${rareItem.name}* a *${receiverName}*.\n\n` +
        `_${rareItem.desc}_`,
      mentions: [m.sender, target]
    }, { quoted: m });
  }
};

const cmdEconomyBoard = {
  command: ['economyboard', 'eboard', 'baltop'],
  category: 'economia',
  desc: 'Ranking de los usuarios más adinerados.',
  economy: true,
  run: async (client, m, args, usedPrefix, command) => {
    const currency = getBotCurrency(client);
    const usersData = global.db.data?.users || {};

    // Filtrar y proyectar de forma ligera sin clonar objetos completos
    const eligible = [];
    for (const [jid, data] of Object.entries(usersData)) {
      const total = (data.coins || 0) + (data.bank || 0);
      if (total >= 1000) {
        eligible.push({
          name: data.name || jid.split('@')[0],
          total
        });
      }
    }

    if (!eligible.length) {
      return m.reply(`No hay usuarios registrados con más de 1,000 ${currency}.`);
    }

    eligible.sort((a, b) => b.total - a.total);

    const pageSize = 10;
    const totalPages = Math.ceil(eligible.length / pageSize);
    const page = Math.max(1, Math.min(parseInt(args[0]) || 1, totalPages));
    const start = (page - 1) * pageSize;

    let text = `👑 *RANKING DE RIQUEZA (ECONOMY)*\n\n`;
    text += eligible.slice(start, start + pageSize).map((item, i) => {
      return `*#${start + i + 1}* › *${item.name}*\n      💰 Total: ¥${item.total.toLocaleString()} ${currency}`;
    }).join('\n\n');

    text += `\n\n📄 Página *${page}* de *${totalPages}*`;
    if (page < totalPages) {
      text += `\n_Para ver la siguiente página usa: \`${usedPrefix + command} ${page + 1}\`_`;
    }

    return client.sendMessage(m.chat, { text }, { quoted: m });
  }
};

export default [cmdBalance, cmdDeposit, cmdWithdraw, cmdGiveCoins, cmdTrade, cmdEconomyBoard];
