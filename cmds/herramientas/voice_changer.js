/**
 * 🎙️ voice_changer.js — Modulador y filtros de voz profesionales para notas de voz y audios.
 * Filtros: bass, nightcore, robot, ardilla, deep, lento, rapido, reverse, distorsion, bajoagua, eco, vibra.
 */
import { promises as fsp } from 'fs';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';

// Definición de filtros FFmpeg para audio
const FILTERS = {
  bass: {
    name: 'Bass Boost',
    desc: 'Graves amplificados con ecualizador profundo',
    filter: 'equalizer=f=40:width_type=h:width=50:g=15,equalizer=f=80:width_type=h:width=50:g=12'
  },
  nightcore: {
    name: 'Nightcore',
    desc: 'Aumento de pitch y velocidad anime',
    filter: 'atempo=1.06,asetrate=44100*1.25'
  },
  robot: {
    name: 'Robot',
    desc: 'Modulación robótica y sintetizador metálico',
    filter: 'aresample=48000,asetrate=48000*0.8,flanger=delay=1.5:depth=4:regen=50:width=71:speed=0.5,atempo=1.25'
  },
  ardilla: {
    name: 'Ardilla (Chipmunk)',
    desc: 'Voz hiperaguda estilo ardillita',
    filter: 'asetrate=44100*1.55,atempo=1/1.1'
  },
  deep: {
    name: 'Voz Grave (Deep)',
    desc: 'Tono bajo, profundo e intimidante',
    filter: 'atempo=1.25,asetrate=44100*0.78'
  },
  lento: {
    name: 'Lento (Slowed)',
    desc: 'Audio ralentizado',
    filter: 'atempo=0.75'
  },
  rapido: {
    name: 'Rápido (Fast)',
    desc: 'Audio acelerado',
    filter: 'atempo=1.45'
  },
  reverse: {
    name: 'Reversa (Reverse)',
    desc: 'Audio reproducido hacia atrás',
    filter: 'areverse'
  },
  distorsion: {
    name: 'Distorsión (Blown)',
    desc: 'Saturación y triturador de bits tipo meme',
    filter: 'acrusher=level_in=8:level_out=18:bits=8:mode=log:aa=1'
  },
  bajoagua: {
    name: 'Bajo el Agua',
    desc: 'Filtro paso bajo sumergido y sordo',
    filter: 'lowpass=f=800,volume=1.4'
  },
  eco: {
    name: 'Eco (Reverb)',
    desc: 'Eco y reverberación espacial',
    filter: 'aecho=0.8:0.88:60:0.4'
  },
  vibra: {
    name: 'Vibrato',
    desc: 'Modulación de frecuencia vibrante',
    filter: 'vibrato=f=6.5:d=0.5'
  }
};

// Aliases para que el usuario pueda usar varios nombres
const ALIAS_MAP = {
  bass: 'bass',
  bassboost: 'bass',
  graves: 'bass',
  nightcore: 'nightcore',
  nc: 'nightcore',
  robot: 'robot',
  androide: 'robot',
  ardilla: 'ardilla',
  squirrel: 'ardilla',
  chipmunk: 'ardilla',
  deep: 'deep',
  grave: 'deep',
  lento: 'lento',
  slow: 'lento',
  slowed: 'lento',
  rapido: 'rapido',
  fast: 'rapido',
  speed: 'rapido',
  reverse: 'reverse',
  reversa: 'reverse',
  reves: 'reverse',
  distorsion: 'distorsion',
  blown: 'distorsion',
  earrape: 'distorsion',
  bajoagua: 'bajoagua',
  underwater: 'bajoagua',
  agua: 'bajoagua',
  eco: 'eco',
  echo: 'eco',
  vibra: 'vibra',
  vibrato: 'vibra'
};

function runFfmpeg(args, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    const t = setTimeout(() => {
      try { p.kill('SIGKILL'); } catch {}
      reject(new Error('ffmpeg timeout'));
    }, timeoutMs);

    p.stderr.on('data', (d) => (err += d.toString()));
    p.on('error', (e) => {
      clearTimeout(t);
      if (e.code === 'ENOENT') {
        reject(new Error('FFMPEG_NOT_FOUND'));
      } else {
        reject(e);
      }
    });
    p.on('close', (code) => {
      clearTimeout(t);
      if (code === 0) return resolve(true);
      reject(new Error(err || `ffmpeg failed (${code})`));
    });
  });
}

