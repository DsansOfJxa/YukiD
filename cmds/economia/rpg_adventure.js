/**
 * 🐉 rpg_adventure.js — Combates cooperativos, aventuras, rituales, logros y cooldowns RPG.
 * Reúne: adventure, dungeon, raid, ritual, achievements, einfo
 */
import { pickRandom, formatTime, getBotCurrency } from '../../utils/tools.js';
import { gameEngine } from '../../utils/gameEngine.js';
import { deductFunds, applyMultipliers, checkCooldown, setCooldown } from './rpg_core.js';

// ── LOGROS RPG (ACHIEVEMENTS) ──

export const ACHIEVEMENTS = [
  // Juegos
  { id: 'first_win', name: '🎲 Primera Victoria', desc: 'Gana tu primer juego.', check: ctx => ctx.gameWins >= 1, condition: 'gameWins >= 1', reward: { xp: 200 } },
  { id: 'ten_wins', name: '🎯 Jugador Dedicado', desc: 'Gana 10 juegos.', check: ctx => ctx.gameWins >= 10, condition: 'gameWins >= 10', reward: { xp: 1000 } },
  { id: 'fifty_wins', name: '⚔️ Gladiador', desc: 'Gana 50 juegos.', check: ctx => ctx.gameWins >= 50, condition: 'gameWins >= 50', reward: { xp: 5000, coins: 10000 } },
  { id: 'hundred_wins', name: '🏆 Leyenda del Juego', desc: 'Gana 100 juegos.', check: ctx => ctx.gameWins >= 100, condition: 'gameWins >= 100', reward: { xp: 15000, coins: 50000 } },

  // Economía
  { id: 'millionaire', name: '💰 Millonario', desc: 'Acumula 1M de coins (cartera + banco).', check: ctx => ctx.totalCoins >= 1000000, condition: 'totalCoins >= 1000000', reward: { xp: 10000 } },
  { id: 'first_deposit', name: '🏦 Primer Depósito', desc: 'Deposita coins por primera vez.', check: ctx => ctx.bank >= 1, condition: 'bank >= 1', reward: { xp: 100 } },

  // XP y Nivel
  { id: 'xp_master', name: '✨ Maestro del XP', desc: 'Acumula 50,000 XP.', check: ctx => ctx.exp >= 50000, condition: 'exp >= 50000', reward: { coins: 5000 } },
  { id: 'level_10', name: '📈 Nivel 10', desc: 'Alcanza el nivel 10.', check: ctx => ctx.level >= 10, condition: 'level >= 10', reward: { xp: 2000, coins: 3000 } },
  { id: 'level_25', name: '🌟 Nivel 25', desc: 'Alcanza el nivel 25.', check: ctx => ctx.level >= 25, condition: 'level >= 25', reward: { xp: 5000, coins: 10000 } },
  { id: 'level_50', name: '💎 Nivel 50', desc: 'Alcanza el nivel 50.', check: ctx => ctx.level >= 50, condition: 'level >= 50', reward: { xp: 15000, coins: 25000 } },

  // Actividad
  { id: 'veteran', name: '🎖️ Veterano', desc: 'Ejecuta 500 comandos.', check: ctx => ctx.usedcommands >= 500, condition: 'usedcommands >= 500', reward: { xp: 3000 } },
  { id: 'commander', name: '⭐ Comandante', desc: 'Ejecuta 2000 comandos.', check: ctx => ctx.usedcommands >= 2000, condition: 'usedcommands >= 2000', reward: { xp: 8000, coins: 15000 } },

  // Streaks
  { id: 'streak_7', name: '🔥 Racha Semanal', desc: 'Mantén una racha diaria de 7 días.', check: ctx => ctx.streak >= 7, condition: 'streak >= 7', reward: { xp: 1500, coins: 5000 } },
  { id: 'streak_30', name: '🌋 Racha Mensual', desc: 'Mantén una racha diaria de 30 días.', check: ctx => ctx.streak >= 30, condition: 'streak >= 30', reward: { xp: 10000, coins: 30000 } },
];

