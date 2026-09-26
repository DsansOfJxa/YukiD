const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
const isEmoji = (str) => /\p{Extended_Pictographic}/u.test(str);

// Extraer dos emojis soportando formatos: "👻+👀", "👻 👀", "👻👀" o con separadores
function extractTwoEmojis(input) {
  if (!input) return null;

  // 1. Si incluye el símbolo '+'
  if (input.includes('+')) {
    const parts = input.split('+').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) return [parts[0], parts[1]];
  }

  // 2. Extraer grafemas Unicode completos (soporta modificadores y selectores de variación)
  const graphemes = [...segmenter.segment(input)].map(s => s.segment).filter(isEmoji);
  if (graphemes.length >= 2) {
    return [graphemes[0], graphemes[1]];
  }

  // 3. Fallback: separación por espacios
  const words = input.trim().split(/\s+/);
  if (words.length >= 2) {
    return [words[0], words[1]];
  }

  return null;
}

// Obtener buffer de imagen combinada con fallback inverso (e1_e2 y e2_e1)
async function fetchEmojiMixBuffer(e1, e2) {
  const attempts = [
    `https://emojik.vercel.app/s/${encodeURIComponent(e1)}_${encodeURIComponent(e2)}?size=512`,
    `https://emojik.vercel.app/s/${encodeURIComponent(e2)}_${encodeURIComponent(e1)}?size=512`,
  ];

  for (const url of attempts) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WhatsAppBot/2.0)' },
        signal: AbortSignal.timeout(5000)
      });
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        if (arrayBuf && arrayBuf.byteLength > 500) {
          return Buffer.from(arrayBuf);
        }
      }
    } catch {}
  }

  return null;
}

export default {
  command: ['emojimix', 'mixemoji', 'emojikitchen'],
  category: 'stickers',
  desc: 'Fusiona dos emojis en un único sticker (Emoji Kitchen).',
  usage: '.emojimix 👻+👀  (o .emojimix 👻 👀 o .emojimix 👻👀)',
  cooldown: 4,
  run: async (client, m, args, usedPrefix, command, text) => {
    try {
      const emojis = extractTwoEmojis(text || args.join(' '));
      if (!emojis) {
        return m.reply(
          `🎨 *Ingresa 2 emojis para fusionar.*\n\n` +
          `• Con signo más: \`${usedPrefix + command} 👻+👀\`\n` +
          `• Con espacio: \`${usedPrefix + command} 👻 👀\`\n` +
          `• Juntos: \`${usedPrefix + command} 👻👀\``
        );
      }

      const [emoji1, emoji2] = emojis;
      await m.react('🕒');

      const buffer = await fetchEmojiMixBuffer(emoji1, emoji2);
      if (!buffer) {
        await m.react('✖️');
        return m.reply(`❌ No existe una combinación oficial de Emoji Kitchen para *${emoji1}* y *${emoji2}*. Prueba con otros emojis.`);
      }

      // Configuración de metadatos con prioridad a pushName
      const db = global.db.data;
      const user = db.users[m.sender] || {};
      const meta1 = user.metadatos ? String(user.metadatos).trim() : '';
      const meta2 = user.metadatos2 ? String(user.metadatos2).trim() : '';

      const pushName = (m.pushName && m.pushName.trim()) || user.name || m.sender.split('@')[0];
      const authorDisplay = pushName.startsWith('@') ? pushName : `@${pushName}`;

      const packname = meta1 || 'YukiBot Stickers';
      const author = meta1 ? (meta2 || '') : authorDisplay;

      // Envío en memoria sin tocar el disco
      await client.sendImageAsSticker(m.chat, buffer, m, { packname, author });
      await m.react('✔️');
    } catch (e) {
      await m.react('✖️');
      return m.reply(`> ❌ Error al generar el EmojiMix.\n[Error: *${e.message}*]`);
    }
  }
};
