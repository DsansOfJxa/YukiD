/**
 * 💼 rpg_jobs.js — Comandos de trabajo, rachas e ingresos RPG consolidados.
 * Incluye: work, daily, weekly, monthly, crime, slut, mine, hunt, fish, steal, math
 */
import { pickRandom, formatTime, getBotCurrency, getBotId } from '../../utils/tools.js';
import { resolveLidToRealJid } from '../../core/utils.js';
import { deductFunds, applyMultipliers, checkCooldown, setCooldown } from './rpg_core.js';

// ── Pool de trabajos ──
const TRABAJOS = [
  'Diseñas páginas web para una empresa emergente y ganas',
  'Trabajas como barista en una cafetería concurrida y recibes',
  'Eres fotógrafo en eventos exclusivos y ganas',
  'Reparas automóviles en un taller mecánico y obtienes',
  'Eres guía turístico de montaña y recibes',
  'Trabajas en una clínica veterinaria y ganas',
  'Creas ilustraciones digitales freelance y obtienes',
  'Trabajas en una librería antigua y ganas',
  'Eres DJ residente en un club nocturno y recibes',
  'Trabajas como desarrollador de software y ganas',
  'Preparas platillos en un restaurante gourmet y obtienes',
  'Haces entregas exprés por la ciudad y recibes',
  'Trabajas como instructor de surf y ganas',
  'Eres consultor financiero independiente y obtienes',
  'Organizas ferias de artesanías locales y recibes',
  'Trabajas como técnico de sonido en conciertos y ganas',
  'Eres narrador de audiolibros profesionales y obtienes',
  'Cuidas jardines botánicos y recibes',
  'Eres entrenador personal de fitness y ganas',
  'Diseñas joyas artesanales y obtienes'
];

// ── Minería y Ambientes ──
const MINA_SITIOS = [
  'una cueva oscura de cuarzo', 'la cumbre de un monte nevado',
  'una mina abandonada de carbón', 'un barranco volcánico',
  'las ruinas de un castillo medieval', 'un valle oculto entre colinas'
];

const MINA_HALLAZGOS = [
  'un cofre antiguo con', 'una bolsa repleta de',
  'vetas de minerales que contienen', 'lingotes escondidos con',
  'piedras preciosas equivalentes a', 'reliquias olvidadas valoradas en'
];

// ── Helper para reclamos de racha (Daily, Weekly, Monthly) ──
function handleStreakClaim(client, m, {
  typeName, streakKey, globalKey, cdKey, intervalMs,
  baseReward, stepReward, maxReward, maxStreak, allowExtra = false
}) {
  const user = global.db.data?.users?.[m.sender];
  if (!user) return;
  const now = Date.now();
  const currency = getBotCurrency(client);

  user[streakKey] ??= 0;
  user[globalKey] ??= 0;
  user.coins ??= 0;
  user[cdKey] ??= 0;

  if (now < user[cdKey]) {
    if (allowExtra && user.extraDaily) {
      user.extraDaily = false;
    } else {
      return m.reply(`⏳ Ya has reclamado tu recompensa ${typeName.toLowerCase()}.\nVuelve a reclamarla en *${formatTime(user[cdKey] - now)}*.`);
    }
  }

  const lost = user[streakKey] >= 1 && (now - user[globalKey]) > intervalMs * 1.5;
  if (lost) user[streakKey] = 0;
  if (now - user[globalKey] >= intervalMs) {
    user[streakKey] = Math.min(user[streakKey] + 1, maxStreak);
    user[globalKey] = now;
  }
  if (user[streakKey] === 0) user[streakKey] = 1;

  let reward = Math.min(baseReward + (user[streakKey] - 1) * stepReward, maxReward);
  reward = applyMultipliers(user, reward, 'streak');

  user.coins += reward;
  user[cdKey] = now + intervalMs;

  const nextReward = Math.min(baseReward + user[streakKey] * stepReward, maxReward).toLocaleString();
  let msg = `「✿」 Has reclamado tu recompensa ${typeName.toLowerCase()} de *¥${reward.toLocaleString()} ${currency}*! (${typeName} *#${user[streakKey]}*)\n> Próximo: *+¥${nextReward}*`;
  if (lost) msg += `\n☆ ¡Perdiste tu racha anterior por inactividad!`;

  return m.reply(msg);
}

