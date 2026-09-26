/**
 * 🏪 rpg_shop.js — Tienda del Bot, consumibles, inventario y gestión de títulos.
 * Reúne: inventory, shop, shopData, buy, use, heal, settitle
 */
import { getBotCurrency } from '../../utils/tools.js';
import { resolveLidToRealJid } from '../../core/utils.js';
import { deductFunds } from './rpg_core.js';

// ── DATOS DE LA TIENDA Y ARTÍCULOS ──

export const SHOP_ITEMS = {
  titles: [
    { id: 'title_legend', name: '🏆 Leyenda', desc: '+15% de Monedas en .work', price: 5000, currency: 'coins', type: 'title', value: '🏆 Leyenda' },
    { id: 'title_shadow', name: '🌑 Sombra', desc: 'Inmunidad total a ser robado (.steal)', price: 8000, currency: 'coins', type: 'title', value: '🌑 Sombra' },
    { id: 'title_star', name: '⭐ Estrella', desc: '+15% XP en Juegos interactivos', price: 4000, currency: 'coins', type: 'title', value: '⭐ Estrella' },
    { id: 'title_neko', name: '🐱 Neko', desc: '+10 Salud recuperada al pescar', price: 3500, currency: 'coins', type: 'title', value: '🐱 Neko' },
    { id: 'title_fire', name: '🔥 Infernal', desc: '+20% de recompensa en .dungeon y .raid', price: 6000, currency: 'coins', type: 'title', value: '🔥 Infernal' },
    { id: 'title_lucky', name: '🍀 Suertudo', desc: '+15% prob. de éxito en .crime', price: 4500, currency: 'coins', type: 'title', value: '🍀 Suertudo' },
    { id: 'title_fisher', name: '🎣 Pescador', desc: '+20% de Monedas en .fish', price: 3000, currency: 'coins', type: 'title', value: '🎣 Pescador' },
    { id: 'title_miner', name: '⛏️ Minero', desc: '+20% de Monedas en .mine', price: 3500, currency: 'coins', type: 'title', value: '⛏️ Minero' },
    { id: 'title_tycoon', name: '💰 Magnate', desc: '+20% Monedas en reclamos de rachas', price: 10000, currency: 'coins', type: 'title', value: '💰 Magnate' },
  ],
  boosters: [
    { id: 'xp_boost_2x', name: '⚡ XP Boost x2', desc: 'Duplica tu XP por 1 hora.', price: 2500, currency: 'coins', type: 'booster', duration: 3600000, multiplier: 2 },
    { id: 'xp_boost_3x', name: '💥 XP Boost x3', desc: 'Triplica tu XP por 30 min.', price: 5000, currency: 'coins', type: 'booster', duration: 1800000, multiplier: 3 },
  ],
  utilities: [
    { id: 'shield', name: '🛡️ Escudo Anti-Robo', desc: 'Te protege de .steal por 24h.', price: 3000, currency: 'coins', type: 'shield', duration: 86400000 },
    { id: 'extra_daily', name: '🎁 Daily Extra', desc: 'Reclama un segundo .daily hoy.', price: 1000, currency: 'coins', type: 'extra_daily' },
    { id: 'cooldown_skip', name: '⏩ Skip Cooldown', desc: 'Elimina el cooldown de tu próximo comando.', price: 500, currency: 'coins', type: 'cooldown_skip' },
  ],
  consumables: [
    { id: 'pocion_vida', name: '❤️‍🩹 Poción de Vida', desc: 'Restaura 50 puntos de salud.', price: 800, currency: 'coins', type: 'consumable', effect: 'heal', value: 50 },
    { id: 'pocion_suerte', name: '🍀 Poción de Suerte', desc: '+25% prob. de éxito en crimen y robo por 1h.', price: 1500, currency: 'coins', type: 'consumable', effect: 'luck', duration: 3600000, value: 0.25 },
    { id: 'megafono', name: '📢 Megáfono', desc: 'Envía un anuncio destacado al grupo.', price: 500, currency: 'coins', type: 'consumable', effect: 'megafono' },
  ],
  lootboxes: [
    { id: 'caja_misteriosa', name: '📦 Caja Misteriosa', desc: 'Premio aleatorio (coins, XP o item raro).', price: 2000, currency: 'coins', type: 'lootbox' },
    { id: 'cofre_dorado', name: '🏆 Cofre Dorado', desc: 'Mayor probabilidad de items raros y legendarios.', price: 5000, currency: 'coins', type: 'lootbox' },
  ],
  exchange: [
    { id: 'coins_to_exp', name: '💱 1000 Coins → 500 XP', desc: 'Convierte monedas a experiencia.', price: 1000, currency: 'coins', type: 'exchange', gives: { exp: 500 } },
    { id: 'exp_to_coins', name: '💱 1000 XP → 500 Coins', desc: 'Convierte experiencia a monedas.', price: 1000, currency: 'exp', type: 'exchange', gives: { coins: 500 } },
  ],
};

