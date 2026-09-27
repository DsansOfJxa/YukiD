import { extractUrl } from '../../utils/tools.js';
import yts from 'yt-search';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

// Importar el binario estático de ffmpeg
import ffmpegPath from 'ffmpeg-static';

const execPromise = promisify(exec);

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
    let title = 'audio';
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

    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const timestamp = Date.now();

    const cookiesPath = path.join(process.cwd(), 'cookies.txt');
    const cookieFlag = fs.existsSync(cookiesPath) ? `--cookies "${cookiesPath}"` : '';
    const ffmpegFlag = ffmpegPath ? `--ffmpeg-location "${ffmpegPath}"` : '';

    // AUDIO (/play)
    if (['play', 'p', 'mp3', 'p3', 'ytaudio'].includes(cmd)) {
      const outputPath = path.join(tmpDir, `audio_${timestamp}.mp3`);
      try {
        await m.reply('> ⏳ Obteniendo el audio, por favor espera...');

        const ytCmd = `python3 -m yt_dlp ${cookieFlag} ${ffmpegFlag} --no-check-certificates --extractor-args "youtube:player_client=mweb" -f "ba/b" -x --audio-format mp3 -o "${outputPath}" "${url}"`;
        await execPromise(ytCmd);

        if (fs.existsSync(outputPath)) {
          await client.sendMessage(m.chat, { 
            audio: fs.readFileSync(outputPath), 
            mimetype: 'audio/mpeg',
            fileName: `${title}.mp3`,
            ptt: false
          }, { quoted: m });

          fs.unlinkSync(outputPath);
        } else {
          return m.reply('> ❌ No se pudo generar el archivo de audio.');
        }

      } catch (e) {
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        await m.reply(`> ⚠️ *Ocurrió un error al procesar el audio.*\n[Causa: *${e.message}*]`);
      }

    // VIDEO (/play2)
    } else if (['play2', 'mp4', 'ytv', 'video'].includes(cmd)) {
      const outputPath = path.join(tmpDir, `video_${timestamp}.mp4`);
      try {
        await m.reply('> ⏳ Obteniendo el video, por favor espera...');

        const ytCmd = `python3 -m yt_dlp ${cookieFlag} ${ffmpegFlag} --no-check-certificates --extractor-args "youtube:player_client=mweb" -f "b[ext=mp4]/b" -o "${outputPath}" "${url}"`;
        await execPromise(ytCmd);

        if (fs.existsSync(outputPath)) {
          await client.sendMessage(m.chat, { 
            video: fs.readFileSync(outputPath), 
            caption: `🎬 *Video Descargado*\n\n• *Título:* ${title}`,
            mimetype: 'video/mp4'
          }, { quoted: m });

          fs.unlinkSync(outputPath);
        } else {
          return m.reply('> ❌ No se pudo generar el archivo de video.');
        }

      } catch (e) {
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        await m.reply(`> ⚠️ *Ocurrió un error al procesar el video.*\n[Causa: *${e.message}*]`);
      }
    }
  }
};
