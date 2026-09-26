import { resolveLidToRealJid } from "../../core/utils.js";

const proposals = new Map();

async function fetchAnimeWeddingGif() {
  try {
    const res = await fetch('https://nekos.best/api/v2/kiss', {
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

async function searchAnimeCharacter(query) {
  // 1. Kitsu API (ultra rápida y estable)
  try {
    const res = await fetch(`https://kitsu.io/api/edge/characters?filter[name]=${encodeURIComponent(query)}&page[limit]=1`, {
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const json = await res.json();
      const item = json.data?.[0];
      if (item && item.attributes) {
        const attr = item.attributes;
        const name = attr.canonicalName || attr.name || query;
        const image = attr.image?.original || attr.image?.large || attr.image?.medium || null;
        let about = attr.description
          ? attr.description.replace(/<[^>]*>/g, '').replace(/\r\n/g, ' ').substring(0, 180).trim() + '...'
          : '';
        return { name, anime: '', image, about };
      }
    }
  } catch {}

  // 2. Jikan API (MyAnimeList)
  try {
    const res = await fetch(
      `https://api.jikan.moe/v4/characters?q=${encodeURIComponent(query)}&limit=1`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (res.ok) {
      const json = await res.json();
      const result = json.data && json.data[0];
      if (result) {
        const name = result.name;
        const image = result.images?.jpg?.image_url || result.images?.webp?.image_url || null;
        const anime = result.anime?.[0]?.anime?.title || result.manga?.[0]?.manga?.title || '';
        let about = result.about ? result.about.replace(/\r\n/g, ' ').substring(0, 180).trim() + '...' : '';
        return { name, anime, image, about };
      }
    }
  } catch {}

  // 3. Fallback a nekos.best waifu
  try {
    const res = await fetch('https://nekos.best/api/v2/waifu', {
      headers: { 'User-Agent': 'WhatsAppBot/2.0' },
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        name: query,
        anime: '',
        image: data.results?.[0]?.url || null,
        about: 'Compañero/a del multiverso anime.',
      };
    }
  } catch {}

  return { name: query, anime: '', image: null, about: '' };
}

export default {
  command: ['marry', 'casarse', 'proponer'],
  category: 'profile',
  desc: 'Cásate con un usuario real del grupo o con tu personaje de anime favorito (soporta ambos simultáneamente).',
  usage: '[@usuario / responder / nombre de personaje]',
  cooldown: 4,
  run: async (client, m, args, usedPrefix, command) => {
    const db = global.db.data;
    const chatId = m.chat;
    const proposer = m.sender;

    if (!db.users[proposer]) db.users[proposer] = {};
    const proposerUser = db.users[proposer];
    const proposerName = proposerUser.name || proposer.split('@')[0];

    const mentioned = m.mentionedJid || [];
    let targetJid = mentioned.length > 0 ? mentioned[0] : (m.quoted ? m.quoted.sender : null);

    // ── MODO 1: MATRIMONIO CON PERSONAJE ANIME ──
    // Se activa cuando NO hay mención ni mensaje citado, pero sí texto
    if (!targetJid && args.length > 0) {
      const personajeQuery = args.join(' ').trim();

      if (proposerUser.marryAnime) {
        return m.reply(
          `🌸 Ya estás casado/a con el personaje anime *${proposerUser.marryAnime.name}*.\n` +
          `Si deseas casarte con otra waifu/husbando, primero usa \`${usedPrefix}divorce anime\`.`
        );
      }

      await m.react('💖');
      await m.reply(`🔍 Buscando a *${personajeQuery}* en la base de datos de anime... 🌸`);

      const charData = await searchAnimeCharacter(personajeQuery);
      const finalName = charData.name;
      const animeTitle = charData.anime;
      const imageUrl = charData.image;
      const aboutText = charData.about;

      // Guardar el personaje en marryAnime
      proposerUser.marryAnime = {
        name: finalName,
        anime: animeTitle,
        image: imageUrl,
        about: aboutText,
        marriedAt: Date.now(),
      };
      global.saveDatabaseAsync?.();

      const caption =
        `💍 *¡BODA EN EL MULTIVERSO ANIME!* 💍\n\n` +
        `@${proposer.split('@')[0]} se ha unido en sagrado matrimonio con:\n\n` +
        `✨ *${finalName}* ✨\n` +
        (animeTitle ? `📺 _Anime: ${animeTitle}_\n` : '') +
        (aboutText ? `📖 _${aboutText}_\n` : '') +
        `\n¡Que su amor trascienda las dos dimensiones! 💕🌹`;

      await m.react('💍');
      if (imageUrl) {
        return client.sendMessage(
          chatId,
          { image: { url: imageUrl }, caption, mentions: [proposer] },
          { quoted: m }
        );
      } else {
        return client.sendMessage(
          chatId,
          { text: caption, mentions: [proposer] },
          { quoted: m }
        );
      }
    }

    // ── MODO 2: MATRIMONIO CON USUARIO REAL DE WHATSAPP ──
    if (!targetJid) {
      return m.reply(
        `💍 *¿Cómo casarse?*\n\n` +
        `• Con un usuario real: \`${usedPrefix}marry @usuario\` (o responde a su mensaje)\n` +
        `• Con un personaje anime: \`${usedPrefix}marry <nombre>\` (ejemplo: \`${usedPrefix}marry Rem\` o \`${usedPrefix}marry Gojo\`)`
      );
    }

    const proposee = await resolveLidToRealJid(targetJid, client, m.chat);
    if (!proposee) return m.reply('❌ No se pudo resolver al usuario.');

    if (proposer === proposee) {
      return m.reply('❌ No puedes proponerte matrimonio a ti mismo.');
    }

    if (!db.users[proposee]) db.users[proposee] = {};
    const proposeeUser = db.users[proposee];
    const proposeeName = proposeeUser.name || proposee.split('@')[0];

    // Verificar si alguno ya está casado con una persona real
    if (proposerUser.marry) {
      const currentSpouseName = db.users[proposerUser.marry]?.name || proposerUser.marry.split('@')[0];
      return client.sendMessage(
        chatId,
        {
          text: `⚠️ Ya estás casado/a con @${proposerUser.marry.split('@')[0]} (${currentSpouseName}).\nPara casarte con otra persona, debes divorciarte primero con \`${usedPrefix}divorce real\`.`,
          mentions: [proposerUser.marry],
        },
        { quoted: m }
      );
    }

    if (proposeeUser.marry) {
      const spouseName = db.users[proposeeUser.marry]?.name || proposeeUser.marry.split('@')[0];
      return client.sendMessage(
        chatId,
        {
          text: `⚠️ @${proposee.split('@')[0]} ya está casado/a con @${proposeeUser.marry.split('@')[0]} (${spouseName}).`,
          mentions: [proposee, proposeeUser.marry],
        },
        { quoted: m }
      );
    }

    // Si ya existía una propuesta mutua previa de proposee hacia proposer -> ¡BODA!
    if (proposals.get(proposee) === proposer) {
      proposals.delete(proposee);
      proposals.delete(proposer);

      proposerUser.marry = proposee;
      proposeeUser.marry = proposer;

      // Bono de bodas: +500 XP a cada uno
      proposerUser.exp = (proposerUser.exp || 0) + 500;
      proposeeUser.exp = (proposeeUser.exp || 0) + 500;
      global.saveDatabaseAsync?.();

      await m.react('💒');

      const weddingText =
        `👰🤵 *¡VIVAN LOS NOVIOS!* 💍🎉\n\n` +
        `¡@${proposer.split('@')[0]} y @${proposee.split('@')[0]} han aceptado su unión y ahora están formalmente casados!\n\n` +
        `🎁 *Bono de matrimonio:* +500 XP para cada uno.\n` +
        `💖 ¡Que disfruten de una larga y hermosa relación!`;

      const weddingGif = await fetchAnimeWeddingGif();
      if (weddingGif) {
        return client.sendMessage(
          chatId,
          {
            video: { url: weddingGif },
            gifPlayback: true,
            caption: weddingText,
            mentions: [proposer, proposee],
            mimetype: 'video/mp4',
          },
          { quoted: m }
        );
      } else {
        return client.sendMessage(
          chatId,
          { text: weddingText, mentions: [proposer, proposee] },
          { quoted: m }
        );
      }
    }

    // Registrar propuesta de proposer hacia proposee (válida por 2 minutos)
    proposals.set(proposer, proposee);
    setTimeout(() => {
      if (proposals.get(proposer) === proposee) {
        proposals.delete(proposer);
      }
    }, 120000);

    await m.react('💌');
    const proposalMsg =
      `💍 *¡PROPUESTA DE MATRIMONIO!* 💍\n\n` +
      `@${proposee.split('@')[0]}, el usuario @${proposer.split('@')[0]} te ha pedido la mano.\n\n` +
      `⚘ *Para aceptar, responde escribiendo:*\n` +
      `👉 \`${usedPrefix}marry @${proposer.split('@')[0]}\`\n\n` +
      `⏳ Tienes *2 minutos* para responder antes de que la propuesta expire.`;

    return client.sendMessage(
      chatId,
      { text: proposalMsg, mentions: [proposer, proposee] },
      { quoted: m }
    );
  },
};