export function checkAchievements(sender) {
  const user = global.db.data?.users?.[sender];
  if (!user) return [];
  if (!user.achievements) user.achievements = [];

  const totalCoins = (user.coins || 0) + (user.bank || 0);
  const ctx = {
    gameWins: user.gameWins || 0,
    gameLosses: user.gameLosses || 0,
    totalCoins,
    bank: user.bank || 0,
    exp: user.exp || 0,
    level: user.level || 0,
    usedcommands: user.usedcommands || 0,
    streak: user.streak || 0,
  };

  const newlyUnlocked = [];

  for (const achievement of ACHIEVEMENTS) {
    if (user.achievements.includes(achievement.id)) continue;

    let passed = false;
    try {
      passed = achievement.check ? achievement.check(ctx) : false;
    } catch { continue; }

    if (passed) {
      user.achievements.push(achievement.id);
      if (achievement.reward) {
        if (achievement.reward.xp) user.exp = (user.exp || 0) + achievement.reward.xp;
        if (achievement.reward.coins) user.coins = (user.coins || 0) + achievement.reward.coins;
      }
      newlyUnlocked.push(achievement);
    }
  }

  return newlyUnlocked;
}

// ── RAID BOSS DATA ──

const BOSSES = [
  { name: '🐉 Dragón Ancestral', hp: 800, minAtk: 30, maxAtk: 80, coins: 50000, xp: 3000, emoji: '🐉', lore: 'Un dragón milenario despierta de su letargo en las profundidades de la montaña de Ignis.' },
  { name: '💀 Señor de las Sombras', hp: 600, minAtk: 40, maxAtk: 70, coins: 40000, xp: 2500, emoji: '💀', lore: 'El nigromante supremo ha reunido un ejército de no-muertos en la fortaleza del Vacío.' },
  { name: '🕷️ Arachne, Reina Arácnida', hp: 500, minAtk: 25, maxAtk: 65, coins: 35000, xp: 2000, emoji: '🕷️', lore: 'La reina de las arañas teje sus redes mortales en las cuevas de Silkmoor.' },
  { name: '🧟 Golem de Obsidiana', hp: 1000, minAtk: 20, maxAtk: 60, coins: 60000, xp: 4000, emoji: '🧟', lore: 'Un coloso de piedra volcánica cobra vida en el corazón del volcán dormido.' },
  { name: '👹 Demonio del Abismo', hp: 700, minAtk: 35, maxAtk: 90, coins: 55000, xp: 3500, emoji: '👹', lore: 'Un portal interdimensional se abre y el comandante demoníaco cruza al mundo mortal.' },
  { name: '🦑 Kraken de las Profundidades', hp: 900, minAtk: 25, maxAtk: 75, coins: 58000, xp: 3800, emoji: '🦑', lore: 'Las aguas del puerto se tiñen de negro. El Kraken ha despertado de su sueño eterno.' },
];

const ATTACK_TEMPLATES = [
  (name, dmg) => `⚔️ *${name}* carga con su arma y asesta un golpe crítico de *${dmg} DMG*!`,
  (name, dmg) => `🗡️ *${name}* esquiva y contraataca infligiendo *${dmg} DMG*!`,
  (name, dmg) => `🏹 *${name}* lanza un proyectil certero que impacta al jefe por *${dmg} DMG*!`,
  (name, dmg) => `🔮 *${name}* canaliza energía arcana y desata *${dmg} DMG* de daño mágico!`,
  (name, dmg) => `💥 *${name}* ejecuta un combo devastador causando *${dmg} DMG*!`,
];

const BOSS_ATTACK_TEMPLATES = [
  (boss, target, dmg) => `${boss.emoji} *${boss.name}* lanza una llamarada contra *${target}* causándole *${dmg} DMG*!`,
  (boss, target, dmg) => `${boss.emoji} *${boss.name}* golpea a *${target}* con su cola infligiendo *${dmg} DMG*!`,
  (boss, target, dmg) => `${boss.emoji} *${boss.name}* lanza un rugido ensordecedor que hiere a *${target}* por *${dmg} DMG*!`,
  (boss, target, dmg) => `${boss.emoji} *${boss.name}* arremete contra *${target}* causando *${dmg} DMG*!`,
];

function renderHpBar(current, max) {
  const pct = Math.max(0, current / max);
  const filled = Math.min(10, Math.round(pct * 10));
  return '▓'.repeat(filled) + '░'.repeat(10 - filled);
}

function renderRaidStatus(raid) {
  const hpBar = renderHpBar(raid.bossHp, raid.bossMaxHp);
  const playerList = Object.entries(raid.damage)
    .sort((a, b) => b[1] - a[1])
    .map(([jid, dmg], i) => `  ${i + 1}. @${jid.split('@')[0]} — ${dmg} DMG`)
    .join('\n');
  return `${raid.boss.emoji} *${raid.boss.name}*\n${hpBar} ${raid.bossHp}/${raid.bossMaxHp} HP\n\n👥 *Participantes:*\n${playerList}`;
}

