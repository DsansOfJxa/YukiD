import { extractUrl } from '../../utils/tools.js';
import yts from 'yt-search';

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

    // Lista de instancias públicas de Cobalt para redundancia
    const instances = [
      'https://api.cobalt.tools/',
      'https://cobalt-api.kwiatek.xyz/',
      'https://api.wuk.sh/'
    ];

    let downloadUrl = null;
    let lastError = '';

    for (const apiUrl of instances) {
      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            url: url,
            downloadMode: isAudio ? 'audio' : 'auto',
            audioFormat: 'mp3',
            videoQuality: '720'
          })
        });

        const data = await response.json();

        // Cobalt puede devolver 'stream', 'redirect', 'tunnel' o 'picker'
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

    if (!downloadUrl) {
      return m.reply(`> ❌ No se pudo procesar la descarga en este momento.\n[Detalle: *${lastError || 'Servidores ocupados'}*]`);
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
