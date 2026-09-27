import { extractUrl } from '../../utils/tools.js';
import yts from 'yt-search';
import axios from 'axios';

export default {
  help: ['play', 'play2'],
  command: ['play', 'p', 'mp3', 'play2', 'mp4', 'video'],
  category: 'downloads',
  heavy: true,
  desc: 'Descargas de YouTube mediante API externa limpia.',
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

    // Lista de endpoints públicos alternativos para máxima fiabilidad
    const instances = [
      'https://api.cobalt.tools',
      'https://cobalt-api.kwiatek.xyz',
      'https://api.wuk.sh'
    ];

    let downloadUrl = null;
    let lastError = '';

    for (const apiUrl of instances) {
      try {
        const { data } = await axios.post(apiUrl, {
          url: url,
          downloadMode: isAudio ? 'audio' : 'auto',
          audioFormat: 'mp3',
          videoQuality: '720'
        }, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
          },
          timeout: 15000 // 15 segundos máximo por endpoint
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
        lastError = err.response?.data?.text || err.message;
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
      await m.reply(`> ⚠️ *Error al enviar el archivo a WhatsApp.*\n[Causa: *${e.message}*]`);
    }
  }
};