// Items raros que SOLO se obtienen de lootboxes (no se compran en tienda, sí se tradean)
export const RARE_ITEMS = [
  { id: 'gema_dragon', name: '🐉 Gema del Dragón', desc: '+30% daño en .dungeon y .raid', rarity: 'legendario' },
  { id: 'anillo_fortuna', name: '💍 Anillo de la Fortuna', desc: '+10% en todas las recompensas', rarity: 'epico' },
  { id: 'pluma_fenix', name: '🪶 Pluma de Fénix', desc: 'Revive con 100 HP si caes en combate', rarity: 'legendario' },
  { id: 'moneda_antigua', name: '🪙 Moneda Antigua', desc: 'Coleccionable valioso en tradeos o venta.', rarity: 'raro' },
  { id: 'cristal_exp', name: '💎 Cristal de XP', desc: 'Otorga entre 1000-5000 XP al consumirse.', rarity: 'epico' },
  { id: 'pergamino_sabio', name: '📜 Pergamino del Sabio', desc: '+50% XP en trivia por 2h', rarity: 'raro' },
];

export const ALL_ITEMS = [
  ...SHOP_ITEMS.titles,
  ...SHOP_ITEMS.boosters,
  ...SHOP_ITEMS.utilities,
  ...SHOP_ITEMS.consumables,
  ...SHOP_ITEMS.lootboxes,
  ...SHOP_ITEMS.exchange
];

export const ITEM_MAP = new Map(ALL_ITEMS.map(item => [item.id, item]));
export const RARE_MAP = new Map(RARE_ITEMS.map(item => [item.id, item]));

export const TITLE_NAMES = {
  title_legend: '🏆 Leyenda',
  title_shadow: '🌑 Sombra',
  title_star: '⭐ Estrella',
  title_neko: '🐱 Neko',
  title_fire: '🔥 Infernal',
  title_lucky: '🍀 Suertudo',
  title_fisher: '🎣 Pescador',
  title_miner: '⛏️ Minero',
  title_tycoon: '💰 Magnate',
};

function openLootbox(isGolden) {
  const roll = Math.random();
  const rareChance = isGolden ? 0.40 : 0.15;

  if (roll < rareChance) {
    const pool = isGolden ? RARE_ITEMS : RARE_ITEMS.filter(i => i.rarity !== 'legendario');
    const item = pool[Math.floor(Math.random() * pool.length)];
    return { type: 'rare_item', item };
  } else if (roll < rareChance + 0.45) {
    const amount = isGolden
      ? Math.floor(Math.random() * 8000) + 3000
      : Math.floor(Math.random() * 4000) + 1000;
    return { type: 'coins', amount };
  } else {
    const amount = isGolden
      ? Math.floor(Math.random() * 5000) + 2000
      : Math.floor(Math.random() * 3000) + 500;
    return { type: 'xp', amount };
  }
}

// ── COMANDOS DE LA TIENDA ──

const cmdShop = {
  command: ['shop', 'tienda', 'store'],
  category: 'economia',
  economy: true,
  desc: 'Abre la tienda RPG para comprar artículos y títulos.',
  usage: '.shop | .buy <id> | .inventory',
  cooldown: 3,
  run: async (client, m, args, usedPrefix) => {
    const categories = [
      { title: '🎖️ TÍTULOS', items: SHOP_ITEMS.titles },
      { title: '⚡ BOOSTERS', items: SHOP_ITEMS.boosters },
      { title: '🛡️ UTILIDADES', items: SHOP_ITEMS.utilities },
      { title: '🧪 CONSUMIBLES', items: SHOP_ITEMS.consumables },
      { title: '📦 LOOTBOXES', items: SHOP_ITEMS.lootboxes },
      { title: '💱 INTERCAMBIO', items: SHOP_ITEMS.exchange }
    ];

    let menu = `🏪 *TIENDA DEL BOT* 🏪\n\n`;
    for (const cat of categories) {
      menu += `> *${cat.title}*\n`;
      for (const item of cat.items) {
        const icon = item.currency === 'coins' ? '🪙' : '✨';
        menu += ` ⊳ \`${item.id}\` — *${item.name}* · ${item.price.toLocaleString()} ${icon}\n     _${item.desc}_\n`;
      }
      menu += `\n`;
    }
    menu += `*Uso:* \`${usedPrefix}buy <id>\`\n*Ejemplo:* \`${usedPrefix}buy caja_misteriosa\``;

    return client.sendMessage(m.chat, { text: menu.trim() }, { quoted: m });
  }
};