// ── Math Game Config ──
global.math = global.math || {};
const MATH_LIMITS = { facil: 10, medio: 50, dificil: 90, imposible: 100, imposible2: 160 };
const MATH_REWARDS = { facil: [500, 1000], medio: [1000, 2000], dificil: [2000, 3500], imposible: [3500, 4800], imposible2: [5000, 6500] };
const MATH_OPS = {
  '+': (a, b) => a + b,
  '-': (a, b) => a - b,
  '*': (a, b) => a * b,
  '/': (a, b) => Math.floor(a / b)
};

function genMathProblem(diff) {
  const max = MATH_LIMITS[diff] || 30;
  const n1 = Math.floor(Math.random() * max) + 1;
  const n2 = Math.floor(Math.random() * max) + 1;
  const opKeys = ['+', '-', '*', '/'];
  const op = opKeys[Math.floor(Math.random() * opKeys.length)];
  const resultado = MATH_OPS[op](n1, n2);
  const sym = op === '*' ? '×' : op === '/' ? '÷' : op;
  return { problema: `${n1} ${sym} ${n2}`, resultado };
}

// ══════════════════════ COMANDOS ══════════════════════

const cmdWork = {
  command: ['w', 'work', 'chambear', 'chamba', 'trabajar'],
  category: 'economia',
  desc: 'Trabajar para obtener monedas del bot.',
  economy: true,
  cooldown: 3,
  run: async (client, m) => {
    const user = global.db.data?.users?.[m.sender];
    if (!user) return;
    const currency = getBotCurrency(client);

    const cd = checkCooldown(user, 'lastwork');
    if (!cd.ready) {
      return m.reply(`⏳ Debes esperar *${formatTime(cd.remaining)}* para volver a trabajar.`);
    }

    let reward = Math.floor(Math.random() * 2001) + 2000;
    reward = applyMultipliers(user, reward, 'work');
    user.coins = (user.coins || 0) + reward;

    setCooldown(user, 'lastwork', 3 * 60 * 1000);
    return client.sendMessage(m.chat, {
      text: `💼 ${pickRandom(TRABAJOS)} *¥${reward.toLocaleString()} ${currency}*.`
    }, { quoted: m });
  }
};

const cmdDaily = {
  command: ['daily', 'diario'],
  category: 'economia',
  desc: 'Reclamar la recompensa diaria con racha progresiva.',
  economy: true,
  run: async (client, m) => handleStreakClaim(client, m, {
    typeName: 'Día',
    streakKey: 'streak',
    globalKey: 'lastDailyGlobal',
    cdKey: 'lastdaily',
    intervalMs: 86400000,
    baseReward: 20000,
    stepReward: 5000,
    maxReward: 1015000,
    maxStreak: 200,
    allowExtra: true
  })
};

const cmdWeekly = {
  command: ['weekly', 'semanal'],
  category: 'economia',
  desc: 'Reclamar la recompensa semanal acumulativa.',
  economy: true,
  run: async (client, m) => handleStreakClaim(client, m, {
    typeName: 'Semana',
    streakKey: 'weeklyStreak',
    globalKey: 'lastWeeklyGlobal',
    cdKey: 'lastweekly',
    intervalMs: 604800000,
    baseReward: 40000,
    stepReward: 5000,
    maxReward: 185000,
    maxStreak: 30
  })
};