function calcPlayerDmg(user) {
  let base = Math.floor(Math.random() * 41) + 30;
  if (user?.inventory?.some(i => i === 'gema_dragon' || i?.id === 'gema_dragon')) {
    base = Math.floor(base * 1.3);
  }
  if (user?.title === 'title_fire') {
    base = Math.floor(base * 1.2);
  }
  return base;
}

// ── NARRATIVAS DE AVENTURA Y MAZMORRA ──

const ADV_WINS = [
  'Derrotaste a un ogro emboscado en los bosques oscuros',
  'Te conviertes en campeón del torneo de gladiadores de Valoria',
  'Rescatas un libro mágico del altar de los Susurros',
  'Liberas a aldeanos atrapados en las minas tras vencer a los trolls',
  'Derrotas a un dragón joven en los acantilados de Flamear',
  'Encuentras un relicario sagrado en las ruinas ancestrales',
  'Triunfas en el duelo contra el caballero corrupto de Invalion',
  'Resuelves el acertijo de la cripta eterna y reclamas el tesoro'
];

const ADV_LOSSES = [
  'El hechicero oscuro te lanzó una maldición y huyes herido',
  'Te extravías en la jungla y unos bandidos te asaltan',
  'Un basilisco te embiste y escapas sin botín',
  'Fracasa tu incursión a la torre de hielo al caer en una trampa',
  'Un grupo de trolls te embosca y te despojan de provisiones'
];

const ADV_NEUTRALS = [
  'Exploras ruinas antiguas y descubres inscripciones olvidadas.',
  'Sigues la pista de un espectro pero desaparece entre la densa niebla.',
  'Recorres un bosque encantado y descubres nuevas rutas de paso.',
  'Visitas una aldea remota y escuchas leyendas de antiguas batallas.'
];

const DUN_WINS = [
  'Derrotaste al guardián de las ruinas y reclamaste el tesoro antiguo',
  'Descifraste los símbolos rúnicos y obtuviste recompensas arcanas',
  'El espíritu de la reina ancestral te bendice con gemas de poder',
  'Superas la prueba de los espejos oscuros y recibes un artefacto único',
  'Consigues abrir la puerta del juicio y extraes un orbe milenario'
];

const DUN_LOSSES = [
  'Un espectro maldito te drena energía antes de que puedas escapar',
  'Un basilisco te sorprende en la cámara oculta y huyes maltrecho',
  'Una criatura informe te arrebata parte de tu botín en la penumbra',
  'Fracasas al activar un portal arcano y quedas atrapado entre dimensiones'
];

const DUN_NEUTRALS = [
  'Activaste una trampa de resortes, pero lograste esquivarla a tiempo.',
  'La sala cambia de forma y pierdes tiempo explorando pasadizos en círculos.',
  'Encuentras un mural antiguo que revela la historia olvidada de la mazmorra.'
];

const RITUAL_MSGS = [
  'Tu ritual abre un portal del vacío y emergen riquezas ardientes',
  'Las velas del altar se consumen revelando un cofre antiguo',
  'El círculo de invocación brilla intensamente y aparecen gemas',
  'Un espíritu menor se materializa y te entrega un saco de oro',
  'Los símbolos arcanos vibran y generan riquezas inesperadas'
];

const RITUAL_LEGENDARY = [
  '¡Invocaste un espíritu ancestral que te colma de riquezas incalculables!',
  '¡Un dragón cósmico desciende de las estrellas y deja gemas celestiales!',
  '¡Los dioses antiguos responden derramando oro sagrado sobre tu altar!'
];

// ── COMANDOS ──

