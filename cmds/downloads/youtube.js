import { extractUrl } from '../../utils/tools.js';
import yts from 'yt-search';
import https from 'https';

function requestJSON(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Origin': 'https://cobalt.tools',
        'Referer': 'https://cobalt.tools/',
        ...options.headers
      },
      timeout: 10000
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          reject(new Error(`HTTP ${res.statusCode}: Respuesta no JSON`));
        }
      });
    });

    req.on('error', err => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Tiempo de espera agotado'));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
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

    let downloadUrl = null;
    let lastError = '';

    // 1. Intento con instancias públicas de Cobalt (con cabeceras completas)
    const cobaltInstances = [
      'https://api.cobalt.tools',
      'https://cobalt-api.kwiatek.xyz',
      'https://api.wuk.sh'
    ];

    for (const apiUrl of cobaltInstances) {
      try {
        const data = await requestJSON(apiUrl, { method: 'POST' }, {
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
        lastError = err.message;
      }
    }

    // 2. Respaldos alternativos si Cobalt no responde
    if (!downloadUrl) {
      try {
        // Fallback a API pública de Invidious / Ytdl
        const invidiousApi = `https://inv.hostux.net/api/v1/videos/${url.split('v=')[1] || url.split('/').pop()}`;
        const videoData = await requestJSON(invidiousApi);

        if (isAudio && videoData.adaptiveFormats) {
          const audioStream = videoData.adaptiveFormats.find(f => f.type?.includes('audio'));
          if (audioStream) downloadUrl = audioStream.url;
        } else if (videoData.formatStreams) {
          const videoStream = videoData.formatStreams.reverse().find(f => f.url);
          if (videoStream) downloadUrl = videoStream.url;
        }
      } catch (e) {
        // Ignorar fallo de Invidious
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