const cmdInventory = {
  command: ['inventory', 'inv', 'inventario', 'mochila'],
  category: 'economia',
  economy: true,
  desc: 'Muestra tu inventario de objetos y títulos.',
  cooldown: 3,
  run: async (client, m, args, usedPrefix) => {
    const user = global.db.data?.users?.[m.sender] || {};
    const inventory = user.inventory || [];

    let msg = `🎒 *INVENTARIO PERSONAL* 🎒\n\n`;
    let hasItems = false;

    // Conteo y agrupación O(N) en una sola pasada
    const counts = {};
    const userTitles = [];
    const consumables = [];
    const rares = [];

    for (const id of inventory) {
      if (id.startsWith('title_')) {
        if (!userTitles.includes(id)) userTitles.push(id);
      } else if (ITEM_MAP.has(id) && ITEM_MAP.get(id).type === 'consumable') {
        counts[id] = (counts[id] || 0) + 1;
        if (!consumables.includes(id)) consumables.push(id);
      } else if (RARE_MAP.has(id)) {
        counts[id] = (counts[id] || 0) + 1;
        if (!rares.includes(id)) rares.push(id);
      }
    }

    if (userTitles.length > 0) {
      hasItems = true;
      msg += `> 🎖️ *Títulos Poseídos*\n`;
      for (const t of userTitles) {
        const eq = user.title === t ? ' *(equipado)*' : '';
        msg += ` ⊳ ${TITLE_NAMES[t] || t}${eq}\n`;
      }
      msg += `\n`;
    }

    if (consumables.length > 0) {
      hasItems = true;
      msg += `> 🧪 *Consumibles*\n`;
      for (const id of consumables) {
        const item = ITEM_MAP.get(id);
        msg += ` ⊳ ${item.name} x${counts[id]}\n`;
      }
      msg += `\n`;
    }

    if (rares.length > 0) {
      hasItems = true;
      msg += `> ✨ *Objetos Raros*\n`;
      for (const id of rares) {
        const item = RARE_MAP.get(id);
        const rarityIcon = item.rarity === 'legendario' ? '🌟' : item.rarity === 'epico' ? '💜' : '🔵';
        msg += ` ⊳ ${rarityIcon} ${item.name} x${counts[id]} _(${item.rarity})_\n`;
      }
      msg += `\n`;
    }

    // Estados activos
    const now = Date.now();
    if (user.xpBoost && user.xpBoost.expiresAt > now) {
      hasItems = true;
      const mins = Math.ceil((user.xpBoost.expiresAt - now) / 60000);
      msg += `> ⚡ *Booster Activo:* XP x${user.xpBoost.multiplier} (${mins} min)\n`;
    }
    if (user.shield && user.shield.expiresAt > now) {
      hasItems = true;
      const hours = Math.ceil((user.shield.expiresAt - now) / 3600000);
      msg += `> 🛡️ *Escudo Anti-Robo Activo:* ${hours}h restantes\n`;
    }
    if (user.fortuneBuff && user.fortuneBuff.expiresAt > now) {
      hasItems = true;
      const mins = Math.ceil((user.fortuneBuff.expiresAt - now) / 60000);
      msg += `> 🍀 *Buff Fortuna:* +${Math.round((user.fortuneBuff.value || 0.1) * 100)}% (${mins} min)\n`;
    }

    if (!hasItems) {
      msg += `_Tu inventario está vacío. Usa \`${usedPrefix}shop\` para comprar artículos._\n`;
    }

    msg += `\n*Usar:* \`${usedPrefix}use <id>\` · *Equipar:* \`${usedPrefix}settitle <id>\``;
    return client.sendMessage(m.chat, { text: msg.trim() }, { quoted: m });
  }
};

