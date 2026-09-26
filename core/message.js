import { proto, delay, areJidsSameUser, generateWAMessage, prepareWAMessageMedia, generateWAMessageFromContent, downloadContentFromMessage, generateMessageID, generateWAMessageContent, getContentType, getDevice, extractMessageContent, jidDecode } from '@whiskeysockets/baileys';
import { resolveLidToRealJid } from "./utils.js";
import fs from 'fs';
import crypto from 'crypto';
import axios from 'axios';
import * as FileType from 'file-type';
import path from 'path';
import exif from './exif.js';
import { fileURLToPath } from 'url';
import GraphemeSplitter from 'grapheme-splitter';
import Logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const splitter = new GraphemeSplitter();

const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = exif;

export class BoundedMap {
  #map = new Map();
  #max;
  #ttl;
  constructor(max, ttlMs = 0) { this.#max = max; this.#ttl = ttlMs; }
  #expired(e) { return this.#ttl > 0 && Date.now() - e.ts > this.#ttl; }
  has(k) {
    const e = this.#map.get(k);
    if (!e) return false;
    if (this.#expired(e)) { this.#map.delete(k); return false; }
    return true;
  }
  get(k) {
    const e = this.#map.get(k);
    if (!e) return undefined;
    if (this.#expired(e)) { this.#map.delete(k); return undefined; }
    return e.v;
  }
  set(k, v) {
    if (this.#map.size >= this.#max) this.#map.delete(this.#map.keys().next().value);
    this.#map.set(k, { v, ts: Date.now() });
  }
}

const groupMetaCache = new Map();
const pushNameCache = new BoundedMap(1000, 24 * 60 * 60_000);
const lidCache = new BoundedMap(2000, 24 * 60 * 60_000);
const META_TTL = 300_000;

const gcMeta = setInterval(() => {
  const now = Date.now();
  for (const [key, val] of groupMetaCache) {
    if (now - val.ts > META_TTL) groupMetaCache.delete(key);
  }
}, 10 * 60 * 1000);
gcMeta.unref();

export function getCachedMeta(groupJid) {
  const c = groupMetaCache.get(groupJid);
  if (!c || Date.now() - c.ts > META_TTL) return null;
  return c.metadata;
}

export function setCachedMeta(groupJid, metadata) {
  if (groupJid && metadata) groupMetaCache.set(groupJid, { metadata, ts: Date.now() });
}

export function deleteCachedMeta(groupJid) {
  groupMetaCache.delete(groupJid);
}

export function getCachedPushName(jid) {
  return pushNameCache.get(jid);
}

export function setCachedPushName(jid, pushName) {
  if (jid && pushName) pushNameCache.set(jid, pushName);
}

export function normalizeJid(raw) {
  if (!raw) return null;
  const s = typeof raw === 'number' ? String(raw) : String(raw).trim();
  if (!s) return null;
  if (s.endsWith('@g.us')) return s;
  if (s.endsWith('@newsletter')) return s;
  if (s.endsWith('@lid')) return s;
  if (/:\d+@/i.test(s)) {
    const decoded = jidDecode(s);
    if (decoded?.user && decoded?.server) return `${decoded.user}@${decoded.server}`;
  }
  if (s.endsWith('@s.whatsapp.net')) return s;
  const digits = s.replace(/\D/g, '');
  if (digits && digits.length >= 4 && digits.length <= 15) return `${digits}@s.whatsapp.net`;
  return s;
}

export function resolveParticipantJid(p, sock) {
  if (!p) return null;
  if (p.phoneNumber) {
    const n = normalizeJid(p.phoneNumber);
    if (n && !n.endsWith('@lid')) return n;
  }
  if (p.id && !p.id.endsWith('@lid')) {
    const n = normalizeJid(p.id);
    if (n && !n.endsWith('@lid')) return n;
  }
  if (p.jid && !p.jid.endsWith('@lid')) {
    const n = normalizeJid(p.jid);
    if (n && !n.endsWith('@lid')) return n;
  }
  const rawLid = p.lid || (p.id?.endsWith('@lid') ? p.id : null) || (p.jid?.endsWith('@lid') ? p.jid : null);
  if (rawLid) {
    if (lidCache.has(rawLid)) return lidCache.get(rawLid);
    if (typeof sock?.findJidByLid === 'function') {
      const found = sock.findJidByLid(rawLid);
      if (found && !found.endsWith('@lid')) {
        const r = normalizeJid(found);
        if (r) { lidCache.set(rawLid, r); return r; }
      }
    }
    return rawLid;
  }
  return null;
}

export function resolveParticipants(participants, sock) {
  if (!Array.isArray(participants)) return [];
  return participants.map(p => {
    const realJid = resolveParticipantJid(p, sock);
    if (!realJid) return p;
    const originalLid = p.lid || (p.id?.endsWith('@lid') ? p.id : undefined) || (p.jid?.endsWith('@lid') ? p.jid : undefined);
    return { ...p, id: realJid, ...(originalLid ? { lid: originalLid } : {}), ...(p.phoneNumber ? { phoneNumber: p.phoneNumber } : {}) };
  }).filter(p => p.id);
}

export function patchGroupMetadata(client) {
  if (!client || client.isPatchedGroupMetadata) return;
  client.isPatchedGroupMetadata = true;
  const originalGroupMetadata = client.groupMetadata.bind(client);
  client.groupMetadata = async (jid) => {
    try {
      const cached = getCachedMeta(jid);
      if (cached) return cached;
      const meta = await originalGroupMetadata(jid);
      if (meta) setCachedMeta(jid, meta);
      return meta;
    } catch (e) {
      return null;
    }
  };
}

export * from '../utils/tools.js';

export async function fixLid(client, m) {
  const decodedJid = client.decodeJid((m.fromMe && client.user.id) || m.key.participant || m.chat || '');
  const realJid = await resolveLidToRealJid(decodedJid, client, m.chat);
  return realJid;
}

export async function fixLid2(client, m) {
  const decodedJid = client.decodeJid(m.msg.contextInfo.participant);
  const realJid = await resolveLidToRealJid(decodedJid, client, m.chat);
  return realJid;
}

export async function downloadMediaMessage(message) {
  const msg = message.msg || message;
  const mime = msg.mimetype || '';
  const messageType = (message.type || mime?.split('/')[0] || 'document').replace(/Message/gi, '');
  const stream = await downloadContentFromMessage(msg, messageType);
  let buffer = Buffer.alloc(0);
  for await (const chunk of stream) {
    buffer = Buffer.concat([buffer, chunk]);
  }
  return buffer;
}

export async function getFile(PATH, saveToFile = false) {
  let res, filename;
  const data = Buffer.isBuffer(PATH) ? PATH : PATH instanceof ArrayBuffer ? PATH.toBuffer() : /^data:.*?\/.*?;base64,/i.test(PATH) ? Buffer.from(PATH.split`,`[1], 'base64') : /^https?:\/\//.test(PATH) ? (res = await axios.get(PATH, { responseType: 'arraybuffer' }), res.data) : fs.existsSync(PATH) ? ((filename = PATH), fs.readFileSync(PATH)) : typeof PATH === 'string' ? PATH : Buffer.alloc(0);
  if (!Buffer.isBuffer(data)) throw new TypeError('Result is not a buffer');
  const type = (await FileType.fromBuffer(data)) || { mime: 'application/octet-stream', ext: '.bin' };
  if (data && saveToFile && !filename) {
    const tmpDir = path.join(__dirname, '../tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    filename = path.join(tmpDir, new Date() * 1 + '.' + type.ext);
    await fs.promises.writeFile(filename, data);
  }
  return { res, filename, ...type, data, deleteFile() {
      return filename && fs.promises.unlink(filename).catch(() => {});
    },
  };
}

export function decorateClient(client, store) {
  if (client.isDecorated) return;
  client.isDecorated = true;

  client.sentMessageIds = new Set();
  const originalSendMessage = client.sendMessage.bind(client);
  client.sendMessage = async (...args) => {
    const result = await originalSendMessage(...args);
    if (result && result.key && result.key.id) {
      client.sentMessageIds.add(result.key.id);
      if (client.sentMessageIds.size > 500) {
        const firstValue = client.sentMessageIds.values().next().value;
        client.sentMessageIds.delete(firstValue);
      }
      // Guardar el mensaje saliente en msgStore para responder a reintentos (retry requests) en grupos
      if (global.msgStore && result.message) {
        const sid = (result.key.remoteJid || '') + ':' + result.key.id;
        global.msgStore.set(sid, result.message);
        global.msgStore.set(result.key.id, result.message);
        if (global.msgStore.size > 1000) {
          global.msgStore.delete(global.msgStore.keys().next().value);
        }
      }
    }
    return result;
  };

  client.downloadMediaMessage = downloadMediaMessage;
  client.getFile = getFile;

  client.getName = (jid, withoutContact = false) => {
    const id = client.decodeJid(jid);
    withoutContact = client.withoutContact || withoutContact;
    let v;
    if (id.endsWith('@g.us')) {
      return new Promise(async (resolve) => {
        v = (store?.contacts?.[id]) || {};
        if (!(v.name || v.subject)) v = getCachedMeta(id) || await client.groupMetadata(id).catch(() => ({})) || {};
        resolve(v.name || v.subject || '+' + id.replace('@s.whatsapp.net', ''));
      });
    } else {
      const cachedPushName = getCachedPushName(id);
      if (cachedPushName && !withoutContact) return cachedPushName;
      v = id === '0@s.whatsapp.net' ? { id, name: 'WhatsApp' } : areJidsSameUser(id, client.user.id) ? client.user : (store?.contacts?.[id]) || {};
    }
    return (withoutContact ? '' : v.name) || v.subject || v.verifiedName || '+' + id.replace('@s.whatsapp.net', '');
  };

  client.parseMention = async (text) => {
    return [...text.matchAll(/@([0-9]{5,16}|0)/g)].map((v) => v[1] + '@s.whatsapp.net');
  };

  client.sendImageAsSticker = async (jid, path, quoted, options = {}) => {
    let buff = Buffer.isBuffer(path) ? path : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], 'base64') : /^https?:\/\//.test(path) ? await getBuffer(path) : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0);
    let buffer;
    if (options && (options.packname || options.author)) {
      buffer = await writeExifImg(buff, options);
    } else {
      buffer = await imageToWebp(buff);
    }
    if (typeof buffer === 'string' && fs.existsSync(buffer)) {
      const filePath = buffer;
      buffer = fs.readFileSync(filePath);
      try { fs.unlinkSync(filePath); } catch {}
    }
    await client.sendMessage(jid, { sticker: buffer, ...options }, { quoted });
    return buffer;
  };

  client.sendVideoAsSticker = async (jid, path, quoted, options = {}) => {
    let buff = Buffer.isBuffer(path) ? path : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], 'base64') : /^https?:\/\//.test(path) ? await getBuffer(path) : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0);
    let buffer;
    if (options && (options.packname || options.author)) {
      buffer = await writeExifVid(buff, options);
    } else {
      buffer = await videoToWebp(buff);
    }
    if (typeof buffer === 'string' && fs.existsSync(buffer)) {
      const filePath = buffer;
      buffer = fs.readFileSync(filePath);
      try { fs.unlinkSync(filePath); } catch {}
    }
    await client.sendMessage(jid, { sticker: buffer, ...options }, { quoted });
    return buffer;
  };

  client.sendFile = async (jid, path, filename = "file", caption = "", quoted = null, ptt = false, options = {}) => {
    let buffer;
    if (Buffer.isBuffer(path)) {
      buffer = path;
    } else if (/^https?:\/\//.test(path)) {
      buffer = (await axios.get(path, { responseType: 'arraybuffer' })).data;
    } else if (fs.existsSync(path)) {
      buffer = fs.readFileSync(path);
    } else {
      throw new Error("Ruta o buffer inválido");
    }
    const type = (await FileType.fromBuffer(buffer)) || { mime: "application/octet-stream", ext: "bin", };
    let mtype = "";
    let mimetype = options.mimetype || type.mime;
    let file = buffer;
    let pathFile = filename;
    if (options.asGif || /gif/.test(type.mime)) {
      mtype = "video";
      options.gifPlayback = true;
    } else if (/webp/.test(type.mime) || (/image/.test(type.mime) && options.asSticker)) {
      mtype = "sticker";
    } else if (/image/.test(type.mime) || (/webp/.test(type.mime) && options.asImage)) {
      mtype = "image";
    } else if (/video/.test(type.mime)) {
      mtype = "video";
    } else if (/audio/.test(type.mime)) {
      mtype = "audio";
    } else {
      mtype = "document";
    }
    if (options.asDocument) mtype = "document";
    delete options.asSticker;
    delete options.asLocation;
    delete options.asVideo;
    delete options.asDocument;
    delete options.asImage;
    delete options.asGif;
    const message = { ...options, caption, ptt, [mtype]: file, mimetype, fileName: filename || pathFile.split("/").pop(), };
    return client.sendMessage(jid, message, { quoted, ...options });
  };

  client.sendAlbumMessage = async (jid, medias, options = {}) => {
    if (typeof jid !== "string") throw new TypeError(`jid must be string, received: ${jid}`);
    if (!Array.isArray(medias) || medias.length < 2) throw new RangeError("Minimum 2 media required");
    for (const media of medias) {
      if (media.type !== "image" && media.type !== "video") throw new TypeError(`Invalid media type: ${media.type}`);
      if (!media.data || (!media.data.url && !Buffer.isBuffer(media.data))) throw new TypeError(`Invalid media data`);
    }
    const caption = options.text || options.caption || "";
    const delayMs = !isNaN(options.delay) ? options.delay : 500;
    delete options.text;
    delete options.caption;
    delete options.delay;
    const album = generateWAMessageFromContent(jid, { messageContextInfo: {}, albumMessage: { expectedImageCount: medias.filter(m => m.type === "image").length, expectedVideoCount: medias.filter(m => m.type === "video").length, ...(options.quoted ? { contextInfo: { remoteJid: options.quoted.key.remoteJid, fromMe: options.quoted.key.fromMe, stanzaId: options.quoted.key.id, participant: options.quoted.key.participant || options.quoted.key.remoteJid, quotedMessage: options.quoted.message }} : {})}, }, {});
    await client.relayMessage(album.key.remoteJid, album.message, { messageId: album.key.id });
    for (let i = 0; i < medias.length; i++) {
      const { type, data, caption } = medias[i];
      const mediaMsg = await generateWAMessage(album.key.remoteJid, { [type]: data, ...(caption ? { caption } : {}) }, { upload: client.waUploadToServer });
      mediaMsg.message.messageContextInfo = { messageAssociation: { associationType: 1, parentMessageKey: album.key }};
      await client.relayMessage(mediaMsg.key.remoteJid, mediaMsg.message, { messageId: mediaMsg.key.id });
      await delay(delayMs);
    }
    return album;
  };

  client.sendButton = async (jid, text = '', footer = '', buffer, buttons, copy, urls, quoted, options) => {
    let img, video;
    if (/^https?:\/\//i.test(buffer)) {
      try {
        const response = await axios.head(buffer);
        const contentType = response.headers['content-type'];
        if (/^image\//i.test(contentType)) {
          img = await prepareWAMessageMedia({ image: { url: buffer } }, { upload: client.waUploadToServer });
        } else if (/^video\//i.test(contentType)) {
          video = await prepareWAMessageMedia({ video: { url: buffer } }, { upload: client.waUploadToServer });
        } else {
          Logger.error(`Tipo MIME no compatible: ${contentType}`);
        }
      } catch (error) {
        Logger.error('Error al obtener el tipo MIME', error);
      }
    } else {
      try {
        const type = await client.getFile(buffer);
        if (/^image\//i.test(type.mime)) {
          img = await prepareWAMessageMedia({ image: { url: buffer } }, { upload: client.waUploadToServer });
        } else if (/^video\//i.test(type.mime)) {
          video = await prepareWAMessageMedia({ video: { url: buffer } }, { upload: client.waUploadToServer });
        }
      } catch (error) {
        Logger.error('Error al obtener el tipo de archivo', error);
      }
    }

    const botId = (client?.user?.id?.split(':')[0] || '') + '@s.whatsapp.net';
    const botSettings = global.db.data.settings[botId] ||= {};
    const botname = botSettings.botname || '';
    const dynamicButtons = buttons.map((btn) => ({ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: btn[0], id: btn[1] }), contextInfo: { mentionedJid: null, externalAdReply: { title: botname, body: global.dev, mediaType: 1, renderLargerThumbnail: false, previewType: `NONE` }}}));
    if (copy && (typeof copy === 'string' || typeof copy === 'number')) {
      dynamicButtons.push({ name: 'cta_copy', buttonParamsJson: JSON.stringify({ display_text: 'Copy', copy_code: copy }) });
    }
    if (urls && Array.isArray(urls)) {
      urls.forEach((url) => {
        dynamicButtons.push({ name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: url[0], url: url[1], merchant_url: url[1] }) });
      });
    }
    const interactiveMessage = { body: { text: text }, footer: { text: footer }, header: { hasMediaAttachment: false, imageMessage: img ? img.imageMessage : null, videoMessage: video ? video.videoMessage : null, }, nativeFlowMessage: { buttons: dynamicButtons, messageParamsJson: '' } };
    let msgL = generateWAMessageFromContent(jid, { viewOnceMessage: { message: { interactiveMessage }}}, { userJid: client.user.jid, quoted });
    client.relayMessage(jid, msgL.message, { messageId: msgL.key.id, ...options });
  };

  client.sendList = async (jid, title, text, buttonText, listSections, quoted, options = {}) => {
    const sections = [...listSections];
    const message = { interactiveMessage: { header: { title: title }, body: { text: text }, nativeFlowMessage: { buttons: [{ name: 'single_select', buttonParamsJson: JSON.stringify({ title: buttonText, sections })}], messageParamsJson: '' }}};
    await client.relayMessage(jid, { viewOnceMessage: { message } }, {});
  };

  client.newsletterMsg = async (key, content = {}, timeout = 5000) => {
    const { type: rawType = 'INFO', name, description = '', picture = null, react, id, newsletter_id = key, ...media } = content;
    const type = rawType.toUpperCase();
    if (react) {
      if (!(newsletter_id.endsWith('@newsletter') || !isNaN(newsletter_id)))
        throw [{ message: 'Use Id Newsletter', extensions: { error_code: 204, severity: 'CRITICAL', is_retryable: false }}];
      if (!id)
        throw [{ message: 'Use Id Newsletter Message', extensions: { error_code: 204, severity: 'CRITICAL', is_retryable: false }}];
      const hasil = await client.query({ tag: 'message', attrs: { to: key, type: 'reaction', server_id: id, id: generateMessageID() }, content: [{ tag: 'reaction', attrs: { code: react } }] });
      return hasil;
    } else if (media && typeof media === 'object' && Object.keys(media).length > 0) {
      const msg = await generateWAMessageContent(media, { upload: client.waUploadToServer });
      const anu = await client.query({ tag: 'message', attrs: { to: newsletter_id, type: 'text' in media ? 'text' : 'media' }, content: [{ tag: 'plaintext', attrs: /image|video|audio|sticker|poll/.test(Object.keys(media).join('|')) ? { mediatype: Object.keys(media).find((key) => ['image', 'video', 'audio', 'sticker', 'poll'].includes(key)) || null } : {}, content: proto.Message.encode(msg).finish() }] });
      return anu;
    } else {
      if (/(FOLLOW|UNFOLLOW|DELETE)/.test(type) && !(newsletter_id.endsWith('@newsletter') || !isNaN(newsletter_id)))
        return [{ message: 'Use Id Newsletter', extensions: { error_code: 204, severity: 'CRITICAL', is_retryable: false }}];
      const _query = await client.query({ tag: 'iq', attrs: { to: 's.whatsapp.net', type: 'get', xmlns: 'w:mex' }, content: [{ tag: 'query', attrs: { query_id: type == 'FOLLOW' ? '9926858900719341' : type == 'UNFOLLOW' ? '7238632346214362' : type == 'CREATE' ? '6234210096708695' : type == 'DELETE' ? '8316537688363079' : '6563316087068696' }, content: new TextEncoder().encode(JSON.stringify({ variables: /(FOLLOW|UNFOLLOW|DELETE)/.test(type) ? { newsletter_id } : type == 'CREATE' ? { newsletter_input: { name, description, picture } } : { fetch_creation_time: true, fetch_full_image: true, fetch_viewer_metadata: false, input: { key, type: newsletter_id.endsWith('@newsletter') || !isNaN(newsletter_id) ? 'JID' : 'INVITE' } } })) }] }, timeout);
      const res = JSON.parse(_query.content[0].content)?.data?.xwa2_newsletter || JSON.parse(_query.content[0].content)?.data?.xwa2_newsletter_join_v2 || JSON.parse(_query.content[0].content)?.data?.xwa2_newsletter_leave_v2 || JSON.parse(_query.content[0].content)?.data?.xwa2_newsletter_create || JSON.parse(_query.content[0].content)?.data?.xwa2_newsletter_delete_v2 || JSON.parse(_query.content[0].content)?.errors || JSON.parse(_query.content[0].content);
      res.thread_metadata ? (res.thread_metadata.host = 'https://mmg.whatsapp.net') : null;
      return res;
    }
  };

  client.sendContextInfoIndex = async (jid, text = '', options = {}, quoted = null, useQuoted = true, mentionedJid = null, config = {}) => {
    const botId = (client?.user?.id?.split(':')[0] || '') + '@s.whatsapp.net';
    const settings = global.db.data.settings[botId] || {};
    const botnam = config.title || settings.botname || settings.namebot || 'YukiBot';
    const mentions = Array.isArray(mentionedJid) ? mentionedJid.map(id => id.includes('@') ? id : id + '@s.whatsapp.net') : undefined;

    let bannerUrl = config.banner || settings.icon;
    if (typeof bannerUrl === 'string' && bannerUrl.includes('yuki-wabot.my.id')) {
      bannerUrl = null;
    }

    try {
      const contextInfo = {
        mentionedJid: mentions,
        ...(bannerUrl ? {
          externalAdReply: {
            title: botnam,
            body: config.body || global.dev || 'YukiBot-MD',
            mediaType: 1,
            renderLargerThumbnail: false,
            previewType: 'NONE',
            thumbnailUrl: bannerUrl,
            sourceUrl: config.redes || settings.link
          }
        } : {})
      };
      return await client.sendMessage(jid, { text, contextInfo, mentions, ...options }, { quoted: useQuoted ? quoted : undefined });
    } catch {
      return await client.sendMessage(jid, { text, mentions, ...options }, { quoted: useQuoted ? quoted : undefined });
    }
  };

  client.reply = async (jid, text = '', quoted, options) => {
    return Buffer.isBuffer(text) ? client.sendFile(jid, text, 'file', '', quoted, false, options) : client.sendMessage(jid, { ...options, text }, { quoted, ...options });
  };
}

