/**
 * 🎮 playercard.js — Generador visual de Tarjeta de Jugador (Gamer Card) RPG con Jimp.
 * Muestra avatar circular, barras de vida y XP, nivel, rango, monedas, victorias y títulos.
 */
import * as JimpModule from 'jimp';
import axios from 'axios';
import { resolveLidToRealJid } from '../../core/utils.js';
import { xpRange, getBotCurrency } from '../../utils/tools.js';
import { TITLE_NAMES } from '../economia/rpg_shop.js';

const Jimp = JimpModule.Jimp || JimpModule.default || JimpModule;

// ── UTILIDADES DE DIBUJO DIRECTO EN EL BUFFER DE JIMP ──

function fillRect(img, x0, y0, w, h, [r, g, b, a = 255]) {
  const imgW = img.bitmap.width;
  const imgH = img.bitmap.height;
  const xEnd = Math.min(x0 + w, imgW);
  const yEnd = Math.min(y0 + h, imgH);
  for (let y = Math.max(0, y0); y < yEnd; y++) {
    for (let x = Math.max(0, x0); x < xEnd; x++) {
      const idx = (y * imgW + x) * 4;
      img.bitmap.data[idx] = r;
      img.bitmap.data[idx + 1] = g;
      img.bitmap.data[idx + 2] = b;
      img.bitmap.data[idx + 3] = a;
    }
  }
}

function drawBorder(img, x0, y0, w, h, thickness, color) {
  fillRect(img, x0, y0, w, thickness, color); // Arriba
  fillRect(img, x0, y0 + h - thickness, w, thickness, color); // Abajo
  fillRect(img, x0, y0, thickness, h, color); // Izquierda
  fillRect(img, x0 + w - thickness, y0, thickness, h, color); // Derecha
}

function circleMask(img) {
  const w = img.bitmap.width;
  const h = img.bitmap.height;
  const r = Math.min(w, h) / 2;
  const cx = w / 2;
  const cy = h / 2;
  img.scan(0, 0, w, h, (x, y, idx) => {
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy > r * r) {
      img.bitmap.data[idx + 3] = 0; // Transparente fuera del círculo
    }
  });
  return img;
}

function drawCircleBorder(img, cx, cy, radius, thickness, [r, g, b, a = 255]) {
  const w = img.bitmap.width;
  const h = img.bitmap.height;
  const rMin = radius - thickness;
  const rMax = radius;
  img.scan(0, 0, w, h, (x, y, idx) => {
    const dx = x - cx;
    const dy = y - cy;
    const distSq = dx * dx + dy * dy;
    if (distSq >= rMin * rMin && distSq <= rMax * rMax) {
      img.bitmap.data[idx] = r;
      img.bitmap.data[idx + 1] = g;
      img.bitmap.data[idx + 2] = b;
      img.bitmap.data[idx + 3] = a;
    }
  });
}

// ── GENERADOR DE LA TARJETA GAMER ──

