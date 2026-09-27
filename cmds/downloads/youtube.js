import { extractUrl } from '../../utils/tools.js';
import yts from 'yt-search';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

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

    // =========================================================================
    // 1. MOTOR DE BÚSQUEDA DE YOUTUBE (.ytsearch)
    // =========================================================================
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

    // =========================================================================
    // 2. EXTRACCIÓN Y PROCESAMIENTO DE ENLACES
    // =========================================================================
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

    // =========================================================================
    // 3. SECCIÓN DE AUDIO (/play)
    // =========================================================================
    if (['play', 'p', 'mp3', 'p3', 'ytaudio'].includes(cmd)) {
      try {
        await m.reply('> ⏳ Obteniendo el audio de forma remota, por favor espera...');
        
        const response = await fetch(`https://fgmods.xyz{encodeURIComponent(url)}&apikey=elrebelde21`);
        const res = await response.json();
        
        if (res.status && res.result && res.result.dl_url) {
          await client.sendMessage(m.chat, { 
            audio: { url: res.result.dl_url }, 
            mimetype: 'audio/mpeg',
            fileName: `${res.result.title || title}.mp3`,
            ptt: false
          }, { quoted: m });
        } else {
          return m.reply('> ❌ El servidor de descargas externo no pudo procesar este audio.');
        }
      } catch (e) {
        await m.reply(`> ⚠️ *Ocurrió un error con la API de audio.*\n[Causa: *${e.message}*]`);
      }

    // =========================================================================
    // 4. SECCIÓN DE VIDEO (/play2)
    // =========================================================================
    } else if (['play2', 'mp4', 'ytv', 'video'].includes(cmd)) {
      try {
        await m.reply('> ⏳ Obteniendo el video de forma remota, por favor espera...');
        
        const response = await fetch(`https://fgmods.xyz{encodeURIComponent(url)}&apikey=elrebelde21`);
        const res = await response.json();
        
        if (res.status && res.result && res.result.dl_url) {
          await client.sendMessage(m.chat, { 
            video: { url: res.result.dl_url }, 
            caption: `🎬 *Video Descargado*\n\n• *Título:* ${res.result.title || title}`,
            mimetype: 'video/mp4'
          }, { quoted: m });
        } else {
          return m.reply('> ❌ El servidor de descargas externo no pudo procesar este video.');
        }
      } catch (e) {
        await m.reply(`> ⚠️ *Ocurrió un error con la API de video.*\n[Causa: *${e.message}*]`);
      }
    }
  }
};
