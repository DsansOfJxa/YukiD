import { extractUrl } from '../../utils/tools.js';
import yts from 'yt-search';
import https from 'https';

function postJSON(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (e) {
      return reject(new Error('URL de API inválida'));
    }

    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      timeout: 8000
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData));
        } catch (e) {
          reject(new Error('Respuesta no válida'));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Tiempo de espera agotado'));
    });

    req.write(data);
    req.end();
  });
}

export default {
  help: ['play', 'play2'],
  command: ['play', 'p', 'mp3', 'play2', 'mp4', 'video'],
  category: 'downloads',
  heavy: true,
  desc: 'Descargas de YouTube mediante API externa.',
  run: async (client, m, args, usedPrefix, command) => {
    const cmd = command.toLowerCase();
    const text = args.join(' ').trim();

    let url = extractUrl(m, text);
    let title = 'contenido';

    if (!url && text) {
      const search = await yts(text);
      if (search && search.videos.length > 0) {
        url = search.videos[0].url;
        title = search.videos[0].title;
      }
    }

    if (!url) {
      return m.reply('> 🎵 *Proporciona un enlace o término de búsqueda.*');
    }

    const isAudio = ['play', 'p', 'mp3'].includes(cmd);
    await m.reply(`> ⏳ Procesando ${isAudio ? 'audio' : 'video'}, por favor espera...`);

    // Instancias públicas actualizadas de Cobalt
    const instances = [
      'https://api.cobalt.tools/',
      'https://cobalt.api.scity.icu/',
      'https://cobalt.tools/api/'
    ];

    let downloadUrl = null;
    let lastError = '';

    for (const apiUrl of instances) {
      try {
        const data = await postJSON(apiUrl, {
          url: url,
          downloadMode: isAudio ? 'audio' : 'auto',
          audioFormat: 'mp3',
          videoQuality: '720'
        });

        if (['stream', 'redirect', 'tunnel'].includes(data.status) && data.url) {
          downloadUrl = data.url;
          break;
        } else if (data.status === 'picker' && data.picker?.length > 0) {
          downloadUrl = data.picker[0].url;
          break;
        } else if (data.text) {
          lastError = data.text;
        }
      } catch (err) {
        // Ignorar fallos de DNS/red y probar con la siguiente instancia de la lista
        lastError = err.message;
        continue;
      }
    }

    if (!downloadUrl) {
      return m.reply(`> ❌ No se pudo procesar la descarga.\n[Detalle: *${lastError || 'Servidores no disponibles'}*]`);
    }

    try {
      if (isAudio) {
        await client.sendMessage(m.chat, {
          audio: { url: downloadUrl },
          mimetype: 'audio/mpeg',
          fileName: `${title}.mp3`,
          ptt: false
        }, { quoted: m });
      } else {
        await client.sendMessage(m.chat, {
          video: { url: downloadUrl },
          caption: `🎬 *Video Descargado*\n\n• *Título:* ${title}`,
          mimetype: 'video/mp4'
        }, { quoted: m });
      }
    } catch (e) {
      await m.reply(`> ⚠️ *Error al enviar a WhatsApp.*\n[Causa: *${e.message}*]`);
    }
  }
};
