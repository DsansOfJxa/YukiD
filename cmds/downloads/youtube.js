import { extractUrl } from '../../utils/tools.js';
import yts from 'yt-search';

async function getMediaUrl(youtubeUrl, isAudio = true) {
  // Servicio alternativo de extracción por API
  const apiUrl = `https://api.vreden.web.id/api/ytmp3?url=${encodeURIComponent(youtubeUrl)}`;
  const res = await fetch(apiUrl);
  if (!res.ok) throw new Error('Falló el servidor de conversión.');
  
  const data = await res.json();
  if (data?.result?.download?.url) {
    return data.result.download.url;
  }
  
  // Respaldo secundario si falla la primera API
  const backupApi = `https://api.lolhuman.xyz/api/ytaudio2?apikey=GataDios&url=${encodeURIComponent(youtubeUrl)}`;
  const res2 = await fetch(backupApi);
  if (res2.ok) {
    const data2 = await res2.json();
    if (data2?.result?.link) return data2.result.link;
  }

  throw new Error('No se pudo extraer el enlace de descarga.');
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
        }).filter((v) => v).join('\n\n╾۪〬─ ┄۫╌ ׄ┄┈۪ ─ challenge ─ׄ─۪〬 ┈ ┄۫╌ ┈┄۪ ─ׄ〬\n\n');

        await client.sendMessage(m.chat, { image: { url: armar[0].image }, caption: teks2 }, { quoted: m });
      } catch (e) {
        m.reply(`> Error al buscar en YouTube.\n[Causa: *${e.message}*]`);
      }
      return;
    }

    let url = extractUrl(m, text);
    let title = 'audio_download';
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

    if (['play', 'p', 'mp3', 'p3', 'ytaudio'].includes(cmd)) {
      try {
        await m.reply('> ⏳ Descargando audio...');
        const dlUrl = await getMediaUrl(url, true);

        await client.sendMessage(m.chat, { 
          audio: { url: dlUrl }, 
          mimetype: 'audio/mpeg',
          fileName: `${title}.mp3`,
          ptt: false
        }, { quoted: m });

      } catch (e) {
        await m.reply(`> ⚠️ *Ocurrió un error al procesar el audio.*\n[Causa: *${e.message}*]`);
      }
    }
  }
};