const cmdMonthly = {
  command: ['monthly', 'mensual'],
  category: 'economia',
  desc: 'Reclamar la recompensa mensual acumulativa.',
  economy: true,
  run: async (client, m) => handleStreakClaim(client, m, {
    typeName: 'Mes',
    streakKey: 'monthlyStreak',
    globalKey: 'lastMonthlyGlobal',
    cdKey: 'lastmonthly',
    intervalMs: 2592000000,
    baseReward: 60000,
    stepReward: 5000,
    maxReward: 95000,
    maxStreak: 8
  })
};

const cmdCrime = {
  command: ['crime', 'crimen'],
  category: 'economia',
  desc: 'Cometer un crimen arriesgado para obtener botín rápido.',
  economy: true,
  run: async (client, m) => {
    const user = global.db.data?.users?.[m.sender];
    if (!user) return;
    const currency = getBotCurrency(client);

    const cd = checkCooldown(user, 'lastcrime');
    if (!cd.ready) {
      return m.reply(`⏳ Debes esperar *${formatTime(cd.remaining)}* antes de intentar cometer otro crimen.`);
    }

    let baseChance = 0.40;
    if (user.title === 'title_lucky') baseChance += 0.15;
    if (user.luckBuff?.expiresAt > Date.now()) baseChance += (user.luckBuff.value || 0.25);

    const exito = Math.random() < baseChance;
    let message = '';

    if (exito) {
      let reward = Math.floor(Math.random() * 2001) + 5500;
      reward = applyMultipliers(user, reward, 'crime');
      user.coins = (user.coins || 0) + reward;
      message = pickRandom([
        `Hackeaste un cajero automático en la madrugada, ganaste *¥${reward.toLocaleString()} ${currency}*!`,
        `Te infiltraste en una mansión desatendida y robaste joyas, ganaste *¥${reward.toLocaleString()} ${currency}*!`,
        `Interceptaste un envío de lujo y lo revendiste, ganaste *¥${reward.toLocaleString()} ${currency}*!`,
        `Falsificaste boletos de un concierto VIP, ganaste *¥${reward.toLocaleString()} ${currency}*!`
      ]);
    } else {
      let loss = Math.floor(Math.random() * 2001) + 4000;
      const actualLoss = deductFunds(user, loss);
      message = pickRandom([
        `Una cámara de seguridad captó tu rostro y tuviste que pagar un soborno de *¥${actualLoss.toLocaleString()} ${currency}*.`,
        `La alarma silenciosa sonó y perdiste *¥${actualLoss.toLocaleString()} ${currency}* en la huida.`,
        `El guardia nocturno te descubrió y te decomisó *¥${actualLoss.toLocaleString()} ${currency}*.`,
        `El comprador resultó ser un policía encubierto, perdiste *¥${actualLoss.toLocaleString()} ${currency}*.`
      ]);
    }

    setCooldown(user, 'lastcrime', 7 * 60 * 1000);
    return client.sendMessage(m.chat, { text: `「✿」 ${message}` }, { quoted: m });
  }
};

