import axios from 'axios';
import path from 'path';
import cheerio from 'cheerio';
import { lookup } from 'mime-types';
import { getMedia } from './downloader.js';
import { getBotSettings, extractUrl } from '../../utils/tools.js';

export default {
  help: ['gdrive', 'mediafire', 'scribd'],
  command: ['drive', 'gdrive', 'mediafire', 'mf', 'scribd'],
  category: 'downloads',
  desc: 'Comando unificado para descargar archivos de Google Drive, Mediafire y Scribd. Puedes citar un mensaje con enlace.',
  run: async (client, m, args, usedPrefix, command) => {
    const cmd = command.toLowerCase();
    const argsText = args.join(' ').trim();
    const text = extractUrl(m, argsText) || argsText;

    if (['drive', 'gdrive'].includes(cmd)) {
      if (!text) {
        return m.reply(`Envía un enlace de Google Drive o *cita un mensaje* con uno.\n\n*Ejemplo:* \`${usedPrefix + command} https://drive.google.com/...\``);
      }
      if (!text.match(/drive\.google\.com\/(file\/d\/|open\?id=|uc\?id=)/)) {
        return m.reply('La URL no parece válida de Google Drive.');
      }
      try {
        await m.reply('> ⏳ *Obteniendo el archivo de Drive, por favor espera...*');
        const result = await gdriveScraper(text);
        if (!result.status) {
          return m.reply('❌ No se pudo obtener el archivo. Intenta con otro enlace o verifica que sea público.');
        }
        const { fileName, fileSize, mimetype, downloadUrl } = result.data;
        const caption = `۟𝖦oogle 𝖣𝗋𝗂𝗏𝖾　ׅ　✿۟\n\n` + `*Nombre* › ${fileName}\n` + `*Tamaño* › ${fileSize}\n` + `*Tipo* › ${mimetype}\n\n` + `*Enlace* › ${text}`;
        await client.sendMessage(m.chat, { document: { url: downloadUrl }, mimetype, fileName, caption }, { quoted: m });
      } catch (e) {
        return m.reply(`> Error al descargar de Drive.\n[Causa: *${e.message}*]`);
      }
    }

    else if (['mediafire', 'mf'].includes(cmd)) {
      if (!text) {
        return m.reply(`Envía un enlace de Mediafire o un término de búsqueda, o *cita un mensaje* con enlace.\n\n*Ejemplo:* \`${usedPrefix + command} https://mediafire.com/...\``);
      }
      try {
        const isUrl = /^https?:\/\/(www\.)?mediafire\.com\/.+/i.test(text);
        if (!isUrl) {
          await m.reply('> ⏳ *Buscando en Mediafire...*');
          const res = await axios.get(
            `https://api.yuki-wabot.my.id/search/mediafire?query=${encodeURIComponent(text)}&key=YukiBot-MD`
          );
          const data = res.data;
          if (!data?.status || !data.results?.length) {
            return m.reply('❌ No se encontraron resultados para tu búsqueda.');
          }
          let caption = `𝖬𝖾𝖽𝗂𝖺𝖥𝗂𝗋𝖾　ׅ　✿\n\n` + `*Resultados encontrados* › ${data.results.length}\n\n`;
          data.results.forEach((r, i) => {
            caption += `${i + 1}. *Nombre* › ${r.filename}\n` + `${i + 1}. *Tamaño* › ${r.filesize}\n` + `${i + 1}. *Enlace* › ${r.url}\n\n`;
          });
          return m.reply(caption);
        }

        await m.reply('> ⏳ *Obteniendo el archivo de Mediafire...*');
        const scraped = await mediafireDl(text);
        if (!scraped?.downloadLink) return m.reply('❌ El enlace ingresado es inválido.');

        const title = (scraped.filename || 'archivo').trim();
        const ext = path.extname(title) || (scraped.type ? `.${scraped.type}` : '');
        const tipo = lookup((ext || '').toLowerCase()) || 'application/octet-stream';
        const info = `𝖬𝖾𝖽𝗂𝖺𝖥𝗂𝗋𝖾　ׅ　✿\n\n` + `*Nombre* › ${title}\n` + `*Tipo* › ${tipo}\n` + `*Tamaño* › ${scraped.size}\n` + `*Subido* › ${scraped.uploaded}`;

        await client.sendContextInfoIndex(m.chat, info, {}, m, true, null, {
          banner: 'https://cdn.yuki-wabot.my.id/files/5txZ.jpeg',
          title: '𝖬𝖾𝖽𝗂𝖺𝖥𝗂𝗋𝖾　ׅ　✿',
          body: 'Descarga De MF',
          redes: getBotSettings(client).link
        });

        await client.sendMessage(m.chat, { document: { url: scraped.downloadLink }, mimetype: tipo, fileName: title }, { quoted: m });
      } catch (e) {
        return m.reply(`> Error al descargar de Mediafire.\n[Causa: *${e.message}*]`);
      }
    }

    else if (['scribd'].includes(cmd)) {
      if (!text) {
        return m.reply(`> 📄 *Proporciona un enlace de Scribd o cita un mensaje con uno.*\n\n*📌 Ejemplo:* \`${usedPrefix + command} https://es.scribd.com/document/xxxx/yyyy\``);
      }
      if (!text.includes('scribd.com')) {
        return m.reply('> ❌ *Ese no parece ser un enlace válido de Scribd.*');
      }
      try {
        await m.reply('> ⏳ *Obteniendo el documento de Scribd...*');
        const media = await getMedia('scribd', text);
        if (!media || !media.url) {
          return m.reply('> ❌ *Lo siento, no pude obtener el documento en este momento.*');
        }
        const caption = `> 📄 *Documento Descargado*\n\n*Título:* ${media.title || 'Scribd Document'}`;
        await client.sendFile(m.chat, media.url, `${media.title || 'Documento_Scribd'}.pdf`, caption, m, false, { asDocument: true });
      } catch (e) {
        await m.reply(`> ⚠️ *Error al descargar de Scribd.*\n[Causa: *${e.message}*]`);
      }
    }
  }
};