const cmdAdventure = {
  command: ['adventure', 'aventura'],
  category: 'economia',
  desc: 'Ir de aventura por el mundo RPG para conseguir monedas y experiencia.',
  economy: true,
  run: async (client, m, args, usedPrefix) => {
    const user = global.db.data?.users?.[m.sender];
    if (!user) return;
    const currency = getBotCurrency(client);

    user.health ??= 100;
    if (user.health < 5) {
      return m.reply(`❌ No tienes suficiente salud (${user.health}/100) para aventurarte.\nUsa *${usedPrefix}heal* para curarte.`);
    }

    const cd = checkCooldown(user, 'lastadventure');
    if (!cd.ready) {
      return m.reply(`⏳ Debes esperar *${formatTime(cd.remaining)}* antes de volver a aventurarte.`);
    }

    const rand = Math.random();
    const damage = Math.floor(Math.random() * 11) + 10;
    let message = '';

    if (rand < 0.40) {
      let reward = Math.floor(Math.random() * 4001) + 14000;
      reward = applyMultipliers(user, reward, 'adventure');
      user.coins = (user.coins || 0) + reward;
      user.health = Math.max(0, user.health - damage);
      message = `${pickRandom(ADV_WINS)}, ganaste *¥${reward.toLocaleString()} ${currency}*! ❤️ -${damage} HP.`;
    } else if (rand < 0.70) {
      let loss = Math.floor(Math.random() * 2001) + 9000;
      const actualLoss = deductFunds(user, loss);
      user.health = Math.max(0, user.health - damage);
      message = `${pickRandom(ADV_LOSSES)}, perdiste *¥${actualLoss.toLocaleString()} ${currency}*. ❤️ -${damage} HP.`;
    } else {
      message = pickRandom(ADV_NEUTRALS);
    }

    setCooldown(user, 'lastadventure', 20 * 60 * 1000);
    return client.sendMessage(m.chat, { text: `「✿」 ${message}` }, { quoted: m });
  }
};

const cmdDungeon = {
  command: ['dungeon', 'mazmorra'],
  category: 'economia',
  desc: 'Explorar una mazmorra peligrosa en busca de tesoros arcanos.',
  economy: true,
  run: async (client, m, args, usedPrefix) => {
    const user = global.db.data?.users?.[m.sender];
    if (!user) return;
    const currency = getBotCurrency(client);

    user.health ??= 100;
    if (user.health < 5) {
      return m.reply(`❌ No tienes suficiente salud (${user.health}/100) para explorar la mazmorra.\nUsa *${usedPrefix}heal* para curarte.`);
    }

    const cd = checkCooldown(user, 'lastdungeon');
    if (!cd.ready) {
      return m.reply(`⏳ Debes esperar *${formatTime(cd.remaining)}* antes de volver a la mazmorra.`);
    }

    const rand = Math.random();
    const damage = Math.floor(Math.random() * 9) + 10;
    let message = '';

    if (rand < 0.40) {
      let reward = Math.floor(Math.random() * 3001) + 12000;
      reward = applyMultipliers(user, reward, 'dungeon');
      user.coins = (user.coins || 0) + reward;
      user.health = Math.max(0, user.health - damage);
      message = `${pickRandom(DUN_WINS)}, ganaste *¥${reward.toLocaleString()} ${currency}*! ❤️ -${damage} HP.`;
    } else if (rand < 0.70) {
      let loss = Math.floor(Math.random() * 1501) + 7500;
      const actualLoss = deductFunds(user, loss);
      user.health = Math.max(0, user.health - damage);
      message = `${pickRandom(DUN_LOSSES)}, perdiste *¥${actualLoss.toLocaleString()} ${currency}*. ❤️ -${damage} HP.`;
    } else {
      message = pickRandom(DUN_NEUTRALS);
    }

    setCooldown(user, 'lastdungeon', 17 * 60 * 1000);
    return client.sendMessage(m.chat, { text: `「✿」 ${message}` }, { quoted: m });
  }
};