const cmdSlut = {
  command: ['slut', 'prostituirse'],
  category: 'economia',
  desc: 'Trabajo nocturno de alto riesgo y recompensa.',
  economy: true,
  run: async (client, m) => {
    const user = global.db.data?.users?.[m.sender];
    if (!user) return;
    const currency = getBotCurrency(client);

    const cd = checkCooldown(user, 'lastslut');
    if (!cd.ready) {
      return m.reply(`⏳ Debes esperar *${formatTime(cd.remaining)}* antes de volver a intentarlo.`);
    }

    const success = Math.random() < 0.50;
    let message = '';

    if (success) {
      let reward = Math.floor(Math.random() * 2501) + 3500;
      reward = applyMultipliers(user, reward, 'slut');
      user.coins = (user.coins || 0) + reward;
      message = pickRandom([
        `Un cliente adinerado quedó encantado con tu servicio y te pagó *¥${reward.toLocaleString()} ${currency}*!`,
        `Bailaste en la zona VIP de un club exclusivo, ganaste *¥${reward.toLocaleString()} ${currency}*!`,
        `Tu presentación privada fue todo un éxito, ganaste *¥${reward.toLocaleString()} ${currency}*!`,
        `Recibiste generosas propinas de varios admiradores, ganaste *¥${reward.toLocaleString()} ${currency}*!`
      ]);
    } else {
      let loss = Math.floor(Math.random() * 2001) + 2000;
      const actualLoss = deductFunds(user, loss);
      message = pickRandom([
        `Un cliente se negó a pagar y perdiste *¥${actualLoss.toLocaleString()} ${currency}*.`,
        `Cometiste un error en tu actuación y te multaron con *¥${actualLoss.toLocaleString()} ${currency}*.`,
        `La seguridad del club te confiscó ganancias por *¥${actualLoss.toLocaleString()} ${currency}*.`,
        `Tu vestuario se arruinó y tuviste que reponer *¥${actualLoss.toLocaleString()} ${currency}*.`
      ]);
    }

    setCooldown(user, 'lastslut', 5 * 60 * 1000);
    return client.sendMessage(m.chat, { text: `「✿」 ${message}` }, { quoted: m });
  }
};

const cmdMine = {
  command: ['mine', 'minar'],
  category: 'economia',
  desc: 'Minar minerales y tesoros subterráneos.',
  economy: true,
  run: async (client, m, args, usedPrefix) => {
    const user = global.db.data?.users?.[m.sender];
    if (!user) return;
    const currency = getBotCurrency(client);

    user.health ??= 100;
    if (user.health < 5) {
      return m.reply(`❌ No tienes suficiente salud (${user.health}/100) para minar.\nUsa *${usedPrefix}heal* para curarte.`);
    }

    const cd = checkCooldown(user, 'lastmine');
    if (!cd.ready) {
      return m.reply(`⏳ Debes esperar *${formatTime(cd.remaining)}* para volver a minar.`);
    }

    const isLegendary = Math.random() < 0.03;
    let reward = isLegendary
      ? Math.floor(Math.random() * 2001) + 11000
      : Math.floor(Math.random() * 2501) + 7000;

    let bonusMsg = '';
    if (!isLegendary && Math.random() < 0.12) {
      const bonus = Math.floor(Math.random() * 2001) + 2500;
      reward += bonus;
      bonusMsg = `\n⛏️ ¡Veta dorada extra! Ganaste *+¥${bonus.toLocaleString()}* adicionales.`;
    }

    reward = applyMultipliers(user, reward, 'mine');
    user.coins = (user.coins || 0) + reward;

    const damage = Math.floor(Math.random() * 11) + 5;
    user.health = Math.max(0, user.health - damage);

    setCooldown(user, 'lastmine', 10 * 60 * 1000);

    const narration = isLegendary
      ? '¡DESCUBRISTE UN TESORO MINERO LEGENDARIO!'
      : `En ${pickRandom(MINA_SITIOS)}, ${pickRandom(MINA_HALLAZGOS)}`;

    return client.sendMessage(m.chat, {
      text: `「✿」 ${narration} *¥${reward.toLocaleString()} ${currency}*! ❤️ -${damage} HP.${bonusMsg}`
    }, { quoted: m });
  }
};

