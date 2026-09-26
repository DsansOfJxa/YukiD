/**
 * 🎨 utils_media.js — Comandos de conversión, mejora visual e identificación de medios.
 * Reúne: tourl, toimg, hd, getpic, shazam
 */
import FormData from 'form-data';
import crypto from 'crypto';
import { promises as fsp } from 'fs';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import Acrcloud from 'acrcloud';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import { resolveLidToRealJid } from "../../core/utils.js";

// ── CONFIGURACIÓN ACRCLOUD (SHAZAM) ──
const acr = new Acrcloud({
  host: 'identify-eu-west-1.acrcloud.com',
  access_key: 'c33c767d683f78bd17d4bd4991955d81',
  access_secret: 'bvgaIAEtADBTbLwiPGYlxupWqkNGIjT7J9Ag2vIu',
});

// ── FILE-TYPE HELPER ──
let fileTypeFromBuffer;
try {
  const ft = await import('file-type');
  fileTypeFromBuffer = ft.fileTypeFromBuffer;
} catch {
  fileTypeFromBuffer = async (buf) => {
    if (!buf || buf.length < 4) return null;
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return { ext: 'png', mime: 'image/png' };
    if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return { ext: 'jpg', mime: 'image/jpeg' };
    if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf.length > 11 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return { ext: 'webp', mime: 'image/webp' };
    return null;
  };
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(2)} ${sizes[i]}`;
}

function generateUniqueFilename(mime) {
  const ext = mime.split("/")[1] || "bin";
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${id}.${ext}`;
}

function runFfmpeg(args, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    const t = setTimeout(() => {
      try { p.kill('SIGKILL'); } catch {}
      reject(new Error('ffmpeg timeout'));
    }, timeoutMs);

    p.stderr.on('data', (d) => (err += d.toString()));
    p.on('error', (e) => {
      clearTimeout(t);
      reject(e);
    });
    p.on('close', (code) => {
      clearTimeout(t);
      if (code === 0) return resolve(true);
      reject(new Error(err || `ffmpeg failed (${code})`));
    });
  });
}

// Conversión rápida local de WebP a PNG o MP4 con ffmpeg
async function convertWebpLocally(webpBuf, isAnimated = false) {
  const tmpDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const randomId = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const inPath = path.join(tmpDir, `stk_${randomId}.webp`);
  const outPath = path.join(tmpDir, `out_${randomId}.${isAnimated ? 'mp4' : 'png'}`);

  await fsp.writeFile(inPath, webpBuf);

  try {
    if (isAnimated) {
      await runFfmpeg(['-y', '-i', inPath, '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', outPath], 30000);
    } else {
      await runFfmpeg(['-y', '-i', inPath, '-frames:v', '1', outPath], 15000);
    }
    const outputBuffer = await fsp.readFile(outPath);
    return { ok: true, buffer: outputBuffer };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    try { await fsp.unlink(inPath); } catch {}
    try { await fsp.unlink(outPath); } catch {}
  }
}

// ── SERVIDORES DE CARGA (TOURL) ──
async function uploadCatbox(buffer, mime) {
  const form = new FormData();
  form.append("reqtype", "fileupload");
  form.append("userhash", "c9bc208e83a7dbc7c7cc68aff");
  form.append("fileToUpload", buffer, { filename: generateUniqueFilename(mime) });
  
  const res = await fetch("https://catbox.moe/user/api.php", {
    method: "POST",
    body: form,
    headers: form.getHeaders(),
    signal: AbortSignal.timeout(15000)
  });
  const text = (await res.text()).trim();
  if (!text.startsWith("https://")) throw new Error("Catbox devolvió una respuesta inválida");
  return text;
}

async function uploadUguu(buffer, mime) {
  const form = new FormData();
  form.append("files[]", buffer, generateUniqueFilename(mime));
  const res = await fetch("https://uguu.se/upload.php", {
    method: "POST",
    body: form,
    headers: form.getHeaders(),
    signal: AbortSignal.timeout(12000)
  });
  const data = await res.json();
  const url = data?.files?.[0]?.url;
  if (!url) throw new Error("Uguu falló");
  return url;
}