const cmdRaid = {
  command: ['raid', 'raidboss'],
  category: 'economia',
  desc: 'Mazmorra cooperativa donde varios miembros del grupo luchan contra un jefe épico.',
  usage: '[start/unirse/pelear/atacar/estado/salir/cancelar]',
  economy: true,
  cooldown: 3,
  run: async (client, m, args, usedPrefix) => {
    const sub = (args[0] || '').toLowerCase();
    const currency = getBotCurrency(client);
    const user = global.db.data?.users?.[m.sender];
    if (!user) return;

    if (sub === 'start' || sub === 'iniciar' || sub === 'crear') {
      if (!m.isGroup) return m.reply('⚠️ Los raids solo se pueden iniciar en grupos.');
      if (gameEngine.has(m.chat, 'raid')) {
        return m.reply(`⚠️ Ya hay un raid activo en este grupo. Usa \`${usedPrefix}raid unirse\` para participar.`);
      }

      const entryCost = 2000;
      if ((user.coins || 0) < entryCost) {
        return m.reply(`❌ Necesitas al menos *¥${entryCost.toLocaleString()} ${currency}* para convocar un raid.`);
      }
      if ((user.health || 100) < 20) {
        return m.reply(`❌ Tu salud es muy baja para liderar un raid. Usa *${usedPrefix}heal* primero.`);
      }

      user.coins -= entryCost;
      const boss = pickRandom(BOSSES);
      const raidData = {
        boss,
        bossHp: boss.hp,
        bossMaxHp: boss.hp,
        players: [m.sender],
        damage: { [m.sender]: 0 },
        phase: 'recruiting',
        leader: m.sender,
        entryCost,
        round: 0,
      };

      gameEngine.start(m.chat, 'raid', m.sender, raidData, {
        timeout: 600000,
        onTimeout: () => {
          for (const jid of raidData.players) {
            const u = global.db.data?.users?.[jid];
            if (u) u.coins = (u.coins || 0) + entryCost;
          }
          client.sendMessage(m.chat, { text: '⏰ *El raid ha expirado.* Nadie derrotó al jefe a tiempo. Se devolvieron las monedas de entrada.' });
        }
      });

      return client.sendMessage(m.chat, {
        text: `⚔️ *¡RAID BOSS CONVOCADO!* ⚔️\n\n` +
          `${boss.emoji} *${boss.name}*\n` +
          `> _${boss.lore}_\n\n` +
          `${renderHpBar(boss.hp, boss.hp)} ${boss.hp}/${boss.hp} HP\n\n` +
          `👑 *Líder:* @${m.sender.split('@')[0]}\n` +
          `💰 *Costo de entrada:* ¥${entryCost.toLocaleString()} ${currency}\n` +
          `👥 *Jugadores:* 1/6\n\n` +
          `Usa *${usedPrefix}raid unirse* para unirte!\n` +
          `El líder puede iniciar la batalla con *${usedPrefix}raid pelear*`,
        mentions: [m.sender]
      });
    }

    if (sub === 'unirse' || sub === 'join' || sub === 'entrar') {
      const raid = gameEngine.get(m.chat, 'raid');
      if (!raid) return m.reply(`❌ No hay un raid activo. Usa *${usedPrefix}raid start* para crear uno.`);
      if (raid.phase !== 'recruiting') return m.reply('⚠️ La batalla ya comenzó. Espera al próximo raid.');
      if (raid.players.includes(m.sender)) return m.reply('⚠️ Ya estás dentro de este raid.');
      if (raid.players.length >= 6) return m.reply('⚠️ El raid ya alcanzó el máximo de 6 jugadores.');

      if ((user.coins || 0) < raid.entryCost) {
        return m.reply(`❌ Necesitas *¥${raid.entryCost.toLocaleString()} ${currency}* para unirte al raid.`);
      }
      if ((user.health || 100) < 20) {
        return m.reply(`❌ Tu salud es muy baja. Cúrate primero con *${usedPrefix}heal*.`);
      }

      user.coins -= raid.entryCost;
      raid.players.push(m.sender);
      raid.damage[m.sender] = 0;

      return client.sendMessage(m.chat, {
        text: `✅ @${m.sender.split('@')[0]} se unió al raid!\n👥 *Jugadores:* ${raid.players.length}/6\n\n${renderRaidStatus(raid)}`,
        mentions: [m.sender]
      });
    }

    if (sub === 'pelear' || sub === 'fight' || sub === 'luchar') {
      const raid = gameEngine.get(m.chat, 'raid');
      if (!raid) return m.reply(`❌ No hay un raid activo.`);
      if (raid.phase !== 'recruiting') return m.reply(`⚠️ La batalla ya está en curso. Ataca con \`${usedPrefix}raid atacar\`.`);
      if (m.sender !== raid.leader) return m.reply('⚠️ Solo el líder del raid puede iniciar la batalla.');
      if (raid.players.length < 2) return m.reply('⚠️ Se necesitan al menos *2 jugadores* para iniciar el raid.');

      raid.phase = 'fighting';
      return client.sendMessage(m.chat, {
        text: `⚔️ *¡LA BATALLA COMIENZA!* ⚔️\n\n` +
          `${raid.boss.emoji} *${raid.boss.name}* ruge con furia!\n\n` +
          `${renderRaidStatus(raid)}\n\n` +
          `Todos los participantes usen *${usedPrefix}raid atacar* para infligir daño!`,
        mentions: raid.players
      });
    }

    if (sub === 'atacar' || sub === 'attack' || sub === 'atk' || sub === 'golpear') {
      const raid = gameEngine.get(m.chat, 'raid');
      if (!raid) return m.reply(`❌ No hay un raid activo.`);
      if (raid.phase !== 'fighting') return m.reply(`⚠️ El raid aún no ha comenzado. El líder debe usar \`${usedPrefix}raid pelear\`.`);
      if (!raid.players.includes(m.sender)) return m.reply('⚠️ No estás participando en este raid.');

      raid._attackCooldowns = raid._attackCooldowns || {};
      const now = Date.now();
      const lastAtk = raid._attackCooldowns[m.sender] || 0;
      if (now - lastAtk < 6000) {
        const wait = Math.ceil((6000 - (now - lastAtk)) / 1000);
        return m.reply(`⏳ Espera *${wait}s* para tu próximo ataque.`);
      }
      raid._attackCooldowns[m.sender] = now;

      const playerDmg = calcPlayerDmg(user);
      raid.bossHp = Math.max(0, raid.bossHp - playerDmg);
      raid.damage[m.sender] = (raid.damage[m.sender] || 0) + playerDmg;
      raid.round++;

      const playerName = user?.name || m.sender.split('@')[0];
      const atkMsg = pickRandom(ATTACK_TEMPLATES)(playerName, playerDmg);

      const bossTarget = pickRandom(raid.players);
      const bossTargetUser = global.db.data?.users?.[bossTarget];
      const bossTargetName = bossTargetUser?.name || bossTarget.split('@')[0];
      const bossDmg = Math.floor(Math.random() * (raid.boss.maxAtk - raid.boss.minAtk + 1)) + raid.boss.minAtk;

      if (bossTargetUser) {
        bossTargetUser.health = Math.max(0, (bossTargetUser.health || 100) - Math.floor(bossDmg / 5));
      }

      const bossMsg = pickRandom(BOSS_ATTACK_TEMPLATES)(raid.boss, bossTargetName, bossDmg);
      let fullMsg = `${atkMsg}\n${bossMsg}\n\n${renderRaidStatus(raid)}`;

      if (raid.bossHp <= 0) {
        gameEngine.end(m.chat, 'raid');
        const totalDmg = Object.values(raid.damage).reduce((a, b) => a + b, 0) || 1;

        let victoryMsg = `\n\n🏆 *¡${raid.boss.name} HA SIDO DERROTADO!* 🏆\n\n💰 *Botín Repartido:*\n`;
        const mentions = [];

        for (const [jid, dmg] of Object.entries(raid.damage)) {
          const pct = dmg / totalDmg;
          let coinShare = Math.floor(raid.boss.coins * pct);
          const xpShare = Math.floor(raid.boss.xp * pct);
          const u = global.db.data?.users?.[jid];
          if (u) {
            coinShare = applyMultipliers(u, coinShare, 'raid');
            u.coins = (u.coins || 0) + coinShare;
            u.exp = (u.exp || 0) + xpShare;
            u.gameWins = (u.gameWins || 0) + 1;
            victoryMsg += `  • @${jid.split('@')[0]} — *¥${coinShare.toLocaleString()}* + *${xpShare} XP* (${Math.round(pct * 100)}% DMG)\n`;
            mentions.push(jid);
          }
        }

        const rareDrops = [];
        const drops = ['gema_dragon', 'anillo_fortuna', 'pluma_fenix', 'moneda_antigua', 'cristal_exp'];
        for (const jid of raid.players) {
          if (Math.random() < 0.15) {
            const u = global.db.data?.users?.[jid];
            if (u) {
              const drop = pickRandom(drops);
              u.inventory = u.inventory || [];
              u.inventory.push(drop);
              rareDrops.push(`  🎁 @${jid.split('@')[0]} obtuvo un drop raro: *${drop}*`);
              if (!mentions.includes(jid)) mentions.push(jid);
            }
          }
        }

        if (rareDrops.length > 0) {
          victoryMsg += `\n✨ *Drops Raros:*\n${rareDrops.join('\n')}`;
        }

        fullMsg += victoryMsg;
        return client.sendMessage(m.chat, { text: fullMsg, mentions });
      }

      return client.sendMessage(m.chat, { text: fullMsg, mentions: raid.players });
    }

    if (sub === 'estado' || sub === 'status' || sub === 'info') {
      const raid = gameEngine.get(m.chat, 'raid');
      if (!raid) return m.reply(`❌ No hay un raid activo.`);
      return client.sendMessage(m.chat, {
        text: `⚔️ *ESTADO DEL RAID* ⚔️\n\n` +
          `📋 *Fase:* ${raid.phase === 'recruiting' ? '🟡 Reclutando' : '🔴 En Batalla'}\n` +
          `👥 *Jugadores:* ${raid.players.length}/6\n\n` +
          renderRaidStatus(raid),
        mentions: raid.players
      });
    }

    if (sub === 'salir' || sub === 'leave') {
      const raid = gameEngine.get(m.chat, 'raid');
      if (!raid) return m.reply(`❌ No hay un raid activo.`);
      if (!raid.players.includes(m.sender)) return m.reply('⚠️ No estás en este raid.');
      if (raid.phase !== 'recruiting') return m.reply('⚠️ No puedes salir una vez iniciada la batalla.');
      if (m.sender === raid.leader) return m.reply(`⚠️ El líder no puede salir. Usa \`${usedPrefix}raid cancelar\` para cancelarlo.`);

      raid.players = raid.players.filter(j => j !== m.sender);
      delete raid.damage[m.sender];
      user.coins = (user.coins || 0) + raid.entryCost;

      return client.sendMessage(m.chat, {
        text: `🚪 @${m.sender.split('@')[0]} abandonó el raid. Se devolvieron *¥${raid.entryCost.toLocaleString()} ${currency}*.\n👥 *Jugadores restantes:* ${raid.players.length}/6`,
        mentions: [m.sender]
      });
    }

    if (sub === 'cancelar' || sub === 'cancel') {
      const raid = gameEngine.get(m.chat, 'raid');
      if (!raid) return m.reply(`❌ No hay un raid activo.`);
      if (m.sender !== raid.leader) return m.reply('⚠️ Solo el líder puede cancelar el raid.');
      if (raid.phase !== 'recruiting') return m.reply('⚠️ No puedes cancelar un raid mientras se combate.');

      gameEngine.end(m.chat, 'raid');
      for (const jid of raid.players) {
        const u = global.db.data?.users?.[jid];
        if (u) u.coins = (u.coins || 0) + raid.entryCost;
      }

      return m.reply('🛑 *Raid cancelado por el líder.* Se devolvieron las monedas de entrada a todos los participantes.');
    }

    const helpText = `⚔️ *RAID BOSS — Mazmorra Cooperativa*\n\n` +
      `Enfréntate a un jefe con tus compañeros de grupo.\n\n` +
      `📋 *Subcomandos:*\n` +
      `• *${usedPrefix}raid start* — Convocar raid (¥2,000)\n` +
      `• *${usedPrefix}raid unirse* — Unirse al raid activo\n` +
      `• *${usedPrefix}raid pelear* — Iniciar batalla (líder)\n` +
      `• *${usedPrefix}raid atacar* — Atacar al jefe\n` +
      `• *${usedPrefix}raid estado* — Ver estado y daño\n` +
      `• *${usedPrefix}raid salir* — Salir y recuperar entrada\n` +
      `• *${usedPrefix}raid cancelar* — Cancelar el raid (líder)`;

    return m.reply(helpText);
  }
};