const cmdBuy = {
  command: ['buy', 'comprar'],
  category: 'economia',
  economy: true,
  desc: 'Compra un artículo de la tienda usando su ID.',
  usage: '.buy <id>',
  cooldown: 3,
  run: async (client, m, args, usedPrefix) => {
    const itemId = args[0]?.toLowerCase();
    if (!itemId) {
      return m.reply(`❌ Especifica el ID del artículo.\n*Ejemplo:* \`${usedPrefix}buy title_star\`\n\nUsa \`${usedPrefix}shop\` para ver la lista.`);
    }

    const item = ITEM_MAP.get(itemId);
    if (!item) {
      return m.reply(`❌ El artículo \`${itemId}\` no existe. Revisa \`${usedPrefix}shop\`.`);
    }

    const user = global.db.data?.users?.[m.sender];
    if (!user) return;
    user.inventory ??= [];

    if (item.currency === 'coins') {
      if ((user.coins || 0) < item.price) {
        return m.reply(`❌ Saldo insuficiente en cartera.\n*Saldo:* ${(user.coins || 0).toLocaleString()} 🪙\n*Precio:* ${item.price.toLocaleString()} 🪙`);
      }
      user.coins -= item.price;
    } else {
      if ((user.exp || 0) < item.price) {
        return m.reply(`❌ Experiencia insuficiente.\n*XP actual:* ${(user.exp || 0).toLocaleString()} ✨\n*Precio:* ${item.price.toLocaleString()} ✨`);
      }
      user.exp -= item.price;
    }

    switch (item.type) {
      case 'title': {
        if (user.inventory.includes(item.id)) {
          if (item.currency === 'coins') user.coins += item.price;
          else user.exp += item.price;
          return m.reply(`⚠️ Ya posees el título *${item.name}*. Equípalo con \`${usedPrefix}settitle ${item.id}\`.`);
        }
        user.inventory.push(item.id);
        return m.reply(`✅ ¡Compraste el título *${item.name}*!\nEquípalo usando \`${usedPrefix}settitle ${item.id}\`.`);
      }

      case 'booster': {
        user.xpBoost = { multiplier: item.multiplier, expiresAt: Date.now() + item.duration };
        const mins = Math.floor(item.duration / 60000);
        return m.reply(`⚡ ¡Activaste *${item.name}*!\nTu XP se multiplicará x${item.multiplier} durante los próximos *${mins} minutos*.`);
      }

      case 'shield': {
        user.shield = { expiresAt: Date.now() + item.duration };
        const hours = Math.floor(item.duration / 3600000);
        return m.reply(`🛡️ ¡Activaste *${item.name}*!\nEstás protegido contra robos por las próximas *${hours} horas*.`);
      }

      case 'extra_daily': {
        user.extraDaily = true;
        return m.reply(`🎁 ¡Compraste *${item.name}*!\nPuedes reclamar otro \`${usedPrefix}daily\` hoy.`);
      }

      case 'cooldown_skip': {
        user.cooldownSkip = true;
        return m.reply(`⏩ ¡Compraste *${item.name}*!\nTu próximo comando no tendrá cooldown.`);
      }

      case 'consumable': {
        user.inventory.push(item.id);
        return m.reply(`✅ ¡Compraste *${item.name}*!\nConsúmelo usando \`${usedPrefix}use ${item.id}\`.`);
      }

      case 'lootbox': {
        const isGolden = item.id === 'cofre_dorado';
        const result = openLootbox(isGolden);
        let msg = `📦 *¡ABRIENDO ${isGolden ? 'COFRE DORADO' : 'CAJA MISTERIOSA'}!* 📦\n\n`;

        if (result.type === 'rare_item') {
          user.inventory.push(result.item.id);
          const rarityIcon = result.item.rarity === 'legendario' ? '🌟' : result.item.rarity === 'epico' ? '💜' : '🔵';
          msg += `${rarityIcon} *¡ITEM ${result.item.rarity.toUpperCase()}!*\n` +
            `Obtuviste: *${result.item.name}*\n_${result.item.desc}_\n\n` +
            `Úsalo con \`${usedPrefix}use ${result.item.id}\` o tradéalo.`;
        } else if (result.type === 'coins') {
          user.coins = (user.coins || 0) + result.amount;
          msg += `🪙 Obtuviste *${result.amount.toLocaleString()} Monedas*`;
        } else {
          user.exp = (user.exp || 0) + result.amount;
          msg += `✨ Obtuviste *${result.amount.toLocaleString()} XP*`;
        }
        return m.reply(msg);
      }

      case 'exchange': {
        if (item.gives.exp) {
          user.exp = (user.exp || 0) + item.gives.exp;
          return m.reply(`✅ ¡Intercambio realizado!\n*-${item.price.toLocaleString()} 🪙* ➔ *+${item.gives.exp.toLocaleString()} ✨ XP*`);
        } else if (item.gives.coins) {
          user.coins = (user.coins || 0) + item.gives.coins;
          return m.reply(`✅ ¡Intercambio realizado!\n*-${item.price.toLocaleString()} ✨ XP* ➔ *+${item.gives.coins.toLocaleString()} 🪙 Monedas*`);
        }
        break;
      }

      default:
        return m.reply(`✅ Compraste *${item.name}*.`);
    }
  }
};