// --- Google Drive Helper ---
async function gdriveScraper(url) {
  try {
    let id = (url.match(/\/?id=(.+)/i) || url.match(/\/d\/(.*?)\//))[1];
    if (!id) throw new Error('No se encontró ID de descarga');
    let res = await axios.post(`https://drive.google.com/uc?id=${id}&authuser=0&export=download`, null, {
      headers: {
        'accept-encoding': 'gzip, deflate, br',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        origin: 'https://drive.google.com',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/65.0.3325.181 Safari/537.36',
        'x-drive-first-party': 'DriveWebUi',
        'x-json-requested': 'true'
      }
    });
    const cleanData = typeof res.data === 'string' && res.data.startsWith(")]}'") ? res.data.slice(4) : res.data;
    let parsed = typeof cleanData === 'string' ? JSON.parse(cleanData) : cleanData;
    let { fileName, sizeBytes, downloadUrl } = parsed;
    if (!downloadUrl) throw new Error('Se excedió el número de descargas del link');
    
    let testRes = await axios.get(downloadUrl, { headers: { Range: 'bytes=0-0' } });
    const mime = testRes.headers['content-type'];
    return {
      status: true,
      data: { downloadUrl, fileName, fileSize: `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`, mimetype: mime }
    };
  } catch (error) {
    return { status: false, message: error.message };
  }
}

// --- Mediafire Helper ---
const MF_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function mfCleanText(x) {
  return String(x || '').replace(/\s+/g, ' ').trim();
}

function mfNormalizeUrl(u) {
  const s = mfCleanText(u);
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('//')) return 'https:' + s;
  if (s.startsWith('/')) return 'https://www.mediafire.com' + s;
  return s;
}

async function mediafireDl(url, timeout = 45000) {
  const mediafireUrl = mfCleanText(url);
  if (!mediafireUrl) throw new Error('URL requerida');
  const res = await axios.get(mediafireUrl, {
    timeout,
    maxRedirects: 5,
    headers: {
      'User-Agent': MF_UA,
      'Accept-Language': 'en-US,en;q=0.9',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    },
    validateStatus: () => true
  });
  if (res.status < 200 || res.status >= 400) {
    throw new Error(`MediaFire HTTP ${res.status}`);
  }
  const $ = cheerio.load(String(res.data || ''));
  const downloadLinkRaw = $('#downloadButton').attr('href') || $('a#downloadButton').attr('href') || null;
  const downloadLink = mfNormalizeUrl(downloadLinkRaw);
  if (!downloadLink) throw new Error('Download link not found');

  let filename = mfCleanText($('.intro .filename').text()) || mfCleanText($('meta[property="og:title"]').attr('content')) || mfCleanText($('title').text()) || null;
  let filetype = mfCleanText($('.filetype').text()) || null;
  let size = null;
  let uploaded = null;
  $('ul.details li').each((_, el) => {
    const text = mfCleanText($(el).text());
    if (!size && /File size:/i.test(text)) size = mfCleanText($(el).find('span').text()) || null;
    if (!uploaded && /Uploaded:/i.test(text)) uploaded = mfCleanText($(el).find('span').text()) || null;
  });
  const m = String(filename).match(/\.([a-z0-9]{1,10})$/i);
  const type = m?.[1]?.toLowerCase() || (filetype ? mfCleanText(filetype).toLowerCase() : null);

  return { downloadLink, filename, filetype, size, uploaded, type };
}