async function getMediaBuffer(m) {
  const quoted = m.quoted || m;
  const mime = (quoted.msg || quoted).mimetype || quoted.mime || '';
  if (!mime || (!mime.startsWith('audio/') && !mime.startsWith('video/'))) {
    return null;
  }

  if (typeof quoted.download === 'function') {
    return await quoted.download();
  }

  const msg = quoted.msg || quoted;
  const type = mime.startsWith('video/') ? 'video' : 'audio';
  const stream = await downloadContentFromMessage(msg, type);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function processAudioFilter(client, m, filterKey, usedPrefix) {
  const filterDef = FILTERS[filterKey];
  if (!filterDef) return;

  const audioBuf = await getMediaBuffer(m);
  if (!audioBuf || audioBuf.length === 0) {
    return m.reply(
      `🎙️ *MODULADOR DE VOZ — ${filterDef.name.toUpperCase()}*\n\n` +
      `> ℹ️ *¿Cómo usarlo?*\n` +
      `> Responde a un *audio*, *nota de voz* o *video* con \`${usedPrefix}${filterKey}\`\n\n` +
      `> 📝 *Efecto:* ${filterDef.desc}`
    );
  }

  const tmpDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const randomId = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const inPath = path.join(tmpDir, `in_${randomId}.raw`);
  const outPath = path.join(tmpDir, `out_${randomId}.mp3`);

  await fsp.writeFile(inPath, audioBuf);

  try {
    await m.react('🕒');

    const ffmpegArgs = [
      '-y',
      '-i', inPath,
      '-af', filterDef.filter,
      '-vn',
      '-c:a', 'libmp3lame',
      '-b:a', '128k',
      outPath
    ];

    await runFfmpeg(ffmpegArgs, 45000);

    const outBuf = await fsp.readFile(outPath);
    if (!outBuf || outBuf.length === 0) throw new Error('El archivo de salida está vacío');

    const isPtt = Boolean(m.quoted?.msg?.ptt || m.quoted?.ptt || true);

    await client.sendMessage(
      m.chat,
      {
        audio: outBuf,
        mimetype: 'audio/mp4',
        ptt: isPtt
      },
      { quoted: m }
    );

    await m.react('✔️');
  } catch (err) {
    await m.react('❌');
    if (err.message === 'FFMPEG_NOT_FOUND') {
      return m.reply(
        `> ❌ *Error:* FFmpeg no está instalado en el servidor o dispositivo.\n` +
        `> Si usas Termux instala con: \`pkg install ffmpeg\`\n` +
        `> Si usas Linux instala con: \`apt install ffmpeg\``
      );
    }
    return m.reply(`> ❌ *Error al modular el audio:*\n[${err.message || err}]`);
  } finally {
    try { await fsp.unlink(inPath); } catch {}
    try { await fsp.unlink(outPath); } catch {}
  }
}

// ── COMANDO PRINCIPAL: .voicechanger [filtro] ──
const cmdVoiceChanger = {
  command: ['voicechanger', 'vc', 'modulador', 'filtroaudio'],
  category: 'herramientas',
  desc: 'Modula la voz de un audio con filtros y efectos divertidos.',
  usage: '.voicechanger [filtro] (respondiendo a un audio)',
  run: async (client, m, args, usedPrefix) => {
    const selected = (args[0] || '').toLowerCase();
    const filterKey = ALIAS_MAP[selected];

    if (!filterKey) {
      const listText = Object.entries(FILTERS)
        .map(([k, v]) => `> • \`${usedPrefix}${k}\` — ${v.name} _(${v.desc})_`)
        .join('\n');

      return m.reply(
        `🎙️ *LISTA DE EFECTOS DE VOZ*\n\n` +
        `${listText}\n\n` +
        `> 💡 *Uso:* Responde a un audio con cualquiera de los comandos anteriores o escribe \`${usedPrefix}vc [efecto]\`.`
      );
    }

    await processAudioFilter(client, m, filterKey, usedPrefix);
  }
};

// ── COMANDOS DE ACCESO DIRECTO PARA CADA FILTRO ──
const filterCommands = Object.keys(FILTERS).map((key) => {
  const def = FILTERS[key];
  const aliases = Object.entries(ALIAS_MAP)
    .filter(([alias, target]) => target === key)
    .map(([alias]) => alias);

  return {
    command: aliases,
    category: 'herramientas',
    desc: `Aplica el filtro "${def.name}" a un audio o nota de voz.`,
    usage: `.${key} (respondiendo a un audio)`,
    run: async (client, m, args, usedPrefix) => {
      await processAudioFilter(client, m, key, usedPrefix);
    }
  };
});

export default [cmdVoiceChanger, ...filterCommands];