async function uploadQuax(buffer, mime) {
  const form = new FormData();
  form.append("file", buffer, { filename: generateUniqueFilename(mime), contentType: mime });
  const res = await fetch("https://qu.ax/upload.php", {
    method: "POST",
    body: form,
    headers: form.getHeaders(),
    signal: AbortSignal.timeout(12000)
  });
  const data = await res.json();
  const url = data?.files?.[0]?.url;
  if (!url) throw new Error("Quax falló");
  return url;
}

async function uploadAuto(buffer, mime) {
  try {
    return { link: await uploadCatbox(buffer, mime), server: "catbox" };
  } catch {
    try {
      return { link: await uploadUguu(buffer, mime), server: "uguu" };
    } catch {
      try {
        return { link: await uploadQuax(buffer, mime), server: "quax" };
      } catch {
        throw new Error("Todos los servidores de carga fallaron.");
      }
    }
  }
}

// ── REGLAS DE MEJORA DE IMAGEN (HD) ──
async function vectorinkEnhanceFromBuffer(inputBuf, inputMime) {
  const API = 'https://us-central1-vector-ink.cloudfunctions.net/upscaleImage';
  const ORIGIN = 'https://vectorink.io';
  const TIMEOUT_MS = 60000;
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  const out = { ok: false, provider: 'vectorink.io' };
  const tmpDir = path.join(os.tmpdir(), 'vectorink');

  try {
    await fsp.mkdir(tmpDir, { recursive: true });
    const b64 = inputBuf.toString('base64');

    const r = await fetch(API, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: '*/*',
        origin: ORIGIN,
        referer: `${ORIGIN}/`,
        'user-agent': UA
      },
      body: JSON.stringify({ data: { image: b64 } }),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });

    if (!r.ok) return out;
    const j = await r.json().catch(() => ({}));
    const innerText = j?.result;
    if (typeof innerText !== 'string' || innerText.length < 10) return out;

    let inner;
    try { inner = JSON.parse(innerText); } catch { return out; }

    const webpB64 = inner?.image?.b64_json;
    if (!webpB64) return out;

    const webpBuf = Buffer.from(webpB64, 'base64');
    const conv = await convertWebpLocally(webpBuf, false);
    if (!conv.ok) return out;

    out.ok = true;
    out.buffer = conv.buffer;
    out.contentType = 'image/png';
    return out;
  } catch {
    return out;
  }
}

// ── SHAZAM HELPERS ──
function getAudioOrVideo(message) {
  const m = message.message || {};
  if (m.audioMessage) return { msg: m.audioMessage, type: 'audio', ext: '.mp3' };
  if (m.videoMessage) return { msg: m.videoMessage, type: 'video', ext: '.mp4' };

  const quoted = m.extendedTextMessage?.contextInfo?.quotedMessage;
  if (!quoted) return null;

  if (quoted.audioMessage) return { msg: quoted.audioMessage, type: 'audio', ext: '.mp3' };
  if (quoted.videoMessage) return { msg: quoted.videoMessage, type: 'video', ext: '.mp4' };

  return null;
}