const cmdHunt = {
  command: ['cazar', 'hunt'],
  category: 'economia',
  desc: 'Cazar animales salvajes en el bosque.',
  economy: true,
  run: async (client, m, args, usedPrefix) => {
    const user = global.db.data?.users?.[m.sender];
    if (!user) return;
    const currency = getBotCurrency(client);

    user.health ??= 100;
    if (user.health < 5) {
      return m.reply(`❌ No tienes suficiente salud (${user.health}/100) para cazar.\nUsa *${usedPrefix}heal* para curarte.`);
    }

    const cd = checkCooldown(user, 'lasthunt');
    if (!cd.ready) {
      return m.reply(`⏳ Debes esperar *${formatTime(cd.remaining)}* antes de volver a cazar.`);
    }

    const rand = Math.random();
    const damage = Math.floor(Math.random() * 6) + 10;
    let message = '';

    if (rand < 0.40) {
      let reward = Math.floor(Math.random() * 3001) + 10000;
      reward = applyMultipliers(user, reward, 'hunt');
      user.coins = (user.coins || 0) + reward;
      user.health = Math.max(0, user.health - damage);
      message = pickRandom([
        `¡Con gran puntería cazaste un Oso feroz! Ganaste *¥${reward.toLocaleString()} ${currency}*!`,
        `¡Lograste cazar un Ciervo imponente! Ganaste *¥${reward.toLocaleString()} ${currency}*!`,
        `¡Rastreaste y cazaste un Jabalí salvaje! Ganaste *¥${reward.toLocaleString()} ${currency}*!`,
        `¡Atrapaste un Zorro plateado de piel brillante! Ganaste *¥${reward.toLocaleString()} ${currency}*!`
      ]) + ` ❤️ -${damage} HP.`;
    } else if (rand < 0.70) {
      let loss = Math.floor(Math.random() * 2001) + 6000;
      const actualLoss = deductFunds(user, loss);
      user.health = Math.max(0, user.health - damage);
      message = pickRandom([
        `La presa te embistió y perdiste tu equipo valuado en *¥${actualLoss.toLocaleString()} ${currency}*.`,
        `Tu arco se rompió durante el disparo, perdiendo *¥${actualLoss.toLocaleString()} ${currency}*.`,
        `Una tormenta repentina arruinó la jornada y perdiste provisiones por *¥${actualLoss.toLocaleString()} ${currency}*.`
      ]) + ` ❤️ -${damage} HP.`;
    } else {
      message = 'Recorriste el bosque durante horas, pero las presas se mostraron esquivas y regresaste sin novedades.';
    }

    setCooldown(user, 'lasthunt', 15 * 60 * 1000);
    return client.sendMessage(m.chat, { text: `「✿」 ${message}` }, { quoted: m });
  }
};

const cmdFish = {
  command: ['pescar', 'fish'],
  category: 'economia',
  desc: 'Pescar especies marinas en ríos y mares.',
  economy: true,
  run: async (client, m) => {
    const user = global.db.data?.users?.[m.sender];
    if (!user) return;
    const currency = getBotCurrency(client);

    const cd = checkCooldown(user, 'lastfish');
    if (!cd.ready) {
      return m.reply(`⏳ Debes esperar *${formatTime(cd.remaining)}* antes de volver a pescar.`);
    }

    const rand = Math.random();
    let message = '';

    if (rand < 0.40) {
      let reward = Math.floor(Math.random() * 2001) + 6000;
      reward = applyMultipliers(user, reward, 'fish');
      user.coins = (user.coins || 0) + reward;

      let buffMsg = '';
      if (user.title === 'title_neko') {
        user.health = Math.min(100, (user.health || 100) + 10);
        buffMsg = ' _(🐱 Pasiva Neko: +10 Salud)_';
      }

      message = pickRandom([
        `¡Has pescado un Salmón plateado gigante! Ganaste *¥${reward.toLocaleString()} ${currency}*!`,
        `¡Capturaste una Anguila dorada! Ganaste *¥${reward.toLocaleString()} ${currency}*!`,
        `¡Sacaste una Carpa Real de aguas profundas! Ganaste *¥${reward.toLocaleString()} ${currency}*!`,
        `¡Atrapaste un Pez Dragón exótico! Ganaste *¥${reward.toLocaleString()} ${currency}*!`
      ]) + buffMsg;
    } else if (rand < 0.70) {
      let loss = Math.floor(Math.random() * 1501) + 5000;
      const actualLoss = deductFunds(user, loss);
      message = pickRandom([
        `Un pez gigante rompió tu línea y caña, perdiste *¥${actualLoss.toLocaleString()} ${currency}*.`,
        `El oleaje volcó tu cubeta de aparejos, perdiste *¥${actualLoss.toLocaleString()} ${currency}*.`,
        `Tu red se enganchó en las rocas del fondo, perdiste *¥${actualLoss.toLocaleString()} ${currency}*.`
      ]);
    } else {
      message = 'Pasaste la tarde a la orilla del agua en calma, pero los peces no picaron.';
    }

    setCooldown(user, 'lastfish', 8 * 60 * 1000);
    return client.sendMessage(m.chat, { text: `「✿」 ${message}` }, { quoted: m });
  }
};

