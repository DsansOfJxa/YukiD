/**
 * 🎲 rpg_casino.js — Comandos de apuestas y juegos de azar RPG.
 * Incluye: casino/apostar, coinflip, ppt, roulette, slots
 */
import { getBotCurrency, formatTime, getBotSettings } from '../../utils/tools.js';
import { deductFunds, applyMultipliers, checkCooldown, setCooldown } from './rpg_core.js';

const cmdCasino = {
  command: ['apostar', 'casino'],
  category: 'economia',
  desc: 'Apostar dados contra el bot en el casino.',
  economy: true,
  run: async (client, m, args, usedPrefix, command) => {
    const user = global.db.data?.users?.[m.sender];
    if (!user) return;
    const currency = getBotCurrency(client);
    const botname = getBotSettings(client)?.botname || 'Bot';

    const cd = checkCooldown(user, 'lastApuesta');
    if (!cd.ready) {
      return m.reply(`⏳ Debes esperar *${formatTime(cd.remaining)}* para volver a apostar en el casino.`);
    }

    if (!args[0]) {
      return m.reply(`🎲 Ingresa la cantidad de *${currency}* a apostar contra *${botname}*.\n*Ejemplo:* \`${usedPrefix + command} 500\` o \`${usedPrefix + command} all\``);
    }

    let count = args[0].toLowerCase() === 'all' ? (user.coins || 0) : parseInt(args[0]);
    if (isNaN(count) || count < 100) {
      return m.reply(`⚠️ La apuesta mínima es de *100 ${currency}*.`);
    }

    if ((user.coins || 0) < count) {
      return m.reply(`❌ No tienes suficientes monedas en cartera (*¥${(user.coins || 0).toLocaleString()} ${currency}*).`);
    }

    const diceBot = Math.floor(Math.random() * 100) + 1;
    const diceUser = Math.floor(Math.random() * 100) + 1;

    let resultado = '';
    if (diceUser > diceBot) {
      let win = count;
      win = applyMultipliers(user, win, 'casino');
      user.coins = (user.coins || 0) + win;
      resultado = `🎉 *¡Felicidades, ganaste!*\n💰 *Ganancia:* +¥${win.toLocaleString()} ${currency}`;
    } else if (diceUser < diceBot) {
      user.coins = Math.max(0, (user.coins || 0) - count);
      resultado = `💥 *Mala suerte, perdiste!*\n💸 *Pérdida:* -¥${count.toLocaleString()} ${currency}`;
    } else {
      resultado = `🤝 *¡Empate!*\nSe te devuelve tu apuesta de *¥${count.toLocaleString()} ${currency}*.`;
    }

    setCooldown(user, 'lastApuesta', 25 * 1000);
    const userName = user.name || m.sender.split('@')[0];

    const msg = `🎰 *CASINO — DADOS* 🎰\n\n` +
      `👤 *${userName}:* \`[ ${diceUser} pts ]\`\n` +
      `🤖 *${botname}:* \`[ ${diceBot} pts ]\`\n\n` +
      `${resultado}\n` +
      `🪙 *Nuevo saldo:* ¥${(user.coins || 0).toLocaleString()} ${currency}`;

    return client.sendMessage(m.chat, { text: msg }, { quoted: m });
  }
};