async function downloadMedia(msg, type) {
  const stream = await downloadContentFromMessage(msg, type);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

// ── COMANDOS DE MEDIOS ──

const cmdToUrl = {
  command: ['tourl', 'upload'],
  category: 'herramientas',
  desc: 'Sube cualquier imagen, video o audio y genera un enlace web.',
  usage: '.tourl [catbox | uguu | quax | auto]',
  run: async (client, m, args, usedPrefix, command) => {
    const q = m.quoted || m;
    const mime = (q.msg || q).mimetype || '';
    if (!mime) {
      return m.reply(`> 📤 *Responde a una imagen, sticker, video o audio con* \`${usedPrefix + command}\` *para convertirlo en un enlace.*\n\n*Servidores:* \`catbox\` (permanente), \`uguu\` (temporal), \`quax\` o \`auto\`.`);
    }

    try {
      await m.react('🕒');
      const media = await q.download();
      if (!media) return m.reply('> ❌ *No se pudo descargar el archivo.*');

      const serverArg = args[0]?.toLowerCase() || "auto";
      let link, server;

      if (serverArg === "catbox") {
        link = await uploadCatbox(media, mime);
        server = "catbox";
      } else if (serverArg === "uguu") {
        link = await uploadUguu(media, mime);
        server = "uguu";
      } else if (serverArg === "quax") {
        link = await uploadQuax(media, mime);
        server = "quax";
      } else {
        const autoRes = await uploadAuto(media, mime);
        link = autoRes.link;
        server = autoRes.server;
      }

      const uploadMessage =
        `📤 *ARCHIVO SUBIDO CON ÉXITO*\n\n` +
        `> 🔗 *Enlace:* ${link}\n` +
        `> 📦 *Peso:* ${formatBytes(media.length)}\n` +
        `> 📁 *Tipo:* \`${mime}\`\n` +
        `> ⚙️ *Servidor:* ${server.toUpperCase()}`;

      await client.sendMessage(m.chat, { text: uploadMessage }, { quoted: m });
      await m.react('✔️');
    } catch (e) {
      await m.react('❌');
      return m.reply(`> ❌ *Error al subir el archivo:*\n[${e.message}]`);
    }
  }
};

const cmdToImg = {
  command: ['toimg', 'toimage'],
  category: 'herramientas',
  desc: 'Convierte un sticker estático o animado a imagen o video.',
  usage: '.toimg (respondiendo a un sticker)',
  run: async (client, m) => {
    if (!m.quoted) {
      return m.reply('> 🧩 *Debes responder a un sticker para convertirlo en imagen o video.*');
    }

    await m.react('🕒');
    try {
      const quoted = m.quoted;
      const buffer = await quoted.download();
      if (!buffer) {
        await m.react('❌');
        return m.reply('> ❌ *No se pudo descargar el sticker.*');
      }

      const isAnimated = Boolean(quoted.msg?.isAnimated || quoted.isAnimated);
      const converted = await convertWebpLocally(buffer, isAnimated);

      if (!converted.ok || !converted.buffer) {
        throw new Error(converted.error || 'Fallo en la conversión local');
      }

      if (isAnimated) {
        await client.sendMessage(m.chat, { video: converted.buffer, caption: '🎬 *Sticker animado convertido a video*', gifPlayback: true }, { quoted: m });
      } else {
        await client.sendMessage(m.chat, { image: converted.buffer, caption: '🖼️ *Sticker convertido a imagen*' }, { quoted: m });
      }

      await m.react('✔️');
    } catch (error) {
      await m.react('❌');
      return m.reply(`> ❌ *Error al convertir el sticker:*\n[${error.message}]`);
    }
  }
};

const cmdHd = {
  command: ['hd', 'enhance', 'remini'],
  category: 'herramientas',
  desc: 'Mejora la resolución y calidad de una imagen.',
  usage: '.hd (respondiendo a una imagen)',
  run: async (client, m, args, usedPrefix, command) => {
    try {
      const q = m.quoted || m;
      const mime = q?.mimetype || q?.msg?.mimetype || '';

      if (!mime || !mime.startsWith('image/')) {
        return m.reply(`> 🖼️ *Por favor, responde a una imagen con* \`${usedPrefix + command}\` *para mejorar su calidad.*`);
      }

      await m.react('🕒');
      const buffer = await q.download?.();
      if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 100) {
        await m.react('❌');
        return m.reply('> ❌ *No se pudo descargar la imagen para mejorar.*');
      }

      const ft = await fileTypeFromBuffer(buffer);
      const inputMime = ft?.mime || mime || 'image/jpeg';
      const result = await vectorinkEnhanceFromBuffer(buffer, inputMime);

      if (!result?.ok || !result?.buffer) {
        await m.react('❌');
        return m.reply('> ❌ *No se pudo mejorar la imagen en este momento.* Los servidores están ocupados.');
      }

      await client.sendMessage(m.chat, { image: result.buffer, caption: '✨ *Imagen mejorada en alta definición (HD)*' }, { quoted: m });
      await m.react('✔️');
    } catch (e) {
      await m.react('❌');
      return m.reply(`> ❌ *Error al mejorar la imagen:*\n[${e.message}]`);
    }
  }
};