const cmdSteal = {
  command: ['robar', 'steal', 'rob'],
  category: 'economia',
  desc: 'Intentar robar monedas fuera del banco a otro miembro.',
  economy: true,
  run: async (client, m, args, usedPrefix, command) => {
    const db = global.db.data;
    const currency = getBotCurrency(client);
    const user = db?.users?.[m.sender];
    if (!user) return;

    const cd = checkCooldown(user, 'laststeal');
    if (!cd.ready) {
      return m.reply(`⏳ Debes esperar *${formatTime(cd.remaining)}* antes de volver a robar.`);
    }

    const mentioned = m.mentionedJid || [];
    const targetRaw = mentioned[0] || (m.quoted ? m.quoted.sender : null);
    if (!targetRaw) {
      return m.reply(`⚠️ Debes mencionar o responder al usuario que deseas robar.`);
    }

    const who = await resolveLidToRealJid(targetRaw, client, m.chat);
    if (!who || !(who in db.users)) {
      return m.reply('❌ El usuario no está registrado en el bot.');
    }
    if (who === m.sender) {
      return m.reply('❌ No puedes robarte a ti mismo.');
    }

    const targetUser = db.users[who];
    if (targetUser.title === 'title_shadow') {
      return m.reply('🛡️ Ese usuario tiene el título *🌑 Sombra* equipado: es totalmente inmune a robos.');
    }
    if (targetUser.shield && targetUser.shield.expiresAt > Date.now()) {
      return m.reply('🛡️ Ese usuario tiene un *Escudo Anti-Robo* activo.');
    }

    const lastCmd = db.chats?.[m.chat]?.users?.[who]?.lastCmd || 0;
    if (Date.now() - lastCmd < 3600000) {
      return m.reply(`⚠️ Solo puedes robar a usuarios que hayan estado más de 1 hora inactivos.`);
    }

    let failThreshold = 0.35;
    if (user.luckBuff && user.luckBuff.expiresAt > Date.now()) {
      failThreshold = Math.max(0.10, failThreshold - (user.luckBuff.value || 0.25));
    }

    if (Math.random() < failThreshold) {
      let loss = Math.floor(Math.random() * 3001) + 2000;
      const actualLoss = deductFunds(user, loss);
      setCooldown(user, 'laststeal', 60 * 60 * 1000);
      return m.reply(`🚨 El robo salió mal, te atraparon y tuviste que pagar una fianza de *¥${actualLoss.toLocaleString()} ${currency}*.`);
    }

    const targetCoins = targetUser.coins || 0;
    if (targetCoins < 2000) {
      const targetName = targetUser.name || who.split('@')[0];
      return client.sendMessage(m.chat, {
        text: `*${targetName}* no tiene suficientes monedas fuera del banco como para que valga la pena robarle.`,
        mentions: [who]
      }, { quoted: m });
    }

    let rob = Math.min(targetCoins, Math.floor(Math.random() * 4001) + 4000);
    rob = applyMultipliers(user, rob, 'steal');

    targetUser.coins = Math.max(0, (targetUser.coins || 0) - rob);
    user.coins = (user.coins || 0) + rob;

    setCooldown(user, 'laststeal', 60 * 60 * 1000);
    const targetName = targetUser.name || who.split('@')[0];

    return client.sendMessage(m.chat, {
      text: `🥷 ¡Robo exitoso! Le arrebataste *¥${rob.toLocaleString()} ${currency}* a *${targetName}*.`,
      mentions: [who]
    }, { quoted: m });
  }
};

