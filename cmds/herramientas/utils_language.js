/**
 * 🌐 utils_language.js — Comandos lingüísticos, traducción, OCR e Inteligencia Artificial.
 * Reúne: chatgpt (ia), ocr, translate (tr), say
 */
import { getAIResponse, DEFAULT_AI_SYSTEM_PROMPT } from '../../utils/ai.js';
import { getBotId, getGroupMeta } from '../../utils/tools.js';
import translateGoogle from '@vitalets/google-translate-api';

const LANG_MAP = {
  es: 'es', español: 'es', espanol: 'es', spanish: 'es',
  en: 'en', ingles: 'en', inglés: 'en', english: 'en',
  pt: 'pt', portugués: 'pt', portugues: 'pt', portuguese: 'pt',
  fr: 'fr', francés: 'fr', frances: 'fr', french: 'fr',
  de: 'de', alemán: 'de', aleman: 'de', german: 'de',
  it: 'it', italiano: 'it', italian: 'it',
  ru: 'ru', ruso: 'ru', russian: 'ru',
  ja: 'ja', japonés: 'ja', japones: 'ja', japanese: 'ja',
  zh: 'zh-CN', chino: 'zh-CN', chinese: 'zh-CN',
  ko: 'ko', coreano: 'ko', korean: 'ko',
  ar: 'ar', árabe: 'ar', arabe: 'ar', arabic: 'ar',
  hi: 'hi', hindi: 'hi'
};

const CODE_LANGS = {
  typescript: 'ts', javascript: 'js', python: 'py', html: 'html', css: 'css',
  java: 'java', cpp: 'cpp', c: 'c', json: 'json', bash: 'sh', sql: 'sql',
  rust: 'rs', go: 'go', php: 'php', ruby: 'rb'
};