const cmdRitual = {
  command: ['ritual', 'invoke'],
  category: 'economia',
  desc: 'Invocar un ritual arcano para obtener recompensas místicas.',
  economy: true,
  run: async (client, m, args, usedPrefix) => {
    const user = global.db.data?.users?.[m.sender];
    if (!user) return;
    const monedas = getBotCurrency(client);

    const cd = checkCooldown(user, 'lastinvoke');
    if (!cd.ready) {
      return m.reply(`⏳ Debes esperar *${formatTime(cd.remaining)}* para invocar otro ritual.`);
    }

    const roll = Math.random();
    let reward = 0, narration = '', bonusMsg = '';

    if (roll < 0.05) {
      reward = Math.floor(Math.random() * 2001) + 11000;
      narration = pickRandom(RITUAL_LEGENDARY);
      bonusMsg = '\n✨ *¡Recompensa LEGENDARIA obtenida!*';
    } else {
      reward = Math.floor(Math.random() * 3001) + 8000;
      narration = pickRandom(RITUAL_MSGS);
      if (Math.random() < 0.15) {
        const bonus = Math.floor(Math.random() * 2001) + 2500;
        reward += bonus;
        bonusMsg = `\n🌟 ¡Energía mística extra! Ganaste *+¥${bonus.toLocaleString()}* adicionales.`;
      }
    }

    reward = applyMultipliers(user, reward, 'ritual');
    user.coins = (user.coins || 0) + reward;
    setCooldown(user, 'lastinvoke', 12 * 60 * 1000);

    const msg = `「✿」 ${narration}\nGanaste *¥${reward.toLocaleString()} ${monedas}*${bonusMsg}`;
    return client.sendMessage(m.chat, { text: msg }, { quoted: m });
  }
};

