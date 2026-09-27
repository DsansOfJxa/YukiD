import { extractUrl } from '../../utils/tools.js';
import yts from 'yt-search';

// Lista de instancias públicas de Cobalt API para alta disponibilidad
const COBALT_INSTANCES = [
  'https://cobalt-api.kwiatekmokry.pl',
  'https://api.cobalt.tools',
  'https://cobalt.qal.jp',
  'https://co.wuk.sh'
];

async function fetchFromCobalt(youtubeUrl, isAudioOnly = false) {
  let lastError = null;

  for (const instance of COBALT_INSTANCES) {
    try {
      const response = await fetch(`${instance}/`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: youtubeUrl,
          downloadMode: isAudioOnly ? 'audio' : 'auto',
          audioFormat: 'mp3'
        })
      });

      if (!response.ok) continue;

      const data = await response.json();

      if (data.url) return data.url;
      if (data.status === 'stream' || data.status === 'redirect') return data.url;
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(lastError ? lastError.message : 'Todas las instancias de descarga fallaron.');
}

export default {
  help: ['play', 'play2', 'ytsearch'],
  command: ['play', 'p', 'mp3', 'p3', 'ytaudio', 'play2', 'mp4', 'ytv', 'video', 'ytsearch', 'search', 'yts'],
  category: 'downloads',
  heavy: true,
  desc: 'Comando unificado de YouTube.',
  run: async (client, m, args, usedPrefix, command) => {
    const cmd = command.toLowerCase();
    const text = args.join(' ').trim();

    if (['ytsearch', 'search', 'yts'].includes(cmd)) {
      if (!text) return m.reply('> 🔎 *Ingrese un término de búsqueda.*');
      try {
        const ress = await yts(text);
        const armar = ress.all;
        if (!armar?.length) return m.reply('No se encontraron resultados.');
        
        let teks2 = armar.map((v) => {
          switch (v.type) {
            case 'video':
              return `➩ *Título ›* *${v.title}* \n*Duración ›* ${v.timestamp}\n*Subido ›* ${v.ago}\n✿ *Vistas ›* ${v.views}\n❒ *Url ›* ${v.url}`.trim();
            case 'channel':
              return `Canal › *${v.name}*\n❒ Url › ${v.url}\nSubscriptores › ${v.subCountLabel} (${v.subCount})\n✿ Videos totales › ${v.videoCount}`.trim();
          }
        }).filter((v) => v).join('\n\n╾۪〬─ ┄۫╌ ׄ┄┈۪ ─〬 ׅ┄╌ ۫... ─ׄ─۪〬 ┈ ┄۫╌ ┈┄۪ ─ׄ〬\n\n');

        await client.sendMessage(m.chat, { image: { url: armar[0].image }, caption: teks2 }, { quoted: m });
      } catch (e) {
        m.reply(`> Error al buscar en YouTube.\n[Causa: *${e.message}*]`);
      }
      return;
    }

    let url = extractUrl(m, text);
    let title = 'media';
    if (!url && text) {
      const search = await yts(text);
      if (search && search.videos.length > 0) {
        url = search.videos[0].url;
        title = search.videos[0].title;
      }
    }

    if (!url) {
      const exCmd = ['play', 'p', 'mp3', 'p3', 'ytaudio'].includes(cmd) ? 'audio' : 'video';
      return m.reply(`> 🎵 *Proporciona un enlace o búsqueda para ${exCmd}.*`);
    }

    // AUDIO (/play)
    if (['play', 'p', 'mp3', 'p3', 'ytaudio'].includes(cmd)) {
      try {
        await m.reply('> ⏳ Obteniendo el audio, por favor espera...');

        const downloadUrl = await fetchFromCobalt(url, true);

        await client.sendMessage(m.chat, { 
          audio: { url: downloadUrl }, 
          mimetype: 'audio/mpeg',
          fileName: `${title}.mp3`,
          ptt: false
        }, { quoted: m });

      } catch (e) {
        await m.reply(`> ⚠️ *Ocurrió un error al procesar el audio.*\n[Causa: *${e.message}*]`);
      }

    // VIDEO (/play2)
    } else if (['play2', 'mp4', 'ytv', 'video'].includes(cmd)) {
      try {
        await m.reply('> ⏳ Obteniendo el video, por favor espera...');

        const downloadUrl = await fetchFromCobalt(url, false);

        await client.sendMessage(m.chat, { 
          video: { url: downloadUrl }, 
          caption: `🎬 *Video Descargado*\n\n• *Título:* ${title}`,
          mimetype: 'video/mp4'
        }, { quoted: m });

      } catch (e) {
        await m.reply(`> ⚠️ *Ocurrió un error al procesar el video.*\n[Causa: *${e.message}*]`);
      }
    }
  }
};
