import config from '../../config.js';

/**
 * Obtiene un video/GIF animado optimizado para parejas
 * Estrategia de 3 niveles: Giphy (MP4) -> Stellar (MP4 Anime) -> nekos.best (GIF Anime)
 */
async function fetchCoupleMedia(query, category) {
  // 1. Giphy API (MP4 animado)
  try {
    const giphyKey = config.giphyApiKey;
    if (giphyKey) {
      const res = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${giphyKey}&q=${encodeURIComponent(query)}&limit=10&rating=g&lang=es`,
        { signal: AbortSignal.timeout(3500) }
      );
      if (res.ok) {
        const json = await res.json();
        const results = json.data;
        if (results && results.length > 0) {
          const item = results[Math.floor(Math.random() * results.length)];
          const mp4 =
            item?.images?.original?.mp4 ||
            item?.images?.downsized_small?.mp4 ||
            item?.images?.fixed_height?.mp4;
          if (mp4) return { url: mp4, isMp4: true };
        }
      }
    }
  } catch {}

  // 2. Stellar API (Anime MP4 directo)
  try {
    const api = config.APIs?.stellar;
    if (api && api.url) {
      const res = await fetch(
        `${api.url}/sfw/interaction?inter=${encodeURIComponent(category)}&key=${encodeURIComponent(api.key || '')}`,
        { signal: AbortSignal.timeout(3500) }
      );
      if (res.ok) {
        const json = await res.json();
        const url = json.result || json.url || json.data;
        if (url) return { url, isMp4: url.endsWith('.mp4') };
      }
    }
  } catch {}

  // 3. nekos.best API (Anime GIF de alta calidad)
  try {
    const res = await fetch(`https://nekos.best/api/v2/${encodeURIComponent(category)}`, {
      headers: { 'User-Agent': 'WhatsAppBot/2.0' },
      signal: AbortSignal.timeout(3500),
    });
    if (res.ok) {
      const json = await res.json();
      const url = json.results?.[0]?.url;
      if (url) return { url, isMp4: url.endsWith('.mp4') };
    }
  } catch {}

  return null;
}