async function createPlayerCardImage({
  name,
  level,
  rank,
  hp,
  xpProgress,
  totalCoins,
  gameWins,
  gameLosses,
  titleName,
  avatarUrl
}) {
  const CARD_W = 860;
  const CARD_H = 430;

  // 1. Crear lienzo base
  let card;
  if (typeof Jimp.create === 'function') {
    card = await Jimp.create(CARD_W, CARD_H, 0x0f172aff);
  } else {
    try {
      card = new Jimp({ width: CARD_W, height: CARD_H, color: 0x0f172aff });
    } catch {
      card = new Jimp(CARD_W, CARD_H, 0x0f172aff);
    }
  }

  // 2. Fondo y paneles visuales
  // Borde exterior cian / neón
  drawBorder(card, 0, 0, CARD_W, CARD_H, 4, [6, 182, 212, 255]); // Cian #06b6d4
  // Línea superior decorativa violeta neón
  fillRect(card, 4, 4, CARD_W - 8, 6, [168, 85, 247, 255]); // Púrpura #a855f7

  // Panel izquierdo oscuro para el avatar (ancho 220px)
  fillRect(card, 25, 30, 200, 370, [30, 41, 59, 255]); // Slate-800
  drawBorder(card, 25, 30, 200, 370, 2, [51, 65, 85, 255]); // Slate-700

  // Panel derecho principal para estadísticas
  fillRect(card, 245, 30, 585, 370, [24, 32, 47, 255]);
  drawBorder(card, 245, 30, 585, 370, 2, [51, 65, 85, 255]);

  // Sub-paneles para estadísticas inferiores (Rank, Monedas, Victorias)
  const boxY = 245;
  const boxH = 135;
  const boxW = 175;

  // Caja 1: Rango y Nivel
  fillRect(card, 265, boxY, boxW, boxH, [15, 23, 42, 255]);
  drawBorder(card, 265, boxY, boxW, boxH, 2, [168, 85, 247, 200]); // Acento morado

  // Caja 2: Fortuna / Monedas
  fillRect(card, 450, boxY, boxW, boxH, [15, 23, 42, 255]);
  drawBorder(card, 450, boxY, boxW, boxH, 2, [234, 179, 8, 200]); // Acento dorado

  // Caja 3: Minijuegos V/D
  fillRect(card, 635, boxY, boxW, boxH, [15, 23, 42, 255]);
  drawBorder(card, 635, boxY, boxW, boxH, 2, [6, 182, 212, 200]); // Acento cian

  // 3. Procesar y estampar Avatar
  let avatarImg = null;
  try {
    if (avatarUrl) {
      const res = await axios.get(avatarUrl, { responseType: 'arraybuffer', timeout: 10000 });
      avatarImg = await Jimp.read(Buffer.from(res.data));
    }
  } catch {}

  const AVATAR_SIZE = 140;
  const AVATAR_X = 55;
  const AVATAR_Y = 55;

  if (avatarImg) {
    avatarImg.resize(AVATAR_SIZE, AVATAR_SIZE);
    circleMask(avatarImg);
    card.composite(avatarImg, AVATAR_X, AVATAR_Y);
  } else {
    // Si no hay foto, dibuja un placeholder geométrico futurista
    fillRect(card, AVATAR_X, AVATAR_Y, AVATAR_SIZE, AVATAR_SIZE, [71, 85, 105, 255]);
  }

  // Anillo brillante alrededor del avatar
  drawCircleBorder(card, AVATAR_X + AVATAR_SIZE / 2, AVATAR_Y + AVATAR_SIZE / 2, (AVATAR_SIZE / 2) + 4, 3, [6, 182, 212, 255]);

  // 4. Barra de Salud (HP) ❤️
  const hpBarX = 265;
  const hpBarY = 140;
  const barW = 545;
  const barH = 22;

  // Fondo de barra HP
  fillRect(card, hpBarX, hpBarY, barW, barH, [51, 65, 85, 255]);
  // Relleno de HP según el porcentaje
  const hpClamped = Math.max(0, Math.min(100, hp));
  const hpFillW = Math.floor((hpClamped / 100) * barW);
  const hpColor = hpClamped > 30 ? [34, 197, 94, 255] : [239, 68, 68, 255]; // Verde o Rojo
  if (hpFillW > 0) fillRect(card, hpBarX, hpBarY, hpFillW, barH, hpColor);
  drawBorder(card, hpBarX, hpBarY, barW, barH, 2, [30, 41, 59, 255]);

  // 5. Barra de Nivel / Experiencia (XP) ✨
  const xpBarY = 195;
  fillRect(card, hpBarX, xpBarY, barW, barH, [51, 65, 85, 255]);
  const xpClamped = Math.max(0, Math.min(100, xpProgress));
  const xpFillW = Math.floor((xpClamped / 100) * barW);
  if (xpFillW > 0) fillRect(card, hpBarX, xpBarY, xpFillW, barH, [168, 85, 247, 255]); // Púrpura
  drawBorder(card, hpBarX, xpBarY, barW, barH, 2, [30, 41, 59, 255]);

  // 6. Texto con fuentes bitmap de Jimp (si están disponibles)
  try {
    const font32 = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
    const font16 = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);

    if (font32 && font16) {
      // Nombre de usuario recortado si es muy largo
      const cleanName = name.length > 18 ? name.slice(0, 16) + '..' : name;
      card.print(font32, 265, 45, cleanName.toUpperCase());

      // Título debajo del nombre
      card.print(font16, 265, 90, `[ ${titleName.toUpperCase()} ]`);

      // Etiquetas de barras
      card.print(font16, 265, 120, `SALUD: ${hpClamped}/100 HP`);
      card.print(font16, 265, 175, `NIVEL ${level} — PROGRESO: ${xpClamped}%`);

      // Contenido de las 3 cajas de estadísticas
      // Caja 1: Rango
      card.print(font16, 280, boxY + 20, 'CLASIFICACION');
      card.print(font32, 280, boxY + 55, `#${rank}`);
      card.print(font16, 280, boxY + 95, `LVL: ${level}`);

      // Caja 2: Monedas
      card.print(font16, 465, boxY + 20, 'FORTUNA');
      const coinStr = totalCoins > 999999 ? `${(totalCoins / 1000000).toFixed(1)}M` : totalCoins > 999 ? `${(totalCoins / 1000).toFixed(1)}K` : `${totalCoins}`;
      card.print(font32, 465, boxY + 55, `$${coinStr}`);
      card.print(font16, 465, boxY + 95, 'TOTAL');

      // Caja 3: Minijuegos
      card.print(font16, 650, boxY + 20, 'MINIJUEGOS');
      card.print(font32, 650, boxY + 55, `${gameWins}W`);
      card.print(font16, 650, boxY + 95, `DERROTAS: ${gameLosses}`);

      // Etiqueta lateral bajo el avatar
      card.print(font16, 40, 240, 'ESTADO: ONLINE');
      card.print(font16, 40, 270, `RANGO: #${rank}`);
    }
  } catch (err) {
    // Si la carga de fuentes bitmap de Jimp falla, la tarjeta gráfica base sigue siendo válida
  }

  // 7. Retornar Buffer PNG
  if (typeof card.getBufferAsync === 'function') {
    return await card.getBufferAsync(Jimp.MIME_PNG);
  } else if (typeof card.getBuffer === 'function') {
    return await card.getBuffer('image/png');
  }
  throw new Error('No se pudo generar el buffer de imagen con Jimp');
}