function detectLanguage(query, response) {
  const q = String(query || '').toLowerCase();
  const r = String(response || '');
  if (/typescript/i.test(q)) return 'typescript';
  if (/\bpython\b/i.test(q)) return 'python';
  if (/\bhtml\b/i.test(q)) return 'html';
  if (/\bcss\b/i.test(q)) return 'css';
  if (/\bjava\b(?!script)/i.test(q)) return 'java';
  if (/\bc\+\+|cpp\b/i.test(q)) return 'cpp';
  if (/\bjson\b/i.test(q)) return 'json';
  if (/\bbash\b|\bshell\b/i.test(q)) return 'bash';
  if (/\bsql\b/i.test(q)) return 'sql';
  if (/\brust\b/i.test(q)) return 'rust';
  if (/\bgolang\b|\bgo\b/i.test(q)) return 'go';
  if (/\bphp\b/i.test(q)) return 'php';
  if (/\bruby\b/i.test(q)) return 'ruby';
  if (/javascript/i.test(q)) return 'javascript';
  const asksCode = /(c[oó]digo|code|programa|script|funci[oó]n|clase|m[eé]todo|algoritmo|actualiza|edita|crea|implementa)/i.test(q);
  if (!asksCode) return null;
  if (/def |import \w+\n|print\s*\(|:\n\s{4}/i.test(r)) return 'python';
  if (/<html|<div|<body|<span|<head/i.test(r)) return 'html';
  if (/\{[\s\S]*color:|margin:|padding:|font-/i.test(r)) return 'css';
  if (/public\s+class|System\.out\.print/i.test(r)) return 'java';
  if (/#include\s*<|int main\s*\(/i.test(r)) return 'cpp';
  if (/SELECT |INSERT |UPDATE |DELETE |CREATE TABLE/i.test(r)) return 'sql';
  if (/fn main\(\)|let mut |println!\(/i.test(r)) return 'rust';
  if (/func \w+\(|package main|fmt\.Print/i.test(r)) return 'go';
  if (/<\?php|\$[a-z_]+\s*=/i.test(r)) return 'php';
  if (/def initialize|\.each do |puts /i.test(r)) return 'ruby';
  if (/\{["'][\w]+["']\s*:/i.test(r) && !/function|const|let|var/.test(r)) return 'json';
  if (/function|class\s+\w|const |let |var |=>|\bimport\b|\bexport\b|console\.log/i.test(r)) {
    return /:\s*(string|number|boolean|void|any)\b|interface\s+\w|<\w+>/i.test(r) ? 'typescript' : 'javascript';
  }
  return null;
}

// Subida de imagen para visión IA (Catbox / Uguu)
async function uploadMediaForAI(buffer, mimetype) {
  try {
    const form = new FormData();
    const extension = mimetype.split('/')[1] || 'jpg';
    form.append('files[]', new Blob([buffer]), `file.${extension}`);
    const res = await fetch('https://uguu.se/upload.php', { method: 'POST', body: form, signal: AbortSignal.timeout(8000) });
    const json = await res.json();
    return json.files?.[0]?.url ?? null;
  } catch {
    return null;
  }
}

// Fallback de traducción directa con Google Translate Web API
async function fallbackGoogleTranslate(text, targetLang) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (Array.isArray(data?.[0])) {
    return data[0].map(item => item[0]).filter(Boolean).join('');
  }
  throw new Error('Formato de traducción inválido');
}

const cmdChatGPT = {
  command: ['ia', 'chatgpt', 'gemini', 'ai', 'llama', 'deepseek', 'copilot', 'perplexity'],
  category: 'herramientas',
  desc: 'Asistente de Inteligencia Artificial (DeepSeek, Gemini, Copilot, Perplexity, LLaMA, ChatGPT).',
  usage: '.ia [pregunta / cita imagen]',
  run: async (client, m, args, usedPrefix, command) => {
    let text = args.join(' ').trim();
    if (!text && m.quoted) {
      text = (m.quoted.text || m.quoted.caption || m.quoted.body || '').trim();
    }
    if (!text) {
      return m.reply(`> 🤖 *Escribe una pregunta o petición para la IA.*\n\n*📌 Ejemplo:* \`${usedPrefix + command} ¿Qué es la teoría de cuerdas?\``);
    }

    const basePrompt = DEFAULT_AI_SYSTEM_PROMPT;

    try {
      await m.react('🕒');

      let imageBuffer = null;
      const quotedMsg = m.quoted ? m.quoted : null;
      if (quotedMsg && (quotedMsg.message?.imageMessage || quotedMsg.message?.videoMessage || quotedMsg.mtype === 'imageMessage' || quotedMsg.mtype === 'videoMessage')) {
        const media = quotedMsg.message?.imageMessage || quotedMsg.message?.videoMessage || quotedMsg;
        const buffer = await quotedMsg.download().catch(() => null);
        if (buffer && buffer.length > 0) {
          const uploadUrl = await uploadMediaForAI(buffer, media.mimetype || 'image/jpeg');
          if (uploadUrl) imageBuffer = uploadUrl;
        }
      }

      const responseText = await getAIResponse({ content: text, prompt: basePrompt, user: m.sender, imageBuffer, preferredProvider: command });

      if (!responseText || !responseText.trim()) {
        throw new Error('Los servidores de IA no devolvieron contenido válido.');
      }

      const clean = responseText.trim();
      const lang = detectLanguage(text, clean);

      if (lang && typeof client.sendCodeMessage === 'function') {
        const ext = CODE_LANGS[lang] ?? 'txt';
        const filename = `codigo.${ext}`;
        const tableData = {
          title: `✎ ${botname} IA`,
          headers: ['Lenguaje', 'Líneas', 'Caracteres'],
          rows: [[lang, String(clean.split('\n').length), String(clean.length)]]
        };
        await client.sendCodeMessage(m.chat, filename, clean, m, tableData);
      } else {
        await client.sendMessage(m.chat, { text: clean }, { quoted: m });
      }

      await m.react('✔️');
    } catch (error) {
      await m.react('❌');
      return m.reply(`> ❌ *No se pudo obtener respuesta de la IA en este momento.*\n[Causa: *${error.message || 'Error de conexión'}*]`);
    }
  }
};

const cmdOcr = {
  command: ['ocr', 'texto', 'escaner'],
  category: 'herramientas',
  desc: 'Extraer texto de una imagen escaneada.',
  usage: '.ocr [idioma] (respondiendo a una imagen)',
  run: async (client, m, args) => {
    let q = m.quoted ? m.quoted : m;
    let mime = (q.msg || q).mimetype || '';
    if (!mime.startsWith('image/')) {
      return m.reply('> 📷 *Por favor, responde a una imagen con texto legible usando este comando.*');
    }

    try {
      await m.react('🕒');
      const buffer = await q.download();
      if (!buffer || buffer.length === 0) {
        return m.reply('> ❌ *No se pudo descargar la imagen para escanear.*');
      }

      const targetLang = (args[0] && LANG_MAP[args[0].toLowerCase()]) ? LANG_MAP[args[0].toLowerCase()] : 'spa';

      const form = new FormData();
      form.append('apikey', 'helloworld');
      form.append('file', new Blob([buffer], { type: 'image/jpeg' }), 'imagen.jpg');
      form.append('language', targetLang === 'es' ? 'spa' : (targetLang === 'en' ? 'eng' : targetLang));
      form.append('isOverlayRequired', 'false');
      form.append('detectOrientation', 'true');
      form.append('scale', 'true');

      const res = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(25000)
      });
      const data = await res.json();

      if (data.IsErroredOnProcessing || !data.ParsedResults?.[0]) {
        await m.react('❌');
        return m.reply('> ⚠️ *No se detectó texto legible en la imagen o el servidor OCR está temporalmente ocupado.*');
      }

      const parsedText = (data.ParsedResults[0].ParsedText || '').trim();
      if (!parsedText) {
        await m.react('❌');
        return m.reply('> ⚠️ *La imagen fue procesada pero no se encontraron caracteres legibles.*');
      }

      const formatted = `🔎 *TEXTO EXTRAÍDO (OCR)*\n──────────────────\n${parsedText}`;
      await client.sendMessage(m.chat, { text: formatted }, { quoted: m });
      await m.react('✔️');
    } catch (e) {
      await m.react('❌');
      return m.reply(`> ❌ *Ocurrió un error al procesar el OCR:*\n[${e.message}]`);
    }
  }
};

const cmdTranslate = {
  command: ['tr', 'translate', 'trad', 'traducir'],
  category: 'herramientas',
  desc: 'Traduce texto a cualquier idioma.',
  usage: '.tr <idioma> <texto> o responde a un mensaje con .tr <idioma>',
  run: async (client, m, args, usedPrefix, command) => {
    let targetLang = 'es';
    let textToTranslate = '';

    const firstArg = (args[0] || '').toLowerCase();
    if (LANG_MAP[firstArg] || (firstArg.length === 2 && /^[a-z]{2}$/.test(firstArg))) {
      targetLang = LANG_MAP[firstArg] || firstArg;
      textToTranslate = args.slice(1).join(' ').trim();
    } else {
      textToTranslate = args.join(' ').trim();
    }

    if (!textToTranslate && m.quoted) {
      textToTranslate = (m.quoted.text || m.quoted.caption || m.quoted.body || '').trim();
    }

    if (!textToTranslate) {
      return m.reply(
        `> 🌐 *Por favor, ingresa el texto a traducir o responde a un mensaje.*\n\n` +
        `*📌 Ejemplo:* \`${usedPrefix + command} en Hola, ¿cómo estás?\`\n` +
        `*📌 Ejemplo:* \`${usedPrefix + command} fr Buenos días amigos\``
      );
    }

    try {
      await m.react('🕒');
      let translatedText = '';

      // Intento 1: Librería principal
      try {
        const result = await translateGoogle(textToTranslate, { to: targetLang, autoCorrect: true });
        translatedText = result.text;
      } catch {
        // Intento 2: Fallback directo a Google Translate Web API
        translatedText = await fallbackGoogleTranslate(textToTranslate, targetLang);
      }

      if (!translatedText) throw new Error('No se recibió texto traducido.');

      const caption =
        `🌐 *TRADUCCIÓN [${targetLang.toUpperCase()}]*\n\n` +
        `${translatedText.trim()}`;

      await client.sendMessage(m.chat, { text: caption }, { quoted: m });
      await m.react('✔️');
    } catch (e) {
      await m.react('❌');
      return m.reply(`> ❌ *Error al traducir el texto:*\n[${e.message}]`);
    }
  }
};

const cmdSay = {
  command: ['say', 'decir', 'repetir'],
  category: 'herramientas',
  desc: 'Repite un mensaje o reenvía multimedia de forma anónima.',
  usage: '.say <texto> o responde a multimedia con .say',
  run: async (client, m, args) => {
    const groupMetadata = m.isGroup ? await getGroupMeta(client, m.chat) : null;
    const groupParticipants = groupMetadata?.participants || [];
    const allMentions = groupParticipants.map(p => client.decodeJid(p.jid || p.id || p.lid || p.phoneNumber)).filter(Boolean);
    const userText = (args.join(' ') || '').trim();
    const src = m.quoted || m;
    const hasImage = Boolean(src.message?.imageMessage || src.mtype === 'imageMessage');
    const hasVideo = Boolean(src.message?.videoMessage || src.mtype === 'videoMessage');
    const hasAudio = Boolean(src.message?.audioMessage || src.mtype === 'audioMessage');
    const hasSticker = Boolean(src.message?.stickerMessage || src.mtype === 'stickerMessage');
    const originalText = (src.caption || src.text || src.body || '').trim();
    const textToCheck = (userText || originalText || '').trim();
    const explicitMentions = allMentions.filter(jid => textToCheck.includes(jid.split('@')[0]));

    try {
      const options = { quoted: null, mentions: explicitMentions.length ? explicitMentions : [] };
      if (hasImage || hasVideo) {
        const media = await src.download();
        if (hasImage) {
          return client.sendMessage(m.chat, { image: media, caption: textToCheck || '', ...options });
        } else {
          return client.sendMessage(m.chat, { video: media, mimetype: 'video/mp4', caption: textToCheck || '', ...options });
        }
      }
      if (hasAudio) {
        const media = await src.download();
        return client.sendMessage(m.chat, { audio: media, mimetype: 'audio/mp4', fileName: 'audio.mp3', ...options });
      }
      if (hasSticker) {
        const media = await src.download();
        return client.sendMessage(m.chat, { sticker: media, ...options });
      }
      if (textToCheck) {
        return client.sendMessage(m.chat, { text: textToCheck, ...options });
      }
      return m.reply('> 💬 *Por favor, escribe el texto que deseas repetir o responde a un archivo multimedia.*');
    } catch (e) {
      return m.reply(`> ❌ *Error al ejecutar el comando:*\n[${e.message}]`);
    }
  }
};

export default [cmdChatGPT, cmdOcr, cmdTranslate, cmdSay];
