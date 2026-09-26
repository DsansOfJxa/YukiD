import axios from 'axios';
import NodeCache from 'node-cache';

// Caché en memoria para evitar llamadas redundantes a la red (TTL 30 min)
const bratCache = new NodeCache({ stdTTL: 1800, checkperiod: 300, useClones: false });

// Formatear texto con ajuste automático de línea para legibilidad
function formatBratText(text) {
    if (!text) return '';
    let clean = text.trim();
    if (clean.length > 150) clean = clean.substring(0, 150);
    if (clean.includes('\n')) return clean;

    const words = clean.split(/\s+/);
    const lines = [];
    let currentLine = '';

    for (const word of words) {
        if ((currentLine + ' ' + word).trim().length <= 16) {
            currentLine = (currentLine + ' ' + word).trim();
        } else {
            if (currentLine) lines.push(currentLine);
            currentLine = word;
        }
    }
    if (currentLine) lines.push(currentLine);
    return lines.join('\n');
}

// Descargar buffer de video animado con cadena de fallbacks rápida
const fetchStickerVideoBuffer = async (formattedText) => {
    const cacheKey = `bratv:${formattedText}`;
    const cachedBuffer = bratCache.get(cacheKey);
    if (cachedBuffer) return cachedBuffer;

    const endpoints = [
        { url: 'https://api.vreden.web.id/api/brat-animated', params: { text: formattedText } },
        { url: 'https://api.siputzx.my.id/api/brat-animated', params: { text: formattedText } },
        { url: 'https://skyzxu-brat.hf.space/brat-animated', params: { text: formattedText } },
        { url: 'https://api.delirius.store/canvas/brat-animated', params: { text: formattedText } }
    ];

    for (const ep of endpoints) {
        try {
            const res = await axios.get(ep.url, {
                params: ep.params,
                responseType: 'arraybuffer',
                timeout: 7000
            });
            if (res.status === 200 && res.data && res.data.length > 500) {
                const buffer = Buffer.from(res.data);
                bratCache.set(cacheKey, buffer);
                return buffer;
            }
        } catch {}
    }
    throw new Error('Servidores de Brat animado no disponibles o con tiempo agotado.');
};

export default {
    command: ['bratv', 'bratvid', 'bratanimado'],
    category: 'stickers',
    desc: 'Sticker brat animado rápido con alta legibilidad.',
    usage: '.bratv [texto] o responde a un mensaje.',

    run: async (client, m, args, usedPrefix, command, text) => {
        try {
            const input = m.quoted?.text || m.quoted?.caption || text;
            if (!input) {
                return client.reply(m.chat, '📝 Responde a un mensaje o ingresa un texto para crear el Sticker Brat animado.', m);
            }

            await m.react('🕒');

            const formattedText = formatBratText(input);
            const videoBuffer = await fetchStickerVideoBuffer(formattedText);

            // Metadata con prioridad pushName
            const userDb = global.db?.data?.users?.[m.sender] || {};
            const meta1 = userDb.metadatos?.trim();
            const meta2 = userDb.metadatos2?.trim();
            const pushName = (m.pushName && m.pushName.trim()) || userDb.name || `@${m.sender.split('@')[0]}`;

            const packname = meta1 || 'YukiBot Stickers';
            const author = meta1 ? (meta2 || '') : (pushName.startsWith('@') ? pushName : `@${pushName}`);

            try {
                if (typeof client.sendVideoAsSticker === 'function') {
                    await client.sendVideoAsSticker(m.chat, videoBuffer, m, { packname, author });
                } else {
                    await client.sendMessage(m.chat, { video: videoBuffer, gifPlayback: true }, { quoted: m });
                }
                await m.react('✔️');
            } catch (sendErr) {
                const errMsg = sendErr?.message || String(sendErr);
                if (errMsg.includes('Connection Closed') || errMsg.includes('closed') || errMsg.includes('timed out')) {
                    console.warn('[BratV] Advertencia: Conexión cerrada al enviar sticker:', errMsg);
                    return;
                }
                throw sendErr;
            }
        } catch (e) {
            const msg = e?.message || String(e);
            if (msg.includes('Connection Closed') || msg.includes('closed')) {
                console.warn('[BratV] Conexión cerrada durante la generación:', msg);
                return;
            }
            console.error('Error en comando bratv:', e);
            await m.react('✖️').catch(() => {});
            return m.reply(`> ❌ Error al generar el sticker Brat animado.\n[Error: *${msg}*]`).catch(() => {});
        }
    }
};
