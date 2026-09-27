import { extractUrl } from '../../utils/tools.js';
import yts from 'yt-search';

export default {
  help: ['play', 'play2'],
  command: ['play', 'p', 'mp3', 'play2', 'mp4', 'video'],
  category: 'downloads',
  heavy: true,
  desc: 'Descargas de YouTube mediante API externa gratuita.',
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
      return m.reply('> 🎵 *Proporciona un enlace o nombre para buscar.*');
    }

    const isAudio = ['play', 'p', 'mp3'].includes(cmd);
    await m.reply(`> ⏳ Procesando ${isAudio ? 'audio' : 'video'}, por favor espera...`);

    try {
      // Petición a la API pública de Cobalt
      const response = await fetch('https://api.cobalt.tools/', {
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

      if (data.status === 'stream' || data.status === 'redirect') {
        const fileUrl = data.url;

        if (isAudio) {
          await client.sendMessage(m.chat, {
            audio: { url: fileUrl },
            mimetype: 'audio/mpeg',
            fileName: `${title}.mp3`,
            ptt: false
          }, { quoted: m });
        } else {
          await client.sendMessage(m.chat, {
            video: { url: fileUrl },
            caption: `🎬 *Video Descargado*\n\n• *Título:* ${title}`,
            mimetype: 'video/mp4'
          }, { quoted: m });
        }
      } else {
        return m.reply('> ❌ No se pudo obtener el enlace de descarga directo.');
      }

    } catch (e) {
      console.error(e);
      await m.reply(`> ⚠️ *Ocurrió un error al procesar el enlace.*\n[Causa: *${e.message}*]`);
    }
  }
};
