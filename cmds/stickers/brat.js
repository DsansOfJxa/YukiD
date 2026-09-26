import axios from 'axios';

// Format text with auto word-wrap to make Brat font large, bold & readable
function formatBratText(text) {
    if (!text) return '';
    let clean = text.trim();
    if (clean.length > 200) clean = clean.substring(0, 200);
    if (clean.includes('\n')) return clean;

    const words = clean.split(/\s+/);
    const lines = [];
    let currentLine = '';

    for (const word of words) {
        if ((currentLine + ' ' + word).trim().length <= 18) {
            currentLine = (currentLine + ' ' + word).trim();
        } else {
            if (currentLine) lines.push(currentLine);
            currentLine = word;
        }
    }
    if (currentLine) lines.push(currentLine);
    return lines.join('\n');
}

// Fetch sticker image with multi-endpoint fallback
const fetchStickerBuffer = async (formattedText) => {
    const endpoints = [
        { url: 'https://skyzxu-brat.hf.space/brat', params: { text: formattedText } },
        { url: 'https://api.vreden.web.id/api/brat', params: { text: formattedText } },
        { url: 'https://api.siputzx.my.id/api/brat', params: { text: formattedText } }
    ];

    for (const ep of endpoints) {
        try {
            const res = await axios.get(ep.url, {
                params: ep.params,
                responseType: 'arraybuffer',
                timeout: 10000
            });
            if (res.data && res.data.length > 0) {
                return res.data;
            }
        } catch {}
    }
    throw new Error('No se pudo conectar a los servidores de Brat.');
};

export default {
    command: ['brat'],
    category: 'stickers',
    desc: 'Sticker estilo brat con alta legibilidad.',
    usage: '.brat [texto] o responde a un mensaje.',

    run: async (client, m, args, usedPrefix, command, text) => {
        try {
            const input = m.quoted?.text || m.quoted?.caption || text;
            if (!input) {
                return client.reply(m.chat, '📝 Por favor, responde a un mensaje o ingresa un texto para crear el Sticker.', m);
            }

            await m.react('🕒');

            const formattedText = formatBratText(input);
            const buffer = await fetchStickerBuffer(formattedText);

            // Metadata con prioridad pushName
            const userDb = global.db?.data?.users?.[m.sender] || {};
            const meta1 = userDb.metadatos?.trim();
            const meta2 = userDb.metadatos2?.trim();
            const pushName = (m.pushName && m.pushName.trim()) || userDb.name || `@${m.sender.split('@')[0]}`;

            const packname = meta1 || 'YukiBot Stickers';
            const author = meta1 ? (meta2 || '') : (pushName.startsWith('@') ? pushName : `@${pushName}`);

            await client.sendImageAsSticker(m.chat, buffer, m, { packname, author });
            await m.react('✔️');
        } catch (e) {
            console.error('Error en comando brat:', e);
            await m.react('✖️');
            return m.reply(`> ❌ Error al generar el sticker Brat.\n[Error: *${e.message}*]`);
        }
    }
};