const cmdCoinFlip = {
  command: ['cf', 'flip', 'coinflip'],
  category: 'economia',
  desc: 'Lanzar una moneda y apostar a cara o cruz.',
  economy: true,
  run: async (client, m, args, usedPrefix, command) => {
    const user = global.db.data?.users?.[m.sender];
    if (!user) return;
    const currency = getBotCurrency(client);

    let cantidad, eleccion;
    const a0 = parseFloat(args[0]), a1 = parseFloat(args[1]);

    if (!isNaN(a0)) {
      cantidad = Math.floor(a0);
      eleccion = (args[1] || '').toLowerCase();
    } else if (!isNaN(a1)) {
      cantidad = Math.floor(a1);
      eleccion = (args[0] || '').toLowerCase();
    } else {
      return m.reply(`⚠️ Formato inválido.\n*Uso:* \`${usedPrefix + command} 200 cara\` o \`${usedPrefix + command} cruz 500\``);
    }

    if (cantidad < 100) return m.reply(`⚠️ La cantidad mínima para apostar es *100 ${currency}*.`);
    if (!['cara', 'cruz'].includes(eleccion)) {
      return m.reply(`⚠️ Elige una opción válida: *cara* o *cruz*.`);
    }

    if ((user.coins || 0) < cantidad) {
      return m.reply(`❌ No tienes suficientes monedas en cartera (*¥${(user.coins || 0).toLocaleString()} ${currency}*).`);
    }

    const resultado = Math.random() < 0.5 ? 'cara' : 'cruz';
    const acierto = resultado === eleccion;

    if (acierto) {
      let win = applyMultipliers(user, cantidad, 'coinflip');
      user.coins = (user.coins || 0) + win;
      return client.sendMessage(m.chat, {
        text: `🪙 *COINFLIP*\n\n` +
          `La moneda cayó en: *${resultado.toUpperCase()}* ✨\n` +
          `🎉 ¡Acertaste! Ganaste *+¥${win.toLocaleString()} ${currency}*.\n` +
          `💰 Saldo actual: *¥${(user.coins || 0).toLocaleString()}*`
      }, { quoted: m });
    } else {
      user.coins = Math.max(0, (user.coins || 0) - cantidad);
      return client.sendMessage(m.chat, {
        text: `🪙 *COINFLIP*\n\n` +
          `La moneda cayó en: *${resultado.toUpperCase()}* 💥\n` +
          `❌ Fallaste. Perdiste *¥${cantidad.toLocaleString()} ${currency}*.\n` +
          `💰 Saldo actual: *¥${(user.coins || 0).toLocaleString()}*`
      }, { quoted: m });
    }
  }
};

const cmdPtt = {
  command: ['ppt'],
  category: 'economia',
  desc: 'Piedra, papel o tijeras apostando monedas contra el bot.',
  economy: true,
  run: async (client, m, args, usedPrefix) => {
    const user = global.db.data?.users?.[m.sender];
    if (!user) return;
    const currency = getBotCurrency(client);
    const botname = getBotSettings(client)?.namebot || 'Bot';

    const cd = checkCooldown(user, 'lastppt');
    if (!cd.ready) {
      return m.reply(`⏳ Espera *${formatTime(cd.remaining)}* antes de volver a jugar.`);
    }

    const options = ['piedra', 'papel', 'tijera'];
    const userChoice = (args[0] || '').toLowerCase().trim();
    if (!options.includes(userChoice)) {
      return m.reply(`🎮 Elige una opción: \`${usedPrefix}ppt piedra\`, \`papel\` o \`tijera\``);
    }

    const botChoice = options[Math.floor(Math.random() * options.length)];
    let outcome = 'lose';
    if (userChoice === botChoice) {
      outcome = 'tie';
    } else if (
      (userChoice === 'piedra' && botChoice === 'tijera') ||
      (userChoice === 'papel' && botChoice === 'piedra') ||
      (userChoice === 'tijera' && botChoice === 'papel')
    ) {
      outcome = 'win';
    }

    setCooldown(user, 'lastppt', 60 * 1000);

    if (outcome === 'win') {
      let reward = Math.floor(Math.random() * 2501) + 3000;
      reward = applyMultipliers(user, reward, 'ppt');
      user.coins = (user.coins || 0) + reward;
      return client.sendMessage(m.chat, {
        text: `✌️ *PIEDRA, PAPEL O TIJERAS*\n\n` +
          `👤 *Tú:* ${userChoice}\n` +
          `🤖 *${botname}:* ${botChoice}\n\n` +
          `🎉 ¡Ganaste! Recompensa: *+¥${reward.toLocaleString()} ${currency}*`
      }, { quoted: m });
    } else if (outcome === 'lose') {
      let loss = Math.floor(Math.random() * 2001) + 1000;
      const actualLoss = deductFunds(user, loss);
      return client.sendMessage(m.chat, {
        text: `✌️ *PIEDRA, PAPEL O TIJERAS*\n\n` +
          `👤 *Tú:* ${userChoice}\n` +
          `🤖 *${botname}:* ${botChoice}\n\n` +
          `💥 Perdiste: *-¥${actualLoss.toLocaleString()} ${currency}*`
      }, { quoted: m });
    } else {
      let tieReward = Math.floor(Math.random() * 701) + 800;
      user.coins = (user.coins || 0) + tieReward;
      return client.sendMessage(m.chat, {
        text: `✌️ *PIEDRA, PAPEL O TIJERAS*\n\n` +
          `👤 *Tú:* ${userChoice}\n` +
          `🤖 *${botname}:* ${botChoice}\n\n` +
          `🤝 ¡Empate! Bono de consolación: *+¥${tieReward.toLocaleString()} ${currency}*`
      }, { quoted: m });
    }
  }
};

