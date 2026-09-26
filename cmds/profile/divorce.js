async function fetchCryingGif() {
  try {
    const res = await fetch('https://nekos.best/api/v2/cry', {
      headers: { 'User-Agent': 'WhatsAppBot/2.0' },
      signal: AbortSignal.timeout(3500),
    });
    if (res.ok) {
      const data = await res.json();
      return data.results?.[0]?.url || null;
    }
  } catch {}
  return null;
}

export default {
  command: ['divorce', 'divorcio', 'divorciarse', 'separarse'],
  category: 'profile',
  desc: 'Divórciate de tu pareja real o de tu personaje de anime.',
  usage: '[real / anime]',
  cooldown: 5,
  run: async (client, m, args, usedPrefix, command) => {
    const db = global.db.data;
    const userId = m.sender;
    const user = db.users[userId];
    if (!user) return m.reply('❌ No estás registrado en la base de datos.');

    const realPartnerId = user.marry;
    const animePartner = user.marryAnime;

    if (!realPartnerId && !animePartner) {
      return m.reply('💔 No estás casado/a con nadie actualmente.');
    }

    const lowerArg = (args[0] || '').toLowerCase();
    const hasBoth = Boolean(realPartnerId && animePartner);

    // Si tiene ambos y no especificó, solicitar aclaración
    if (hasBoth && !['real', 'anime', 'waifu', 'husbando'].includes(lowerArg)) {
      const realPartnerName = realPartnerId.includes('@')
        ? (db.users[realPartnerId]?.name || `@${realPartnerId.split('@')[0]}`)
        : realPartnerId;
      const animeName = animePartner.name;

      return client.sendMessage(
        m.chat,
        {
          text:
            `💔 *Tienes dos matrimonios activos:*\n\n` +
            `1. 💍 *Pareja Real:* ${realPartnerName}\n` +
            `2. 🌸 *Anime:* *${animeName}*\n\n` +
            `Elige cuál divorcio deseas llevar a cabo:\n` +
            `• Para tu pareja real: \`${usedPrefix + command} real\`\n` +
            `• Para tu waifu/husbando: \`${usedPrefix + command} anime\``,
          mentions: realPartnerId.includes('@') ? [userId, realPartnerId] : [userId],
        },
        { quoted: m }
      );
    }

    let isAnimeDivorce = false;
    if (lowerArg === 'anime' || lowerArg === 'waifu' || lowerArg === 'husbando') {
      if (!animePartner) {
        return m.reply('❌ No estás casado/a con ningún personaje de anime.');
      }
      isAnimeDivorce = true;
    } else if (lowerArg === 'real') {
      if (!realPartnerId) {
        return m.reply('❌ No estás casado/a con ningún usuario real.');
      }
      isAnimeDivorce = false;
    } else {
      // No especificó pero solo tiene uno de los dos
      isAnimeDivorce = Boolean(animePartner && !realPartnerId);
    }

    await m.react('💔');
    const sadGif = await fetchCryingGif();

    if (isAnimeDivorce) {
      const charName = animePartner.name;
      user.marryAnime = null;
      global.saveDatabaseAsync?.();

      const text =
        `💔 *DIVORCIO EN EL MULTIVERSO ANIME* 💔\n\n` +
        `@${userId.split('@')[0]} ha decidido divorciarse de su waifu/husbando *${charName}*.\n` +
        `El pacto de las dos dimensiones ha concluido... 🥀`;

      if (sadGif) {
        return client.sendMessage(
          m.chat,
          {
            image: { url: sadGif },
            caption: text,
            mentions: [userId],
          },
          { quoted: m }
        );
      }
      return client.sendMessage(m.chat, { text, mentions: [userId] }, { quoted: m });
    } else {
      const partnerId = realPartnerId;
      user.marry = '';

      // Si la pareja real está registrada, remover también su vínculo
      if (partnerId.includes('@') && db.users[partnerId]) {
        db.users[partnerId].marry = '';
      }
      global.saveDatabaseAsync?.();

      const partnerName = partnerId.includes('@')
        ? (db.users[partnerId]?.name || `@${partnerId.split('@')[0]}`)
        : partnerId;
      const mentions = partnerId.includes('@') ? [userId, partnerId] : [userId];

      const text =
        `💔 *ACTA DE DIVORCIO* 💔\n\n` +
        `@${userId.split('@')[0]} y ${partnerName} han decidido poner fin a su matrimonio.\n` +
        `Ambos vuelven a estar formalmente solteros. ¡Que encuentren la felicidad por caminos separados! 🥀🌧️`;

      if (sadGif) {
        return client.sendMessage(
          m.chat,
          {
            image: { url: sadGif },
            caption: text,
            mentions,
          },
          { quoted: m }
        );
      }
      return client.sendMessage(m.chat, { text, mentions }, { quoted: m });
    }
  },
};