export default {
  command: [
    'cita', 'date', 'mimos', 'celos', 'pelearpareja',
    'regalo', 'desayuno', 'haceramor', 'abrazarpareja', 'besarpareja'
  ],
  category: 'profile',
  desc: 'Interacciones románticas y divertidas exclusivas para parejas (reales o anime).',
  cooldown: 5,
  run: async (client, m, args, usedPrefix, command) => {
    const db = global.db.data;
    const user = db.users[m.sender];
    if (!user) return m.reply('❌ No estás registrado en la base de datos.');

    const realSpouseId = user.marry;
    const animeSpouse = user.marryAnime;

    if (!realSpouseId && !animeSpouse) {
      return m.reply(
        `❌ No tienes ninguna pareja registrada actualmente.\n\n` +
        `• Cásate con un usuario real: \`${usedPrefix}marry @usuario\`\n` +
        `• Cásate con una waifu/husbando anime: \`${usedPrefix}marry <nombre>\` (ej: \`${usedPrefix}marry Rem\`)`
      );
    }

    // Identificar si la interacción se dirige al personaje anime o a la persona real
    const lowerArgs = args.map(a => a.toLowerCase());
    const wantsAnime =
      lowerArgs.some(a => ['anime', 'waifu', 'husbando', 'personaje', '2d'].includes(a)) ||
      (Boolean(animeSpouse) && !realSpouseId) ||
      (Boolean(animeSpouse) && args.length > 0 && args.join(' ').toLowerCase().includes(animeSpouse.name.toLowerCase()));

    let isAnime = false;
    let spouseName = '';
    let mentions = [m.sender];

    if (wantsAnime && animeSpouse) {
      isAnime = true;
      spouseName = animeSpouse.name + (animeSpouse.anime ? ` (${animeSpouse.anime})` : '');
    } else if (realSpouseId) {
      isAnime = false;
      const isRealUser = realSpouseId.includes('@');
      spouseName = isRealUser ? (db.users[realSpouseId]?.name || `@${realSpouseId.split('@')[0]}`) : realSpouseId;
      if (isRealUser) mentions.push(realSpouseId);
    } else {
      isAnime = true;
      spouseName = animeSpouse.name;
    }

    const fromName = user.name || `@${m.sender.split('@')[0]}`;
    const hasBoth = Boolean(realSpouseId && animeSpouse);
    const footerTip = hasBoth
      ? `\n\n> 💡 _Tip: Tienes matrimonio Real y Anime. Usa \`${usedPrefix + command} ${isAnime ? 'real' : 'anime'}\` para alternar._`
      : '';

    let caption = '';
    let giphyQuery = '';
    let animeCategory = 'kiss';

    if (['cita', 'date'].includes(command)) {
      const lastDate = user.lastDate || 0;
      const now = Date.now();
      if (now - lastDate < 3600000) {
        const timeLeft = Math.ceil((3600000 - (now - lastDate)) / 60000);
        return m.reply(`⏳ Debes esperar *${timeLeft} minutos* antes de tener otra cita con tu pareja.`);
      }

      const escenarios = [
        'fueron a cenar a la luz de las velas en un restaurante elegante 🕯️🍷',
        'caminaron por la orilla de la playa durante un hermoso atardecer 🏖️🌅',
        'vieron una película acurrucados bajo una manta caliente 🍿🛋️',
        'tuvieron un picnic romántico bajo un cielo estrellado 🌌🧺',
        'fueron al festival de fuegos artificiales tomados de la mano 🎆👘',
        'visitaron una hermosa cafetería temática juntos ☕🍰'
      ];
      const randomScenario = escenarios[Math.floor(Math.random() * escenarios.length)];
      const gainedXp = Math.floor(Math.random() * 400) + 250;

      user.exp = (user.exp || 0) + gainedXp;
      user.lastDate = now;

      if (!isAnime && realSpouseId.includes('@') && db.users[realSpouseId]) {
        db.users[realSpouseId].exp = (db.users[realSpouseId].exp || 0) + gainedXp;
      }
      global.saveDatabaseAsync?.();

      caption = `💖 *¡CITA ROMÁNTICA!* 💖\n\n` +
        `*${fromName}* y *${spouseName}* ${randomScenario}.\n\n` +
        `🎁 *Recompensa:* +${gainedXp} XP ganados por disfrutar su amor juntos.`;
      giphyQuery = 'anime couple date';
      animeCategory = 'happy';
    } else if (command === 'mimos') {
      caption = `🥰 *${fromName}* está llenando de mimos, caricias y abrazos a *${spouseName}*. ¡Qué viva el amor! 💕`;
      giphyQuery = 'anime headpat sweet';
      animeCategory = 'pat';
    } else if (command === 'celos') {
      caption = `😤 *${fromName}* se ha puesto de mal humor y con celos de *${spouseName}*... ¡Alguien necesita atención inmediata! 🚩❤️`;
      giphyQuery = 'anime jealous pout';
      animeCategory = 'slap';
    } else if (command === 'pelearpareja') {
      caption = `🥊 *${fromName}* y *${spouseName}* están teniendo una divertida pelea de casados... ¡Seguro se reconcilian a besos! 😠❤️`;
      giphyQuery = 'anime couple fight funny';
      animeCategory = 'slap';
    } else if (command === 'regalo') {
      const regalos = [
        'un hermoso ramo de rosas rojas 🌹',
        'un deslumbrante collar brillante 💎',
        'una deliciosa caja de chocolates artesanales 🍫',
        'un peluche suave y gigante 🧸',
        'una carta de amor perfumada escrita a mano 💌'
      ];
      const regalo = regalos[Math.floor(Math.random() * regalos.length)];
      caption = `🎁 *${fromName}* sorprendió a *${spouseName}* con un lindo detalle: ¡le obsequió ${regalo}! ✨`;
      giphyQuery = 'anime giving gift blush';
      animeCategory = 'blush';
    } else if (command === 'desayuno') {
      caption = `🍳 *${fromName}* le preparó un delicioso desayuno sorpresa en la cama a *${spouseName}*. ¡Qué consentid@! ☕🥞🍓`;
      giphyQuery = 'anime cooking eating happy';
      animeCategory = 'nom';
    } else if (command === 'haceramor') {
      caption = `🔥 *${fromName}* y *${spouseName}* están compartiendo un momento íntimo, apasionado y lleno de devoción mutua... 🌹🕯️`;
      giphyQuery = 'anime passionate kiss hug';
      animeCategory = 'kiss';
    } else if (command === 'abrazarpareja') {
      caption = `🫂 *${fromName}* envuelve en un abrazo cálido y protector a *${spouseName}*. Sienten que el mundo se detiene... 💕`;
      giphyQuery = 'anime sweet hug';
      animeCategory = 'hug';
    } else if (command === 'besarpareja') {
      caption = `💋 Un tierno y apasionado beso entre *${fromName}* y *${spouseName}*. Sus corazones laten al mismo compás... ❤️`;
      giphyQuery = 'anime romantic kiss';
      animeCategory = 'kiss';
    }

    const fullCaption = caption + footerTip;

    // Obtener multimedia (GIF / MP4)
    const media = await fetchCoupleMedia(giphyQuery, animeCategory);

    if (media && media.url) {
      try {
        if (media.isMp4) {
          return await client.sendMessage(
            m.chat,
            {
              video: { url: media.url },
              gifPlayback: true,
              caption: fullCaption,
              mentions,
              mimetype: 'video/mp4'
            },
            { quoted: m }
          );
        } else {
          return await client.sendMessage(
            m.chat,
            {
              image: { url: media.url },
              caption: fullCaption,
              mentions
            },
            { quoted: m }
          );
        }
      } catch (sendErr) {
        console.error('[Couple Interaction Send Media Error]:', sendErr.message);
      }
    }

    // Si falló el media pero es pareja anime y tiene foto guardada
    if (isAnime && animeSpouse?.image) {
      try {
        return await client.sendMessage(
          m.chat,
          {
            image: { url: animeSpouse.image },
            caption: fullCaption,
            mentions
          },
          { quoted: m }
        );
      } catch {}
    }

    // Fallback a solo texto estilizado
    return client.sendMessage(m.chat, { text: fullCaption, mentions }, { quoted: m });
  }
};