export async function smsg(client, m, store) {
  if (!m) return m;
  if (m.key) {
    m.id = m.key.id;
    m.chat = m.key.remoteJid;
    m.fromMe = m.key.fromMe;
    m.isBot = (client.sentMessageIds && client.sentMessageIds.has(m.id)) || ['HSK', 'BAE', 'B1E', 'B24E', 'WA'].some((a) => m.id.startsWith(a) && [12, 16, 20, 22, 40].includes(m.id.length)) || /(.)\1{5,}/.test(m.id) || false;
    m.isGroup = m.chat.endsWith('@g.us');
    if (!m.isGroup && m.chat.endsWith('@lid')) {
      if (typeof client.findJidByLid === 'function') {
        m.chat = client.findJidByLid(m.chat) || m.chat;
      }
    }
    m.sender = await fixLid(client, m);
  }
  if (m.message) {
    m.type = getContentType(m.message) || Object.keys(m.message)[0];
    m.msg = /viewOnceMessage|viewOnceMessageV2Extension|editedMessage|ephemeralMessage/i.test(m.type) ? m.message[m.type].message[getContentType(m.message[m.type].message)] : extractMessageContent(m.message[m.type]) || m.message[m.type];
    m.body = m.message?.conversation || m.msg?.text || m.msg?.conversation || m.msg?.caption || m.msg?.selectedButtonId || m.msg?.singleSelectReply?.selectedRowId || m.msg?.selectedId || m.msg?.contentText || m.msg?.selectedDisplayText || m.msg?.title || m.msg?.name || '';
    m.mentionedJid = m.msg?.contextInfo?.mentionedJid || [];
    m.text = m.msg?.text || m.msg?.caption || m.message?.conversation || m.msg?.contentText || m.msg?.selectedDisplayText || m.msg?.title || '';
    const idBot = (client?.user?.id?.split(':')[0] || '') + '@s.whatsapp.net';
    const config = global.db.data.settings[idBot] ||= {};
    let activePrefixes = [];
    if (config.prefix === true) {
      activePrefixes = [];
    } else if (Array.isArray(config.prefix)) {
      activePrefixes = config.prefix;
    } else if (typeof config.prefix === 'string') {
      activePrefixes = splitter.splitGraphemes(config.prefix);
    } else {
      activePrefixes = ['#', '/', '!', '.'];
    }
    m.usedPrefix = '';
    if (activePrefixes.length > 0) {
      for (const p of activePrefixes) {
        if (m.body?.startsWith(p)) {
          m.usedPrefix = p;
          break;
        }
      }
    }
    const trimmedBody = m.body ? m.body.slice(m.usedPrefix.length).trim() : '';
    const firstSpace = trimmedBody.search(/\s/);
    if (firstSpace === -1) {
      m.command = trimmedBody;
      m.args = [];
    } else {
      m.command = trimmedBody.slice(0, firstSpace);
      m.args = trimmedBody.slice(firstSpace).trim().split(/\s+/).filter(Boolean);
    }
    m.device = getDevice(m.id);
    m.expiration = m.msg?.contextInfo?.expiration || m?.metadata?.ephemeralDuration || client?.messages?.[m.chat]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0;
    m.timestamp = (typeof m.messageTimestamp === 'number' ? m.messageTimestamp : m.messageTimestamp.low ? m.messageTimestamp.low : m.messageTimestamp.high) || m.msg.timestampMs * 1000;
    m.isMedia = !!m.msg?.mimetype || !!m.msg?.thumbnailDirectPath;
    if (m.isMedia) {
      m.mime = m.msg?.mimetype;
      m.size = m.msg?.fileLength;
      m.height = m.msg?.height || '';
      m.width = m.msg?.width || '';
      if (/webp/i.test(m.mime)) {
        m.isAnimated = m.msg?.isAnimated;
      }
    }
    m.quoted = m.msg?.contextInfo?.quotedMessage || null;
    if (m.quoted) {
      m.quoted.message = extractMessageContent(m.msg?.contextInfo?.quotedMessage);
      m.quoted.type = getContentType(m.quoted.message) || Object.keys(m.quoted.message)[0];
      m.quoted.id = m.msg.contextInfo.stanzaId;
      m.quoted.device = getDevice(m.quoted.id);
      m.quoted.chat = m.msg.contextInfo.remoteJid || m.chat;
      m.quoted.isBot = m.quoted.id ? (client.sentMessageIds && client.sentMessageIds.has(m.quoted.id)) || ['HSK', 'BAE', 'B1E', 'B24E', 'WA'].some((a) => m.quoted.id.startsWith(a) && [12, 16, 20, 22, 40].includes(m.quoted.id.length)) || /(.)\1{5,}|[^a-zA-Z0-9]|[^0-9A-F]/.test(m.quoted.id) : false;
      if (m.msg?.contextInfo?.participant?.endsWith('@lid'))
        m.msg.contextInfo.participant = m?.metadata?.participants?.find((a) => a.lid === m.msg.contextInfo.participant)?.id || m.msg.contextInfo.participant;
      m.quoted.sender = await fixLid2(client, m);
      m.quoted.fromMe = m.quoted.sender === client.decodeJid(client.user.id);
      m.quoted.text = m.quoted.caption || m.quoted.conversation || m.quoted.contentText || m.quoted.selectedDisplayText || m.quoted.title || '';
      m.quoted.msg = extractMessageContent(m.quoted.message[m.quoted.type]) || m.quoted.message[m.quoted.type];
      m.quoted.mentionedJid = m.quoted?.msg?.contextInfo?.mentionedJid || [];
      m.quoted.body = m.quoted.msg?.text || m.quoted.msg?.caption || m.quoted?.message?.conversation || m.quoted.msg?.selectedButtonId || m.quoted.msg?.singleSelectReply?.selectedRowId || m.quoted.msg?.selectedId || m.quoted.msg?.contentText || m.quoted.msg?.selectedDisplayText || m.quoted.msg?.title || m.quoted?.msg?.name || '';
      m.getQuotedObj = async () => {
        if (!m.quoted.id) return false;
        let q = store?.loadMessage ? await store.loadMessage(m.chat, m.quoted.id) : null;
        return q ? await smsg(client, q, store) : false;
      };
      m.quoted.key = { remoteJid: m.msg?.contextInfo?.remoteJid || m.chat, participant: m.quoted.sender, fromMe: areJidsSameUser(client.decodeJid(m.msg?.contextInfo?.participant), client.decodeJid(client?.user?.id)), id: m.msg?.contextInfo?.stanzaId };
      m.quoted.isGroup = m.quoted.chat.endsWith('@g.us');
      m.quoted.mentions = m.quoted.msg?.contextInfo?.mentionedJid || [];
      m.quoted.body = m.quoted.msg?.text || m.quoted.msg?.caption || m.quoted?.message?.conversation || m.quoted.msg?.selectedButtonId || m.quoted.msg?.singleSelectReply?.selectedRowId || m.quoted.msg?.selectedId || m.quoted.msg?.contentText || m.quoted.msg?.selectedDisplayText || m.quoted.msg?.title || m.quoted?.msg?.name || '';
      let quotedPrefix = '';
      if (activePrefixes.length > 0) {
        for (const p of activePrefixes) {
          if (m.quoted.body?.startsWith(p)) {
            quotedPrefix = p;
            break;
          }
        }
      }
      m.quoted.usedPrefix = quotedPrefix;
      m.quoted.command = m.quoted.body && m.quoted.body.replace(m.quoted.usedPrefix, '').trim().split(/ +/).shift();
      m.quoted.isMedia = !!m.quoted.msg?.mimetype || !!m.quoted.msg?.thumbnailDirectPath;
      if (m.quoted.isMedia) {
        m.quoted.fileSha256 = m.quoted[m.quoted.type]?.fileSha256 || '';
        m.quoted.mime = m.quoted.msg?.mimetype;
        m.quoted.size = m.quoted.msg?.fileLength;
        m.quoted.height = m.quoted.msg?.height || '';
        m.quoted.width = m.quoted.msg?.width || '';
        if (/webp/i.test(m.quoted.mime)) {
          m.quoted.isAnimated = m?.quoted?.msg?.isAnimated || false;
        }
      }
      m.quoted.fakeObj = proto.WebMessageInfo.fromObject({ key: { remoteJid: m.quoted.chat, fromMe: m.quoted.fromMe, id: m.quoted.id }, message: m.quoted, ...(m.isGroup ? { participant: m.quoted.sender } : {}) });
      m.quoted.download = () => client.downloadMediaMessage(m.quoted);
      m.quoted.delete = () => {
        client.sendMessage(m.quoted.chat, { delete: { remoteJid: m.quoted.chat, fromMe: m.isBotAdmin ? false : true, id: m.quoted.id, participant: m.quoted.sender }}).catch(() => {});
      };
    }
  }

  m.download = () => client.downloadMediaMessage(m);
  m.copy = () => smsg(client, proto.WebMessageInfo.fromObject(proto.WebMessageInfo.toObject(m)), store);
  m.copyNForward = (jid = m.chat, forceForward = false, options = {}) => client.copyNForward(jid, m, forceForward, options);
  m.react = (u) => client.sendMessage(m.chat, { react: { text: u, key: m.key } });

  m.reply = async (content, options = {}) => {
    const quoted = m;
    const chat = m.chat;
    const caption = '';
    const ephemeralExpiration = m.expiration;
    const mentions = '';
    if (typeof content === 'object') {
      return client.sendMessage(chat, content, { ...options, quoted, ephemeralExpiration });
    } else if (typeof content === 'string') {
      try {
        if (/^https?:\/\/[^\s]+\.(jpe?g|png|gif|webp|mp4|mp3|ogg|wav|pdf)($|\?)/i.test(content.trim())) {
          const data = await axios.get(content, { responseType: 'arraybuffer' });
          const mime = data.headers['content-type'] || (await FileType.fromBuffer(data.data))?.mime || '';
          if (/gif|image|video|audio|pdf|stream/i.test(mime)) {
            return client.sendFile(chat, data.data, '', caption, quoted, false, options);
          }
        }
        return client.sendMessage(chat, { text: content, mentions, ...options }, { quoted, ephemeralExpiration });
      } catch (e) {
        return client.sendMessage(chat, { text: content, mentions, ...options }, { quoted, ephemeralExpiration });
      }
    }
  };

  client.sendCodeMessage = async (jid, filename, code, quoted, tableData) => {
    const KEYWORDS = new Set(['break','case','catch','class','const','continue','debugger','default','delete','do','else','export','extends','false','finally','for','function','if','import','in','instanceof','let','new','null','return','super','switch','this','throw','true','try','typeof','var','void','while','with','yield','async','await','static']);
    const METHOD_NAMES = new Set(['log','parse','stringify','from','toString','readFileSync','existsSync','statSync','resolve','join','randomUUID','randomBytes','startsWith','replace','trim','isFile','relayMessage','sendMessage']);
    function tokenize(src) {
      const tokens = [];
      let i = 0;
      const push = (content, type = 'DEFAULT') => { if (content) tokens.push({ content, type }); };
      while (i < src.length) {
        const ch = src[i];
        const rest = src.slice(i);
        if (rest.startsWith('//')) { let j = i + 2; while (j < src.length && src[j] !== '\n') j++; push(src.slice(i, j), 'DEFAULT'); i = j; continue; }
        if (rest.startsWith('/*')) { let j = i + 2; while (j < src.length - 1 && !(src[j] === '*' && src[j + 1] === '/')) j++; j = Math.min(j + 2, src.length); push(src.slice(i, j), 'DEFAULT'); i = j; continue; }
        if (ch === "'" || ch === '"' || ch === '`') {
          const quote = ch; let j = i + 1, escaped = false;
          while (j < src.length) { const c = src[j]; if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === quote) { j++; break; } j++; }
          push(src.slice(i, j), 'STR'); i = j; continue;
        }
        if (/[0-9]/.test(ch)) { let j = i + 1; while (j < src.length && /[0-9._]/.test(src[j])) j++; push(src.slice(i, j), 'NUMBER'); i = j; continue; }
        if (/[A-Za-z_$]/.test(ch)) {
          let j = i + 1; while (j < src.length && /[A-Za-z0-9_$]/.test(src[j])) j++;
          const word = src.slice(i, j); const next = src[j] || '', prev = src[i - 1] || '';
          if (KEYWORDS.has(word)) push(word, 'KEYWORD');
          else if ((METHOD_NAMES.has(word) || next === '(') && prev === '.') push(word, 'METHOD');
          else if (METHOD_NAMES.has(word) && next === '(') push(word, 'METHOD');
          else push(word, 'DEFAULT');
          i = j; continue;
        }
        push(ch, 'DEFAULT'); i++;
      }
      const merged = [];
      for (const token of tokens) { const last = merged[merged.length - 1]; if (last?.type === 'DEFAULT' && token.type === 'DEFAULT') last.content += token.content; else merged.push({ ...token }); }
      return merged;
    }
    const codeBlocks = Array.isArray(code) ? code : tokenize(String(code));
    const sections = [];
    const submessages = [];
    sections.push({ view_model: { primitive: { text: filename, __typename: 'GenAIMarkdownTextUXPrimitive' }, __typename: 'GenAISingleLayoutViewModel' } });
    if (tableData) {
      const tableRows = [{ items: tableData.headers, isHeading: true }, ...tableData.rows.map(r => ({ items: r.map(String) }))];
      submessages.push({ messageType: 4, tableMetadata: { title: tableData.title, rows: tableRows } });
      sections.push({ view_model: { primitive: { title: tableData.title, rows: tableRows.map(row => ({ is_header: row.isHeading ?? false, cells: row.items, markdown_cells: [] })), __typename: 'GenATableUXPrimitive' }, __typename: 'GenAISingleLayoutViewModel' } });
    }
    sections.push({ view_model: { primitive: { language: 'javascript', code_blocks: codeBlocks, __typename: 'GenAICodeUXPrimitive' }, __typename: 'GenAISingleLayoutViewModel' } });
    const payload = { response_id: crypto.randomUUID(), sections };
    const content = { messageContextInfo: { threadId: [], deviceListMetadata: { senderKeyIndexes: [], recipientKeyIndexes: [], recipientKeyHash: '', recipientTimestamp: Math.floor(Date.now() / 1000) }, deviceListMetadataVersion: 2, messageSecret: crypto.randomBytes(32).toString('base64') }, botForwardedMessage: { message: { richResponseMessage: { submessages, messageType: 1, unifiedResponse: { data: Buffer.from(JSON.stringify(payload), 'utf8').toString('base64') }, contextInfo: { mentionedJid: [], groupMentions: [], statusAttributions: [], forwardingScore: 2, isForwarded: true, forwardedAiBotMessageInfo: { botJid: '259786046210223@bot' }, forwardOrigin: 4, botMessageSharingInfo: { botEntryPointOrigin: 1, forwardScore: 2 } } } } } };
    return client.relayMessage(jid, content, {});
  };

  return m;
}