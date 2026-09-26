import axios from 'axios';
import FormData from 'form-data';
import { getCachedPushName } from '../../core/message.js';

// Convertir formato de WhatsApp (*negrita*, _cursiva_, ~tachado~, `código`) a entidades Telegram
function parseMarkdownToEntities(text) {
    const entities = [];
    let cleanText = text;
    const regexes = [
        { pattern: /\*([^*]+)\*/g, type: 'bold' },
        { pattern: /_([^_]+)_/g, type: 'italic' },
        { pattern: /~([^~]+)~/g, type: 'strikethrough' },
        { pattern: /`([^`]+)`/g, type: 'code' }
    ];

    let changed = true;
    while (changed) {
        changed = false;
        for (const { pattern, type } of regexes) {
            pattern.lastIndex = 0;
            const match = pattern.exec(cleanText);
            if (match) {
                const [fullMatch, content] = match;
                const startIdx = match.index;
                const length = content.length;
                const diff = fullMatch.length - length;
                const markerLen = fullMatch.indexOf(content);

                cleanText = cleanText.substring(0, startIdx) + content + cleanText.substring(startIdx + fullMatch.length);

                for (const ent of entities) {
                    if (ent.offset >= startIdx + fullMatch.length) ent.offset -= diff;
                    else if (ent.offset <= startIdx && ent.offset + ent.length >= startIdx + fullMatch.length) ent.length -= diff;
                    else if (ent.offset >= startIdx && ent.offset + ent.length <= startIdx + fullMatch.length) ent.offset -= markerLen;
                }

                entities.push({ type, offset: startIdx, length });
                changed = true;
                break;
            }
        }
    }
    return { text: cleanText, entities };
}

// Resolución inteligente del nombre del usuario
async function getUserName(client, jid, pushName, chatId) {
    if (pushName && typeof pushName === 'string' && pushName.trim()) return pushName.trim();
    if (!jid) return 'Usuario';

    const cleanJid = client?.decodeJid ? client.decodeJid(jid) : jid;
    const cachedPush = getCachedPushName?.(cleanJid);
    if (cachedPush && typeof cachedPush === 'string' && cachedPush.trim()) return cachedPush.trim();

    if (chatId && global.msgBuffer?.[chatId]) {
        const bufferedMsg = global.msgBuffer[chatId].find(m => (m.sender === cleanJid || m.key?.participant === cleanJid) && m.pushName?.trim());
        if (bufferedMsg?.pushName) return bufferedMsg.pushName.trim();
    }

    const dbName = global.db?.data?.users?.[cleanJid]?.name;
    if (dbName && typeof dbName === 'string' && dbName.trim()) return dbName.trim();

    if (client?.getName) {
        try {
            const name = await client.getName(cleanJid);
            if (name && typeof name === 'string' && name.trim()) return name.trim();
        } catch { }
    }

    const phone = cleanJid.split('@')[0];
    return phone ? `@${phone}` : 'Usuario';
}

// Subidor multi-proveedor de multimedia
async function uploadMedia(buffer, mime) {
    const ext = mime.split("/")[1] || "bin";
    const filename = `${Math.random().toString(36).substring(2, 8)}.${ext}`;

    const uploaders = [
        async () => {
            const form = new FormData();
            form.append("files[]", buffer, filename);
            const res = await axios.post("https://uguu.se/upload.php", form, { headers: form.getHeaders(), timeout: 9000 });
            return res.data?.files?.[0]?.url || null;
        },
        async () => {
            const form = new FormData();
            form.append("file", buffer, { filename, contentType: mime });
            const res = await axios.post("https://qu.ax/upload.php", form, { headers: form.getHeaders(), timeout: 9000 });
            return res.data?.files?.[0]?.url || null;
        },
        async () => {
            const form = new FormData();
            form.append("reqtype", "fileupload");
            form.append("userhash", "c9bc208e83a7dbc7c7cc68aff");
            form.append("fileToUpload", buffer, { filename });
            const res = await axios.post("https://catbox.moe/user/api.php", form, { headers: form.getHeaders(), timeout: 9000 });
            return typeof res.data === "string" && res.data.startsWith("https://") ? res.data : null;
        }
    ];

    for (const uploader of uploaders) {
        try {
            const url = await uploader();
            if (url) return url;
        } catch { }
    }
    return null;
}

// Extraer y subir multimedia de mensajes (con soporte de mensajes antiguos mediante thumbnail)
async function getMediaUploadUrl(msg) {
    if (!msg) return null;
    const isSticker = Boolean(msg.message?.stickerMessage || msg.type === 'stickerMessage' || (msg.mime && /webp/i.test(msg.mime)));
    const isImage = Boolean(msg.message?.imageMessage || msg.type === 'imageMessage' || (msg.mime && /image/i.test(msg.mime) && !/webp/i.test(msg.mime)));
    const isVideo = Boolean(msg.message?.videoMessage || msg.type === 'videoMessage' || (msg.mime && /video/i.test(msg.mime)));

    if (isImage || isSticker || isVideo) {
        try {
            let buffer = null;
            const downloadFunc = msg.download || (msg.getQuotedObj ? async () => (await msg.getQuotedObj())?.download() : null);
            if (downloadFunc) {
                try {
                    buffer = await downloadFunc();
                } catch (dlErr) {
                    // Si falla la descarga directa (típico en mensajes viejos cuyos tokens expiraron en WA)
                }
            }

            // Fallback a jpegThumbnail / pngThumbnail para mensajes antiguos
            if (!buffer || buffer.length === 0) {
                const rawThumb = msg.msg?.jpegThumbnail || msg.message?.imageMessage?.jpegThumbnail || msg.message?.videoMessage?.jpegThumbnail || msg.message?.stickerMessage?.pngThumbnail;
                if (rawThumb) {
                    buffer = Buffer.isBuffer(rawThumb) ? rawThumb : Buffer.from(rawThumb, 'base64');
                }
            }

            if (buffer && buffer.length > 0) {
                const mime = isSticker ? 'image/webp' : (isVideo ? 'video/mp4' : 'image/jpeg');
                const url = await uploadMedia(buffer, mime);
                if (url) return { url, type: isSticker ? 'sticker' : 'image' };
            }
        } catch (e) {
            console.error('[Quoted] Error al procesar multimedia para quote:', e?.message || e);
        }
    }
    return null;
}

// Extraer información del mensaje al que se responde para el bubble de respuesta (replyMessage)
async function extractReplyInfo(msgObj, client, chatId) {
    if (!msgObj) return {};
    const contextInfo = msgObj.msg?.contextInfo || msgObj.message?.extendedTextMessage?.contextInfo || msgObj.contextInfo;
    if (!contextInfo?.quotedMessage) return {};

    const parentJid = client?.decodeJid ? client.decodeJid(contextInfo.participant || contextInfo.remoteJid) : (contextInfo.participant || contextInfo.remoteJid);
    const parentMsg = contextInfo.quotedMessage;
    const parentText = parentMsg.conversation ||
        parentMsg.extendedTextMessage?.text ||
        parentMsg.imageMessage?.caption ||
        parentMsg.videoMessage?.caption ||
        (parentMsg.stickerMessage ? '🧩 Sticker' : '') ||
        (parentMsg.audioMessage ? '🎵 Audio' : '') ||
        (parentMsg.documentMessage ? '📄 Documento' : '') || '';

    if (!parentText && !parentJid) return {};

    const parentName = parentJid ? await getUserName(client, parentJid, null, chatId) : 'Usuario';
    return {
        name: parentName,
        text: parentText.length > 150 ? parentText.substring(0, 147) + '...' : (parentText || '...'),
        chatId: parentJid ? parentJid.split('@')[0] : 1
    };
}

export default {
    command: ['quoted', 'q', 'fakereply', 'quote', 'qreply', 'qr', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10'],
    category: 'stickers',
    desc: 'Genera un sticker de cita a partir de texto, respuestas (.q reply) o varios mensajes con alta legibilidad.',
    usage: '.q [texto] | .q reply [texto] | responde a un mensaje con .q, .q reply, .q 2 o .q2.',

    run: async (client, m, args, usedPrefix, command) => {
        // 1. Extraer color de fondo (preset o código hex)
        let backgroundColor = '#1b1429';
        const colorPresets = {
            '--dark': '#1b1429',
            '--black': '#0a0a0a',
            '--white': '#f5f5f5',
            '--red': '#7a1c1c',
            '--blue': '#1b2a4a',
            '--green': '#1c4a2a',
            '--purple': '#3e1c5c',
            '--grey': '#2a2e33',
            '--gray': '#2a2e33',
            '--pink': '#6b2046',
            '--cyan': '#154e59',
            '--orange': '#6e3c15'
        };

        for (let i = 0; i < args.length; i++) {
            const arg = args[i]?.toLowerCase();
            if (colorPresets[arg]) {
                backgroundColor = colorPresets[arg];
                args.splice(i, 1);
                break;
            } else if (/^#[0-9a-fA-F]{3,6}$/.test(arg)) {
                backgroundColor = arg;
                args.splice(i, 1);
                break;
            }
        }

        // 2. Detectar si se solicitó modo respuesta (.q reply / .qr / .qreply / .q r)
        const cmdLower = command.toLowerCase();
        let isReplyMode = ['qreply', 'qr'].includes(cmdLower);
        if (!isReplyMode && args.length > 0) {
            const firstArg = args[0]?.toLowerCase();
            if (['reply', 'r', '--reply', '-r'].includes(firstArg)) {
                isReplyMode = true;
                args.shift();
            }
        }

        // 3. Determinar cantidad de mensajes (.q1-.q10 o argumento numérico)
        const qMatch = command.match(/^q([1-9]|10)$/i);
        let numMsgs = qMatch ? parseInt(qMatch[1]) : 1;
        let text = '';

        if (!qMatch && args.length > 0) {
            const firstNum = parseInt(args[0]);
            if (!isNaN(firstNum) && firstNum >= 1 && firstNum <= 10) {
                numMsgs = firstNum;
                args.shift();
            }
        }
        if (args.length > 0) {
            text = args.join(' ').trim();
        }

        // 4. Recopilar mensajes a citar
        let messagesToQuote = [];
        const buffer = global.msgBuffer?.[m.chat] || [];

        if (isReplyMode && text && m.quoted) {
            // Caso .q reply <texto>: La cita principal es el texto del usuario respondiendo al mensaje citado
            const quotedSenderJid = client.decodeJid(m.quoted.sender || m.quoted.key?.participant || m.chat);
            const quotedSenderName = await getUserName(client, quotedSenderJid, m.quoted.pushName, m.chat);
            const quotedText = m.quoted.text || m.quoted.caption || m.quoted.body || (m.quoted.message?.imageMessage ? '📷 Imagen' : (m.quoted.message?.stickerMessage ? '🧩 Sticker' : '...'));

            messagesToQuote = [{
                sender: m.sender,
                pushName: m.pushName,
                text: text,
                isMedia: false,
                type: 'conversation',
                msgObj: null,
                customReply: {
                    name: quotedSenderName,
                    text: quotedText.length > 150 ? quotedText.substring(0, 147) + '...' : (quotedText || '...'),
                    chatId: quotedSenderJid.split('@')[0]
                }
            }];
        } else if (m.quoted) {
            const quotedId = m.quoted.id;
            const startIdx = buffer.findIndex(msg => (msg.key?.id || msg.id) === quotedId);

            if (startIdx !== -1) {
                const sliced = buffer.slice(startIdx, startIdx + numMsgs);
                messagesToQuote = sliced.map(msg => ({
                    sender: msg.sender || msg.key?.participant || m.chat,
                    pushName: msg.pushName,
                    text: msg.text || msg.caption || msg.body || '',
                    isMedia: Boolean(msg.message?.imageMessage || msg.message?.videoMessage || msg.message?.stickerMessage),
                    type: msg.type || '',
                    msgObj: msg
                }));
            } else {
                // Mensaje citado antiguo (previo al inicio de sesión o fuera del buffer)
                messagesToQuote.push({
                    sender: m.quoted.sender || m.quoted.key?.participant || m.chat,
                    pushName: m.quoted.pushName,
                    text: m.quoted.text || m.quoted.caption || m.quoted.body || '',
                    isMedia: Boolean(m.quoted.message?.imageMessage || m.quoted.message?.videoMessage || m.quoted.message?.stickerMessage),
                    type: m.quoted.type || '',
                    msgObj: m.quoted
                });

                if (numMsgs > 1 && buffer.length > 0) {
                    const quotedTime = Number(m.quoted.messageTimestamp || 0);
                    let subsequent = buffer.filter(msg => {
                        const t = Number(msg.messageTimestamp || 0);
                        return t >= quotedTime && (msg.key?.id || msg.id) !== quotedId;
                    }).slice(0, numMsgs - 1);

                    if (subsequent.length === 0) {
                        subsequent = buffer.slice(-numMsgs + 1);
                    }

                    for (const msg of subsequent) {
                        messagesToQuote.push({
                            sender: msg.sender || msg.key?.participant || m.chat,
                            pushName: msg.pushName,
                            text: msg.text || msg.caption || msg.body || '',
                            isMedia: Boolean(msg.message?.imageMessage || msg.message?.videoMessage || msg.message?.stickerMessage),
                            type: msg.type || '',
                            msgObj: msg
                        });
                    }
                }
            }
        } else if (!text && numMsgs > 1 && buffer.length > 0) {
            // .q2, .q3 ejecutado directamente sin citar -> Citar los últimos N mensajes del chat
            const recent = buffer.slice(-numMsgs);
            messagesToQuote = recent.map(msg => ({
                sender: msg.sender || msg.key?.participant || m.chat,
                pushName: msg.pushName,
                text: msg.text || msg.caption || msg.body || '',
                isMedia: Boolean(msg.message?.imageMessage || msg.message?.videoMessage || msg.message?.stickerMessage),
                type: msg.type || '',
                msgObj: msg
            }));
        } else if (text) {
            const who = m.mentionedJid?.[0] || m.sender;
            messagesToQuote = [{
                sender: who,
                pushName: m.pushName,
                text,
                isMedia: false,
                type: 'conversation',
                msgObj: null
            }];
        } else {
            return m.reply(`📝 *Uso del comando Quote / Citas:*\n\n● Responde a un mensaje con *${usedPrefix}q* o *${usedPrefix}q reply* para incluir la respuesta.\n● Responde a un mensaje con *${usedPrefix}q reply [tu respuesta]* para crear una cita respondiendo.\n● Con varios mensajes: *${usedPrefix}q 2*, *${usedPrefix}q3*.\n● O escribe *${usedPrefix}q [texto]*.\n● Fondos opcionales: *--dark*, *--black*, *--white*, *--red*, *--blue*, *--green*, *--purple*, *--grey*, *--pink*, *--cyan* o código *#hex*.`);
        }

        await m.react('🕒');

        const getPfp = async (jid) => {
            try {
                const url = await client.profilePictureUrl(jid, 'image');
                if (url) return url;
            } catch { }
            return 'https://telegra.ph/file/24fa902ead26340f3df2c.png';
        };

        // 5. Construir payloads para la API de Citas en PARALELO
        const apiMessages = await Promise.all(messagesToQuote.map(async (msg) => {
            const jid = client.decodeJid(msg.sender || m.sender);
            const [name, pfp, mediaInfo, replyInfo] = await Promise.all([
                getUserName(client, jid, msg.pushName, m.chat),
                getPfp(jid),
                msg.msgObj ? getMediaUploadUrl(msg.msgObj) : Promise.resolve(null),
                msg.customReply ? Promise.resolve(msg.customReply) : (msg.msgObj ? extractReplyInfo(msg.msgObj, client, m.chat) : Promise.resolve({}))
            ]);

            let msgText = msg.text || '';
            let entities = [];
            if (msgText) {
                const parsed = parseMarkdownToEntities(msgText);
                msgText = parsed.text;
                entities = parsed.entities;
            } else if (msg.isMedia && msg.msgObj) {
                const isImage = msg.msgObj.message?.imageMessage || msg.msgObj.type === 'imageMessage';
                const isSticker = msg.msgObj.message?.stickerMessage || msg.msgObj.type === 'stickerMessage';
                if (!isImage && !isSticker) {
                    msgText = msg.type === 'videoMessage' ? '🎥 Video' : (msg.type === 'stickerMessage' ? '🧩 Sticker' : 'Multimedia');
                }
            }

            const apiMsg = {
                entities,
                avatar: true,
                from: { id: jid.split('@')[0], name, photo: { url: pfp } },
                text: msgText,
                replyMessage: Object.keys(replyInfo).length > 0 ? replyInfo : {}
            };

            if (mediaInfo) {
                apiMsg.media = { url: mediaInfo.url };
                if (mediaInfo.type === 'sticker') apiMsg.mediaType = 'sticker';
            }

            return apiMsg;
        }));

        // 6. Dimensionamiento adaptativo y optimizado para máxima legibilidad en stickers (512x512)
        const count = apiMessages.length;
        let width = 512;
        let height = 512;
        let scale = 2.2;

        if (count === 1) {
            const textLen = (apiMessages[0]?.text || '').length;
            const hasReply = Boolean(apiMessages[0]?.replyMessage?.name);

            if (textLen <= 60 && !hasReply) {
                width = 512;
                height = 380;
                scale = 2.4;
            } else if (textLen <= 140) {
                width = 512;
                height = hasReply ? 540 : 480;
                scale = 2.2;
            } else if (textLen <= 280) {
                width = 580;
                height = hasReply ? 620 : 560;
                scale = 2.3;
            } else if (textLen <= 550) {
                width = 650;
                height = hasReply ? 700 : 640;
                scale = 2.5;
            } else {
                width = 720;
                height = hasReply ? 780 : 720;
                scale = 2.6;
            }
        } else {
            width = 550 + Math.min(count * 15, 120);
            height = Math.min(480 + (count * 110), 1100);
            scale = 2.3 + (count * 0.08);
        }

        // 7. Cadena de endpoints para Quotly (priorizando el servidor activo)
        const QUOTE_ENDPOINTS = [
            'https://quote.yuri.ly/generate',
            'https://bot.lyo.su/quote/generate',
            'https://qc.botcahx.eu.org/generate',
            'https://api.aggelos-007.xyz/qc'
        ];

        try {
            const quoteObj = {
                type: 'quote',
                format: 'png',
                backgroundColor,
                width,
                height,
                scale,
                messages: apiMessages
            };

            let res;
            let apiError = null;
            for (const endpoint of QUOTE_ENDPOINTS) {
                try {
                    res = await axios.post(endpoint, quoteObj, {
                        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
                        timeout: 10000
                    });
                    if (res.data?.result?.image) {
                        apiError = null;
                        break;
                    }
                } catch (err) {
                    apiError = err;
                }
            }

            if (apiError || !res?.data?.result?.image) {
                throw apiError || new Error('La API de citas no devolvió una imagen válida.');
            }

            const bufferImage = Buffer.from(res.data.result.image, 'base64');
            const userDb = global.db?.data?.users?.[m.sender] || {};
            const meta1 = userDb.metadatos?.trim();
            const meta2 = userDb.metadatos2?.trim();
            const pushName = (m.pushName && m.pushName.trim()) || userDb.name || (apiMessages[0]?.from?.name || 'Usuario');
            const authorDisplay = pushName.startsWith('@') ? pushName : `@${pushName}`;

            const packname = meta1 || 'YukiBot Quotes';
            const author = meta1 ? (meta2 || '') : authorDisplay;

            if (typeof client.sendImageAsSticker === 'function') {
                await client.sendImageAsSticker(m.chat, bufferImage, m, { packname, author });
            } else {
                await client.sendMessage(m.chat, { image: bufferImage }, { quoted: m });
            }
            await m.react('✔️');
        } catch (err) {
            console.error('[Quoted] Error al generar cita:', err?.message || err);
            await m.react('❌');
            await m.reply('❌ Fallo al generar la cita. Inténtalo de nuevo más tarde.');
        }
    }
};