const cmdUse = {
  command: ['use', 'usar'],
  category: 'economia',
  economy: true,
  desc: 'Usa un consumible u objeto raro de tu inventario.',
  usage: '.use <item_id>',
  cooldown: 3,
  run: async (client, m, args, usedPrefix) => {
    const itemId = args[0]?.toLowerCase();
    if (!itemId) {
      return m.reply(`❌ Especifica el item a usar.\n*Ejemplo:* \`${usedPrefix}use pocion_vida\`\n\nRevisa tu inventario con \`${usedPrefix}inv\`.`);
    }

    const user = global.db.data?.users?.[m.sender];
    if (!user || !user.inventory) return;

    const idx = user.inventory.indexOf(itemId);
    if (idx === -1) {
      return m.reply(`❌ No tienes \`${itemId}\` en tu inventario.`);
    }

    const shopItem = ITEM_MAP.get(itemId);
    const rareItem = RARE_MAP.get(itemId);

    if (shopItem && shopItem.type === 'consumable') {
      user.inventory.splice(idx, 1);

      if (shopItem.effect === 'heal') {
        user.health = Math.min((user.health || 100) + shopItem.value, 100);
        return m.reply(`❤️ ¡Usaste *${shopItem.name}*!\nRecuperaste *${shopItem.value} HP*. Salud actual: *${user.health}/100*.`);
      }
      if (shopItem.effect === 'luck') {
        user.luckBuff = { expiresAt: Date.now() + shopItem.duration, value: shopItem.value };
        const mins = Math.floor(shopItem.duration / 60000);
        return m.reply(`🍀 ¡Usaste *${shopItem.name}*!\n+25% probabilidad de éxito por los próximos *${mins} minutos*.`);
      }
      if (shopItem.effect === 'megafono') {
        const texto = args.slice(1).join(' ');
        if (!texto) {
          user.inventory.push(itemId);
          return m.reply(`📢 Debes ingresar un mensaje.\n*Ejemplo:* \`${usedPrefix}use megafono ¡Hola a todos!\``);
        }
        return client.sendMessage(m.chat, {
          text: `📢 *ANUNCIO DE @${m.sender.split('@')[0]}*\n\n${texto}`,
          mentions: [m.sender]
        });
      }
      return m.reply(`✅ Usaste *${shopItem.name}*.`);
    }

    if (rareItem) {
      user.inventory.splice(idx, 1);

      switch (rareItem.id) {
        case 'cristal_exp': {
          const xpGained = Math.floor(Math.random() * 4001) + 1000;
          user.exp = (user.exp || 0) + xpGained;
          return m.reply(`💎 ¡Usaste *${rareItem.name}*!\nObtuviste *+${xpGained.toLocaleString()} XP*.`);
        }
        case 'pergamino_sabio': {
          user.triviaBuff = { expiresAt: Date.now() + 7200000, value: 0.50 };
          return m.reply(`📜 ¡Usaste *${rareItem.name}*!\n+50% XP en trivia por *2 horas*.`);
        }
        case 'pluma_fenix': {
          user.fenixRevive = true;
          return m.reply(`🪶 ¡Usaste *${rareItem.name}*!\nSi caes en combate en mazmorras revivirás automáticamente con 100 HP.`);
        }
        case 'gema_dragon': {
          user.dungeonBuff = { expiresAt: Date.now() + 7200000, value: 0.30 };
          return m.reply(`🐉 ¡Usaste *${rareItem.name}*!\n+30% daño en mazmorras y raids por *2 horas*.`);
        }
        case 'anillo_fortuna': {
          user.fortuneBuff = { expiresAt: Date.now() + 3600000, value: 0.10 };
          return m.reply(`💍 ¡Usaste *${rareItem.name}*!\n+10% en todas las recompensas por *1 hora*.`);
        }
        case 'moneda_antigua': {
          const val = Math.floor(Math.random() * 5001) + 5000;
          user.coins = (user.coins || 0) + val;
          return m.reply(`🪙 ¡Vendiste la *${rareItem.name}* por *+¥${val.toLocaleString()} Monedas*!`);
        }
        default:
          return m.reply(`✅ Usaste *${rareItem.name}*.`);
      }
    }

    return m.reply(`❌ El artículo \`${itemId}\` no es consumible.`);
  }
};

