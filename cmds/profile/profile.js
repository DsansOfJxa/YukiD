import moment from 'moment-timezone';
import { resolveLidToRealJid } from "../../core/utils.js";
import { xpRange, getBotCurrency } from '../../utils/tools.js';
import { TITLE_NAMES } from '../economia/rpg_shop.js';

export default {
  command: ['profile', 'perfil'],
  category: 'profile',
  desc: 'Muestra tu perfil completo con estadísticas, pareja real y anime.',
  run: async (client, m, args, usedPrefix, command) => {
    const texto = m.mentionedJid;
    const who2 = texto.length > 0 ? texto[0] : m.quoted ? m.quoted.sender : m.sender;
    const userId = await resolveLidToRealJid(who2, client, m.chat);
    const globalUsers = global.db.data?.users || {};
    const currency = getBotCurrency(client);
    const user2 = globalUsers[userId];
    if (!user2) return m.reply('El usuario *mencionado* no está *registrado* en el bot.');

    const name = user2.name || userId.split('@')[0];
    const birth = user2.birth || 'Sin especificar';
    const genero = user2.genre || 'Oculto';
    const comandos = user2.usedcommands || 0;
    const pasatiempo = user2.pasatiempo || 'No definido';
    const exp = user2.exp || 0;
    const nivel = user2.level || 0;
    const coins = user2.coins || 0;
    const banco = user2.bank || 0;
    const totalCoins = coins + banco;
    const health = user2.health ?? 100;

    // Pareja Real y Anime
    const mentions = [userId];
    let realSpouseText = 'Soltero/a';
    if (user2.marry) {
      if (user2.marry.includes('@')) {
        const spouseObj = globalUsers[user2.marry];
        const sName = spouseObj?.name || `@${user2.marry.split('@')[0]}`;
        realSpouseText = sName;
        mentions.push(user2.marry);
      } else {
        realSpouseText = user2.marry;
      }
    }

    let animeSpouseText = 'Ninguno/a';
    if (user2.marryAnime) {
      animeSpouseText = `${user2.marryAnime.name}${user2.marryAnime.anime ? ` (${user2.marryAnime.anime})` : ''}`;
    }

    const perfil = await client.profilePictureUrl(userId, 'image').catch(() => 'https://cdn.yuki-wabot.my.id/files/2PVh.jpeg');
    const users = Object.entries(globalUsers).map(([key, value]) => ({ ...value, jid: key }));
    const sortedLevel = users.sort((a, b) => (b.level || 0) - (a.level || 0));

    try {
      const rank = sortedLevel.findIndex((u) => u.jid === userId) + 1;
      const { min, xp } = xpRange(nivel, global.multiplier);
      const progreso = exp - min;
      const porcentaje = xp > 0 ? Math.max(0, Math.floor((progreso / xp) * 100)) : 0;
      const gameWins = user2.gameWins || 0;
      const gameLosses = user2.gameLosses || 0;
      const achievementCount = (user2.achievements || []).length;

      // Buffs Activos basados en el título
      let activeBuff = "Ninguno";
      if (user2.title === 'title_legend') activeBuff = "+15% Monedas en Trabajo";
      else if (user2.title === 'title_shadow') activeBuff = "Inmunidad al Robo";
      else if (user2.title === 'title_star') activeBuff = "+15% XP en Juegos";
      else if (user2.title === 'title_neko') activeBuff = "+10 Salud al Pescar";
      else if (user2.title === 'title_fire') activeBuff = "+20% Monedas en Mazmorra";
      else if (user2.title === 'title_lucky') activeBuff = "+15% Éxito en Crimen";
      else if (user2.title === 'title_fisher') activeBuff = "+20% Monedas en Pesca";
      else if (user2.title === 'title_miner') activeBuff = "+20% Monedas en Minería";
      else if (user2.title === 'title_tycoon') activeBuff = "+20% Monedas en Cobros";

      const profileText = `✦ ───「 *TU PERFIL* 」─── ✦
👤 *Nombre:* ${name}
🎂 *Cumple:* ${birth}
🎭 *Hobbie:* ${pasatiempo}
💍 *Pareja Real:* ${realSpouseText}
🌸 *Waifu / Husbando:* ${animeSpouseText}

✦ ───「 *ESTADÍSTICAS* 」─── ✦
📊 *Nivel:* ${nivel} | *Rank:* #${rank}
✨ *XP:* ${exp.toLocaleString()} (${porcentaje}%)
❤️ *Salud:* ${health} / 100
💰 *Monedas:* ¥${totalCoins.toLocaleString()} ${currency}
🕹️ *Juegos (V/D):* ${gameWins} / ${gameLosses}
🏆 *Logros:* ${achievementCount}
⚙️ *Cmds:* ${comandos.toLocaleString()}

✦ ───「 *HABILIDADES* 」─── ✦
🎖️ *Título:* ${user2.title ? (TITLE_NAMES[user2.title] || user2.title) : 'Ninguno'}
🪄 *Buff:* ${activeBuff}

> 💡 *Usa* \`${usedPrefix}card\` *para generar tu tarjeta de jugador gráfica.*`;

      await client.sendMessage(
        m.chat,
        { image: { url: perfil }, caption: profileText, mentions },
        { quoted: m }
      );
    } catch (e) {
      return m.reply(`> Error al ejecutar el comando.\n[Error: *${e.message}*]`);
    }
  }
};