// ── COMANDO PRINCIPAL ──

export default {
  command: ['card', 'tarjeta', 'playercard', 'gamercard', 'perfilcard'],
  category: 'profile',
  desc: 'Genera una tarjeta gamer visual de tu perfil con estadísticas RPG.',
  usage: '.card [@usuario]',
  run: async (client, m, args, usedPrefix) => {
    const texto = m.mentionedJid;
    const who2 = texto.length > 0 ? texto[0] : m.quoted ? m.quoted.sender : m.sender;
    const userId = await resolveLidToRealJid(who2, client, m.chat);
    const globalUsers = global.db.data?.users || {};
    const currency = getBotCurrency(client);
    const user = globalUsers[userId];

    if (!user) {
      return m.reply('> ❌ *El usuario no está registrado en el bot.*');
    }

    await m.react('🕒');

    const name = user.name || userId.split('@')[0];
    const exp = user.exp || 0;
    const level = user.level || 0;
    const coins = user.coins || 0;
    const bank = user.bank || 0;
    const totalCoins = coins + bank;
    const hp = user.health ?? 100;
    const gameWins = user.gameWins || 0;
    const gameLosses = user.gameLosses || 0;

    // Calcular Rango en Leaderboard
    const users = Object.entries(globalUsers).map(([key, value]) => ({ ...value, jid: key }));
    const sortedLevel = users.sort((a, b) => (b.level || 0) - (a.level || 0));
    const rank = sortedLevel.findIndex((u) => u.jid === userId) + 1;

    // Calcular progreso de nivel
    const { min, xp } = xpRange(level, global.multiplier);
    const progreso = exp - min;
    const xpProgress = xp > 0 ? Math.max(0, Math.floor((progreso / xp) * 100)) : 0;

    // Título equipado
    const rawTitle = user.title ? (TITLE_NAMES[user.title] || user.title) : 'Aventurero';
    const titleName = rawTitle.replace(/[^\w\sÁÉÍÓÚáéíóúñÑ]/gi, '').trim() || 'Aventurero';

    // Obtener foto de perfil
    const avatarUrl = await client.profilePictureUrl(userId, 'image').catch(() => null);

    // Texto de respaldo y resumen de la tarjeta
    const captionText =
      `🎮 *TARJETA DE JUGADOR — GAMER PASS*\n` +
      `────────────────────────────\n` +
      `👤 *Jugador:* @${userId.split('@')[0]}\n` +
      `🎖️ *Título:* ${rawTitle}\n` +
      `📊 *Nivel:* ${level} ➔ *Clasificación:* #${rank}\n` +
      `❤️ *Salud:* ${hp}/100 HP\n` +
      `✨ *Experiencia:* ${exp.toLocaleString()} XP (${xpProgress}%)\n` +
      `💰 *Fondos:* $${totalCoins.toLocaleString()} ${currency}\n` +
      `🕹️ *Récord V/D:* ${gameWins} Victorias / ${gameLosses} Derrotas\n` +
      `────────────────────────────\n` +
      `> 💡 *Generado con el sistema RPG de YukiBot*`;

    try {
      // Generar imagen con Jimp
      const cardBuffer = await createPlayerCardImage({
        name,
        level,
        rank,
        hp,
        xpProgress,
        totalCoins,
        gameWins,
        gameLosses,
        titleName,
        avatarUrl
      });

      await client.sendMessage(
        m.chat,
        {
          image: cardBuffer,
          caption: captionText,
          mentions: [userId]
        },
        { quoted: m }
      );

      await m.react('✔️');
    } catch (err) {
      console.error('[PlayerCard] Error al renderizar tarjeta con Jimp:', err);
      // Fallback elegante: si falla la generación gráfica local, enviar con la foto de perfil
      await client.sendMessage(
        m.chat,
        {
          image: avatarUrl ? { url: avatarUrl } : undefined,
          text: avatarUrl ? undefined : captionText,
          caption: avatarUrl ? captionText : undefined,
          mentions: [userId]
        },
        { quoted: m }
      );
      await m.react('✔️');
    }
  }
};