const cmdHeal = {
  command: ['heal', 'curar'],
  category: 'economia',
  economy: true,
  desc: 'Curar salud propia o de otro miembro usando monedas.',
  run: async (client, m) => {
    const currency = getBotCurrency(client);
    const db = global.db.data;
    const mentioned = m.mentionedJid || [];
    const whoRaw = mentioned[0] || (m.quoted ? m.quoted.sender : null);
    const who = whoRaw ? await resolveLidToRealJid(whoRaw, client, m.chat) : null;

    const healer = db.users[m.sender];
    const target = who ? db.users[who] : healer;
    if (!target) return m.reply('❌ El usuario no está registrado en el bot.');

    target.health ??= 100;
    if (target.health >= 100) {
      const targetName = who ? target.name || who.split('@')[0] : 'Tu';
      return m.reply(`❤️ ${who ? `La salud de *${targetName}*` : 'Tu salud'} ya está al máximo (100/100).`);
    }

    const faltante = 100 - target.health;
    const costo = Math.ceil(faltante / 10) * 500;
    const totalFondos = (healer.coins || 0) + (healer.bank || 0);

    if (totalFondos < costo) {
      return m.reply(`❌ Fondos insuficientes. Necesitas *¥${costo.toLocaleString()} ${currency}* para curar ${faltante} HP.`);
    }

    deductFunds(healer, costo);
    target.health = 100;

    const targetName = who ? target.name || who.split('@')[0] : 'te has';
    return m.reply(`❤️ ¡Curación completada! ${who ? `Curaste a *${targetName}*` : 'Te has curado'} al 100% de salud por *¥${costo.toLocaleString()} ${currency}*.`);
  }
};

const cmdSetTitle = {
  command: ['settitle', 'titulo'],
  category: 'economia',
  economy: true,
  desc: 'Equipa o remueve un título que hayas adquirido.',
  usage: '.settitle <id> | .settitle off',
  cooldown: 3,
  run: async (client, m, args, usedPrefix) => {
    const user = global.db.data?.users?.[m.sender];
    if (!user) return;
    const inventory = user.inventory || [];

    if (!args[0]) {
      if (user.title) {
        return m.reply(`🎖️ Tu título actual es: *${TITLE_NAMES[user.title] || user.title}*\n\nUsa \`${usedPrefix}settitle <id>\` para cambiarlo o \`${usedPrefix}settitle off\` para quitarlo.`);
      }
      return m.reply(`⚠️ Especifica el ID del título.\n*Ejemplo:* \`${usedPrefix}settitle title_star\`\n\nRevisa tus títulos en \`${usedPrefix}inventory\`.`);
    }

    const titleId = args[0].toLowerCase();
    if (titleId === 'off' || titleId === 'none' || titleId === 'quitar') {
      user.title = null;
      return m.reply('✅ Has removido tu título equipado.');
    }

    if (!inventory.includes(titleId)) {
      return m.reply(`❌ No posees el título \`${titleId}\`.\nRevisa \`${usedPrefix}shop\` para comprarlo o \`${usedPrefix}inventory\` para ver los que tienes.`);
    }

    user.title = titleId;
    return m.reply(`✅ ¡Título equipado!\nAhora portas: *${TITLE_NAMES[titleId] || titleId}*`);
  }
};

export default [cmdShop, cmdInventory, cmdBuy, cmdUse, cmdHeal, cmdSetTitle];
