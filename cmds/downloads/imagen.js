import { getMedia, isImageUrl } from './downloader.js'

export default {
  command: ['imagen', 'img', 'image'],
  category: 'downloads',
  desc: 'Buscar imágenes en Google y enviarlas como álbum o imagen única.',
  run: async (client, m, args, usedPrefix, command) => {
    const text = args.join(' ')
    if (!text) {
      return client.reply(m.chat, ` Por favor, Ingrese un término de búsqueda.`, m)
    }
    const bannedWords = [
  '+18', '18+', 'contenido adulto', 'contenido explícito', 'contenido sexual',
  'actriz porno', 'actor porno', 'estrella porno', 'pornstar', 'video xxx', 'xxx', 'x x x',
  'pornhub', 'xvideos', 'xnxx', 'redtube', 'brazzers', 'onlyfans', 'cam4', 'chaturbate',
  'myfreecams', 'bongacams', 'livejasmin', 'spankbang', 'tnaflix', 'hclips', 'fapello',
  'mia khalifa', 'lana rhoades', 'riley reid', 'abella danger', 'brandi love',
  'eva elfie', 'nicole aniston', 'janice griffith', 'alexis texas', 'lela star',
  'gianna michaels', 'adriana chechik', 'asa akira', 'mandy muse', 'kendra lust',
  'jordi el niño polla', 'johnny sins', 'danny d', 'manuel ferrara', 'mark rockwell',
  'porno', 'porn', 'sexo', 'sex', 'desnudo', 'desnuda', 'erótico', 'erotico', 'erotika',
  'tetas', 'pechos', 'boobs', 'boob', 'nalgas', 'culo', 'culos', 'qlos', 'trasero',
  'pene', 'verga', 'vergota', 'pito', 'chocha', 'vagina', 'vaginas', 'coño', 'concha',
  'genital', 'genitales', 'masturbar', 'masturbación', 'masturbacion', 'gemidos',
  'gemir', 'orgía', 'orgy', 'trío', 'trio', 'gangbang', 'creampie', 'facial', 'cum',
  'milf', 'teen', 'incesto', 'incest', 'violación', 'violacion', 'rape', 'bdsm',
  'hentai', 'tentacle', 'tentáculos', 'fetish', 'fetiche', 'sado', 'sadomaso',
  'camgirl', 'camsex', 'camshow', 'playboy', 'playgirl', 'playmate', 'striptease',
  'striptis', 'slut', 'puta', 'putas', 'perra', 'perras', 'whore', 'fuck', 'fucking',
  'fucked', 'cock', 'dick', 'pussy', 'ass', 'shemale', 'trans', 'transgénero',
  'transgenero', 'lesbian', 'lesbiana', 'gay', 'lgbt', 'explicit', 'hardcore',
  'softcore', 'nudista', 'nudismo', 'nudity', 'deepthroat', 'dp', 'double penetration',
  'analplay', 'analplug', 'rimjob', 'spank', 'spanking', 'lick', 'licking', '69',
  'doggystyle', 'reverse cowgirl', 'cowgirl', 'blowjob', 'bj', 'handjob', 'hj',
  'p0rn', 's3x', 'v@gina', 'c0ck', 'd1ck', 'fuk', 'fuking', 'fak', 'boobz', 'pusy',
  'azz', 'cumshot', 'sexcam', 'livecam', 'webcam', 'sexchat', 'sexshow', 'sexvideo',
  'sexvid', 'sexpics', 'sexphoto', 'seximage', 'sexgif', 'pornpic', 'pornimage',
  'pornvid', 'pornvideo', 'only fan', 'only-fans', 'only_fans', 'onlyfans.com',
  'mia khalifha', 'mia khalifah', 'mia khalifaa', 'mia khalif4', 'mia khal1fa',
  'mia khalifa +18', 'mia khalifa xxx', 'mia khalifa desnuda', 'mia khalifa porno'
  ]
    const lowerText = text.toLowerCase()
    const chat = global.db?.data?.chats?.[m.chat] || {}
    const nsfwEnabled = chat.nsfw === 1 || chat.nsfw === true
    if (!nsfwEnabled && bannedWords.some(word => lowerText.includes(word))) {
      return m.reply(' Este comando no *permite* búsquedas de contenido *+18* o *NSFW*')
    }
    try {
      const results = await getMedia('google_image', text);
      const rawCandidates = (results || []).filter(r => r.url && r.url.startsWith('http')).slice(0, 15);
      
      const validationPromises = rawCandidates.map(async (r) => {
        const valid = await isImageUrl(r.url);
        return valid ? r : null;
      });
      const checkedSettled = await Promise.allSettled(validationPromises);
      const checked = checkedSettled
        .filter(p => p.status === 'fulfilled' && p.value)
        .map(p => p.value);

      if (checked.length === 0) {
        return m.reply('❌ No se encontraron imágenes válidas para tu búsqueda.');
      }

      const formatCaption = (r) =>
        `ㅤ۟∩　ׅ　★　ׅ　🅖oogle 🅘mage 🅢earch　ׄᰙ　\n\n` +
        `${r.title ? `𖣣ֶㅤ֯⌗ ☆  ⬭ *Título* › ${r.title}\n` : ''}` +
        `${r.domain ? `𖣣ֶㅤ֯⌗ ☆  ⬭ *Fuente* › ${r.domain}\n` : ''}` +
        `${r.resolution ? `𖣣ֶㅤ֯⌗ ☆  ⬭ *Resolución* › ${r.resolution}\n` : ''}` +
        `𖣣ֶㅤ֯⌗ ☆  ⬭ *Búsqueda* › ${text}`;

      // Si solo hay 1 imagen válida o el cliente no soporta álbumes, enviar directamente
      if (checked.length === 1 || typeof client.sendAlbumMessage !== 'function') {
        return client.sendMessage(
          m.chat,
          { image: { url: checked[0].url }, caption: formatCaption(checked[0]) },
          { quoted: m }
        );
      }

      const medias = checked.slice(0, 10).map(r => ({
        type: 'image',
        data: { url: r.url },
        caption: formatCaption(r)
      }));
      await client.sendAlbumMessage(m.chat, medias, { quoted: m });
    } catch (e) {
      await m.reply(`> Error al ejecutar el comando.\n[Error: *${e.message}*]`);
    }
  }
}