const cmdAchievements = {
  command: ['achievements', 'logros', 'badges'],
  category: 'economia',
  economy: true,
  desc: 'Muestra tus logros desbloqueados y progreso general.',
  cooldown: 5,
  run: async (client, m) => {
    const user = global.db.data?.users?.[m.sender];
    if (!user) return;
    const currency = getBotCurrency(client);

    const newAchievements = checkAchievements(m.sender);
    const unlocked = user.achievements || [];

    let msg = `🏅 *L O G R O S* 🏅\n\n`;

    if (newAchievements.length > 0) {
      msg += `> 🎉 *¡Nuevos logros desbloqueados!*\n`;
      for (const a of newAchievements) {
        let rewardText = '';
        if (a.reward?.xp) rewardText += `+${a.reward.xp} XP `;
        if (a.reward?.coins) rewardText += `+${a.reward.coins} ${currency}`;
        msg += ` ⊳ ${a.name} — ${rewardText.trim()}\n`;
      }
      msg += '\n';
    }

    const unlockedAchievements = ACHIEVEMENTS.filter(a => unlocked.includes(a.id));
    const lockedAchievements = ACHIEVEMENTS.filter(a => !unlocked.includes(a.id));

    if (unlockedAchievements.length > 0) {
      msg += `> ✅ *Desbloqueados (${unlockedAchievements.length}/${ACHIEVEMENTS.length})*\n`;
      for (const a of unlockedAchievements) {
        msg += ` ⊳ ${a.name} — _${a.desc}_\n`;
      }
    }

    if (lockedAchievements.length > 0) {
      msg += `\n> 🔒 *Por desbloquear (${lockedAchievements.length})*\n`;
      for (const a of lockedAchievements) {
        let rewardText = '';
        if (a.reward?.xp) rewardText += `+${a.reward.xp} XP `;
        if (a.reward?.coins) rewardText += `+${a.reward.coins} ${currency}`;
        msg += ` ⊳ ??? — _${a.desc}_ [${rewardText.trim()}]\n`;
      }
    }

    const pct = Math.round((unlockedAchievements.length / ACHIEVEMENTS.length) * 100);
    const filled = Math.min(10, Math.round(pct / 10));
    const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
    msg += `\n⌦ Progreso: [${bar}] ${pct}%`;

    return client.sendMessage(m.chat, { text: msg }, { quoted: m });
  }
};