const cmdGetPic = {
  command: ['pfp', 'getpic', 'getpp'],
  category: 'herramientas',
  desc: 'Obtiene la foto de perfil en alta resolución de un usuario o grupo.',
  usage: '.getpic [@usuario / cita]',
  run: async (client, m) => {
    const mentioned = m.mentionedJid || [];
    let target = mentioned.length > 0 ? mentioned[0] : (m.quoted ? m.quoted.sender : m.sender);
    if (target.endsWith('@lid')) {
      target = await resolveLidToRealJid(target, client, m.chat);
    }

    try {
      await m.react('🕒');
      const imgUrl = await client.profilePictureUrl(target, 'image').catch(() => null);
      if (!imgUrl) {
        await m.react('❌');
        return client.sendMessage(m.chat, { text: `> ❌ *No se pudo obtener la foto de perfil de @${target.split('@')[0]} (puede tenerla privada o no tener foto).*`, mentions: [target] }, { quoted: m });
      }

      const res = await fetch(imgUrl, { signal: AbortSignal.timeout(10000) });
      const imgBuffer = Buffer.from(await res.arrayBuffer());

      await client.sendMessage(m.chat, {
        image: imgBuffer,
        caption: `🖼️ *Foto de Perfil de @${target.split('@')[0]}*`,
        mentions: [target]
      }, { quoted: m });
      await m.react('✔️');
    } catch (e) {
      await m.react('❌');
      return m.reply(`> ❌ *Error al obtener la foto de perfil:*\n[${e.message}]`);
    }
  }
};

const cmdShazam = {
  command: ['shazam', 'whatmusic', 'songid', 'music'],
  category: 'herramientas',
  desc: 'Identifica la canción que suena en un audio o video.',
  usage: '.music (respondiendo a un audio o video)',
  run: async (client, m) => {
    try {
      const media = getAudioOrVideo(m);
      if (!media) {
        return client.sendMessage(m.chat, { text: '⚠️ *Responde a un audio o video corto para identificar la canción.*' }, { quoted: m });
      }

      await m.react('🕒');
      const buffer = await downloadMedia(media.msg, media.type);

      const res = await acr.identify(buffer);
      const { code, msg } = res.status;
      if (code !== 0) throw new Error(msg || 'No se reconoció la música');
      const music = res.metadata?.music?.[0];
      if (!music) throw new Error('No se encontraron coincidencias');

      const text =
        `🎵 *RECONOCIMIENTO MUSICAL (SHAZAM)*\n\n` +
        `> 🎶 *Canción:* ${music.title || 'Desconocido'}\n` +
        `> 👤 *Artista:* ${music.artists?.map(a => a.name).join(', ') || 'Desconocido'}\n` +
        `> 💿 *Álbum:* ${music.album?.name || 'Desconocido'}\n` +
        `> 📅 *Lanzamiento:* ${music.release_date || 'Desconocido'}`;

      await client.sendMessage(m.chat, { text }, { quoted: m });
      await m.react('✔️');
    } catch (err) {
      await m.react('❌');
      return client.sendMessage(m.chat, { text: `> ❌ *No se pudo identificar la canción:*\n[${err.message || 'Sin coincidencias'}]` }, { quoted: m });
    }
  }
};

export default [cmdToUrl, cmdToImg, cmdHd, cmdGetPic, cmdShazam];