const cmdRoulette = {
  command: ['rt', 'roulette'],
  category: 'economia',
  desc: 'Ruleta clásica de casino: apuesta por color (red, black, green).',
  economy: true,
  run: async (client, m, args, usedPrefix) => {
    const user = global.db.data?.users?.[m.sender];
    if (!user) return;
    const currency = getBotCurrency(client);

    if (args.length < 2) {
      return m.reply(`🎰 *Uso de la Ruleta:*\n\`${usedPrefix}rt <cantidad> <color>\`\n*Colores:* red (x2), black (x2), green (x14)`);
    }

    let amount, color;
    if (!isNaN(parseInt(args[0]))) {
      amount = parseInt(args[0]);
      color = args[1].toLowerCase();
    } else if (!isNaN(parseInt(args[1]))) {
      color = args[0].toLowerCase();
      amount = parseInt(args[1]);
    } else {
      return m.reply(`⚠️ Formato inválido. Ejemplo: \`${usedPrefix}rt 2000 black\``);
    }

    const validColors = ['red', 'black', 'green'];
    if (isNaN(amount) || amount < 200) {
      return m.reply(`⚠️ La apuesta mínima es de *200 ${currency}*.`);
    }
    if (!validColors.includes(color)) {
      return m.reply(`⚠️ Color inválido. Elige entre *red*, *black* o *green*.`);
    }
    if ((user.coins || 0) < amount) {
      return m.reply(`❌ Saldo insuficiente en cartera (*¥${(user.coins || 0).toLocaleString()} ${currency}*).`);
    }

    // Probabilidades reales: 47% red, 47% black, 6% green
    const roll = Math.random();
    let resultColor = 'black';
    if (roll < 0.06) resultColor = 'green';
    else if (roll < 0.53) resultColor = 'red';

    const colorEmoji = resultColor === 'green' ? '🟢' : resultColor === 'red' ? '🔴' : '⚫';

    if (resultColor === color) {
      const multiplier = resultColor === 'green' ? 14 : 2;
      let reward = amount * multiplier;
      reward = applyMultipliers(user, reward, 'roulette');
      user.coins = (user.coins || 0) + reward;

      return client.sendMessage(m.chat, {
        text: `🎰 *RULETA CASINO*\n\n` +
          `Resultado: ${colorEmoji} *${resultColor.toUpperCase()}*\n\n` +
          `🎉 ¡Acertaste el color!\n` +
          `💰 Ganaste: *¥${reward.toLocaleString()} ${currency}* (x${multiplier})`
      }, { quoted: m });
    } else {
      user.coins = Math.max(0, (user.coins || 0) - amount);
      return client.sendMessage(m.chat, {
        text: `🎰 *RULETA CASINO*\n\n` +
          `Resultado: ${colorEmoji} *${resultColor.toUpperCase()}*\n\n` +
          `💥 Cayó en otro color. Perdiste *¥${amount.toLocaleString()} ${currency}*.`
      }, { quoted: m });
    }
  }
};