const cmdMath = {
  command: ['math', 'mates', 'resp'],
  category: 'economia',
  desc: 'Resolver cálculos matemáticos por monedas.',
  economy: true,
  run: async (client, m, args, usedPrefix, command) => {
    const chatId = m.chat;
    const user = global.db.data?.users?.[m.sender];
    if (!user) return;
    const juego = global.math[chatId];

    if (command === 'resp') {
      if (!juego?.juegoActivo) return;
      const quotedId = m.quoted?.key?.id || m.quoted?.id || m.quoted?.stanzaId;
      if (quotedId && quotedId !== juego.problemMessageId) return;

      const respuestaUsuario = parseFloat(args[0]);
      if (isNaN(respuestaUsuario)) {
        return m.reply(`✏️ Escribe tu respuesta numérica. Ejemplo: *${usedPrefix}resp 42*`);
      }

      const respuestaCorrecta = parseFloat(juego.respuesta);
      if (respuestaUsuario === respuestaCorrecta) {
        const [min, max] = MATH_REWARDS[juego.dificultad] || [500, 1000];
        let reward = Math.floor(Math.random() * (max - min + 1)) + min;
        reward = applyMultipliers(user, reward, 'math');
        user.coins = (user.coins || 0) + reward;

        clearTimeout(juego.tiempoLimite);
        delete global.math[chatId];
        return m.reply(`🎉 ¡Respuesta correcta!\n💰 *Ganaste:* ¥${reward.toLocaleString()}`);
      } else {
        juego.intentos += 1;
        if (juego.intentos >= 3) {
          clearTimeout(juego.tiempoLimite);
          delete global.math[chatId];
          return m.reply(`❌ Te quedaste sin intentos. La respuesta correcta era *${juego.respuesta}*.`);
        }
        return m.reply(`❌ Respuesta incorrecta. Te quedan *${3 - juego.intentos}* intentos.`);
      }
    }

    if (command === 'math' || command === 'mates') {
      if (juego?.juegoActivo) {
        return m.reply('⚠️ Ya hay un juego matemático activo en este chat. Responde con `.resp <numero>`.');
      }

      const dificultad = (args[0] || 'facil').toLowerCase();
      if (!MATH_LIMITS[dificultad]) {
        return m.reply('⚠️ Dificultad inválida. Opciones: *facil, medio, dificil, imposible, imposible2*');
      }

      const { problema, resultado } = genMathProblem(dificultad);
      const problemMessage = await client.reply(
        chatId,
        `🧠 *RETO MATEMÁTICO (${dificultad.toUpperCase()})*\n\n` +
        `Calcula: *${problema}*\n\n` +
        `⏳ Tienes 60 segundos.\n` +
        `_Responde con *${usedPrefix}resp <resultado>*_`,
        m
      );

      global.math[chatId] = {
        juegoActivo: true,
        problema,
        respuesta: resultado.toString(),
        intentos: 0,
        dificultad,
        problemMessageId: problemMessage?.key?.id,
        tiempoLimite: setTimeout(() => {
          if (global.math[chatId]?.juegoActivo) {
            delete global.math[chatId];
            client.reply(chatId, `⏰ *Tiempo agotado.* La respuesta correcta era *${resultado}*.`, m);
          }
        }, 60000)
      };
    }
  }
};

export default [cmdWork, cmdDaily, cmdWeekly, cmdMonthly, cmdCrime, cmdSlut, cmdMine, cmdHunt, cmdFish, cmdSteal, cmdMath];