const cmdEinfo = {
  command: ['infoeconomy', 'cooldowns', 'economyinfo', 'einfo'],
  category: 'economia',
  economy: true,
  desc: 'Muestra los tiempos de espera (cooldowns) y balance del usuario.',
  run: async (client, m) => {
    const user = global.db.data?.users?.[m.sender];
    if (!user) return;
    const currency = getBotCurrency(client);
    const now = Date.now();

    const cooldownList = [
      { name: 'Work', key: 'lastwork' },
      { name: 'Slut', key: 'lastslut' },
      { name: 'Crime', key: 'lastcrime' },
      { name: 'Mine', key: 'lastmine' },
      { name: 'Hunt', key: 'lasthunt' },
      { name: 'Fish', key: 'lastfish' },
      { name: 'Ritual', key: 'lastinvoke' },
      { name: 'Adventure', key: 'lastadventure' },
      { name: 'Dungeon', key: 'lastdungeon' },
      { name: 'Steal', key: 'laststeal' },
      { name: 'Daily', key: 'lastdaily' },
      { name: 'Weekly', key: 'lastweekly' },
      { name: 'Monthly', key: 'lastmonthly' },
    ];

    const lines = cooldownList.map(item => {
      const remaining = Math.max(0, (user[item.key] || 0) - now);
      return `• *${item.name}:* ${formatTime(remaining)}`;
    }).join('\n');

    const coins = user.coins || 0;
    const bank = user.bank || 0;
    const name = user.name || m.sender.split('@')[0];

    const text = `📊 *ESTADO ECONÓMICO*\n\n` +
      `👤 *Usuario:* \`<${name}>\`\n` +
      `🪙 *Cartera:* ¥${coins.toLocaleString()} ${currency}\n` +
      `🏦 *Banco:* ¥${bank.toLocaleString()} ${currency}\n\n` +
      `⏳ *Tiempos de espera:*\n${lines}`;

    return client.sendMessage(m.chat, { text }, { quoted: m });
  }
};

export default [cmdAdventure, cmdDungeon, cmdRaid, cmdRitual, cmdAchievements, cmdEinfo];