const cmdSlots = {
  command: ['slot', 'slots'],
  category: 'economia',
  desc: 'Máquina tragamonedas (slots).',
  economy: true,
  run: async (client, m, args, usedPrefix, command) => {
    const user = global.db.data?.users?.[m.sender];
    if (!user) return;
    const currency = getBotCurrency(client);

    const cd = checkCooldown(user, 'lastslot');
    if (!cd.ready) {
      return m.reply(`⏳ Debes esperar *${formatTime(cd.remaining)}* para girar la tragamonedas de nuevo.`);
    }

    const apuesta = parseInt(args[0]);
    if (isNaN(apuesta) || apuesta < 100) {
      return m.reply(`🎰 Ingresa la cantidad a apostar (mínimo 100).\n*Ejemplo:* \`${usedPrefix + command} 500\``);
    }
    if ((user.coins || 0) < apuesta) {
      return m.reply(`❌ No tienes suficientes monedas para apostar *¥${apuesta.toLocaleString()} ${currency}*.`);
    }

    const emojis = ['🍒', '💎', '🍋', '⭐', '🔔', '7️⃣'];
    const pick = () => emojis[Math.floor(Math.random() * emojis.length)];

    const r1 = [pick(), pick(), pick()];
    const r2 = [pick(), pick(), pick()];
    const r3 = [pick(), pick(), pick()];

    setCooldown(user, 'lastslot', 20 * 1000);

    // Verificación de la línea central ganadora (r1[1], r2[1], r3[1])
    let resultado = '';
    const center = [r1[1], r2[1], r3[1]];

    if (center[0] === center[1] && center[1] === center[2]) {
      const jackpotMultiplier = center[0] === '7️⃣' ? 10 : center[0] === '💎' ? 5 : 3;
      let premio = apuesta * jackpotMultiplier;
      premio = applyMultipliers(user, premio, 'slot');
      user.coins = (user.coins || 0) + premio;
      resultado = `🎉 *¡JACKPOT TOTAL!* Ganaste *¥${premio.toLocaleString()} ${currency}* (x${jackpotMultiplier})!`;
    } else if (center[0] === center[1] || center[1] === center[2] || center[0] === center[2]) {
      let premio = Math.floor(apuesta * 1.5);
      premio = applyMultipliers(user, premio, 'slot');
      user.coins = (user.coins || 0) + premio;
      resultado = `✨ *¡Línea doble!* Recuperas tu apuesta y ganas *¥${premio.toLocaleString()} ${currency}*.`;
    } else {
      user.coins = Math.max(0, (user.coins || 0) - apuesta);
      resultado = `💥 No hubo coincidencia. Perdiste *¥${apuesta.toLocaleString()} ${currency}*.`;
    }

    const reelText =
      `🎰 *TRAGAMONEDAS — SLOTS* 🎰\n` +
      `┌──────────────┐\n` +
      `│  ${r1[0]} : ${r2[0]} : ${r3[0]}  │\n` +
      `│ ➔ ${r1[1]} : ${r2[1]} : ${r3[1]} 🠔 │\n` +
      `│  ${r1[2]} : ${r2[2]} : ${r3[2]}  │\n` +
      `└──────────────┘\n\n` +
      `${resultado}\n` +
      `🪙 *Saldo actual:* ¥${(user.coins || 0).toLocaleString()} ${currency}`;

    return client.sendMessage(m.chat, { text: reelText }, { quoted: m });
  }
};

export default [cmdCasino, cmdCoinFlip, cmdPtt, cmdRoulette, cmdSlots];
