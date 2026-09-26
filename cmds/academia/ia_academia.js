/**
 * 🎓 ia_academia.js — Comandos de ayuda académica, generación y procesamiento de textos e imágenes por IA.
 * Reúne: solve, resumir, corregir, humanizar, apa, imagine, vis (análisis visual), pomo (pomodoro)
 */
import { getAIResponse } from '../../utils/ai.js';
import { formatAPA } from '../../utils/apaHelper.js';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';

// Proveedores de generación de imágenes con fallback
const IMAGE_PROVIDERS = [
  (p) => `https://image.pollinations.ai/prompt/${encodeURIComponent(p)}?width=1024&height=1024&nologo=true&enhance=true`,
  (p) => `https://api.siputzx.my.id/api/ai/text2img?prompt=${encodeURIComponent(p)}`
];

// Almacén en memoria para temporizadores Pomodoro activos
const activePomodoros = new Map();

const cmdSolve = {
  command: ['solve', 'solucionar', 'resolver'],
  category: 'academia',
  desc: 'Resuelve problemas matemáticos, físicos o lógicos con desarrollo paso a paso.',
  run: async (client, m, args, usedPrefix, command) => {
    const text = args.join(' ').trim();
    if (!text) {
      return m.reply(`📐 Ingresa la ecuación o problema que deseas resolver.\n*Ejemplo:* \`${usedPrefix + command} 2x + 5 = 15\``);
    }

    try {
      await m.react('🕒');
      const { key } = await client.sendMessage(m.chat, { text: `📐 *Analizando y resolviendo problema paso a paso...*` }, { quoted: m });

      const prompt = `Eres un tutor doctoral de matemáticas y ciencias exactas. Resuelve el problema planteado con máximo rigor pedagógico.
Estructura obligatoria:
1. Planteamiento e identificación de incógnitas/datos.
2. Procedimiento algebraico detallado paso a paso.
3. Verificación o comprobación del resultado.
4. Resultado final destacado con notación clara.
Idioma: Español. No agregues comentarios innecesarios.`;

      const responseText = await getAIResponse({ content: text, prompt, user: m.sender });
      await client.sendMessage(m.chat, { text: responseText.trim(), edit: key });
      await m.react('✔️');
    } catch (error) {
      await m.react('❌');
      return m.reply(`> ⚠️ Error al resolver el problema: ${error.message || 'Servidor saturado'}`);
    }
  }
};

const cmdResumir = {
  command: ['resumir', 'res', 'resumen'],
  category: 'academia',
  desc: 'Sintetiza y resume textos extensos destacando ideas clave.',
  run: async (client, m, args, usedPrefix, command) => {
    let text = args.join(' ').trim();
    if (m.quoted && (m.quoted.text || m.quoted.caption)) {
      text = m.quoted.text || m.quoted.caption;
    }

    if (!text) {
      return m.reply(`📝 Escribe o responde al texto que deseas resumir.\n*Ejemplo:* \`${usedPrefix + command} La fotosíntesis es el proceso...\``);
    }

    try {
      await m.react('🕒');
      const { key } = await client.sendMessage(m.chat, { text: `📑 *Leyendo y abstrayendo ideas clave...*` }, { quoted: m });

      const prompt = `Eres un asistente de investigación académica. Resume el texto destacando:
1. Tesis o concepto central (1-2 oraciones).
2. Puntos clave e ideas secundarias (viñetas claras y concisas).
3. Conclusiones o implicaciones.
Elimina paja y redundancias. Devuelve el resumen estructurado en limpio.`;

      const responseText = await getAIResponse({ content: text, prompt, user: m.sender });
      await client.sendMessage(m.chat, {
        text: `📝 *RESUMEN ACADÉMICO*\n\n${responseText.trim()}`,
        edit: key
      });
      await m.react('✔️');
    } catch (e) {
      await m.react('❌');
      return m.reply(`> ⚠️ Error al generar el resumen: ${e.message}`);
    }
  }
};

const cmdCorregir = {
  command: ['corregir', 'corr', 'ortografia'],
  category: 'academia',
  desc: 'Corrector ortográfico, gramatical y sintáctico avanzado.',
  run: async (client, m, args, usedPrefix, command) => {
    let text = args.join(' ').trim();
    if (m.quoted && (m.quoted.text || m.quoted.caption)) {
      text = m.quoted.text || m.quoted.caption;
    }

    if (!text) {
      return m.reply(`✍️ Escribe o responde al mensaje que deseas corregir.\n*Ejemplo:* \`${usedPrefix + command} ola komo estas\``);
    }

    try {
      await m.react('🕒');
      const { key } = await client.sendMessage(m.chat, { text: `✍️ *Revisando gramática, concordancia y ortografía...*` }, { quoted: m });

      const prompt = `Actúa como un corrector de estilo editorial profesional. Corrige ortografía, tildes, signos de puntuación, sintaxis y concordancia. Mantén el sentido y vocabulario original del autor. Devuelve ÚNICAMENTE el texto corregido en limpio sin notas ni explicaciones.`;
      const responseText = await getAIResponse({ content: text, prompt, user: m.sender });

      await client.sendMessage(m.chat, {
        text: `✍️ *TEXTO CORREGIDO*\n\n${responseText.trim()}`,
        edit: key
      });
      await m.react('✔️');
    } catch (e) {
      await m.react('❌');
      return m.reply(`> ⚠️ Error al corregir el texto: ${e.message}`);
    }
  }
};

const cmdHumanizar = {
  command: ['humanizar', 'hum', 'humanize', 'parafrasear', 'parf', 'reescribir'],
  category: 'academia',
  desc: 'Reescribe o humaniza textos para reducir la detección de IA o mejorar el estilo.',
  run: async (client, m, args, usedPrefix, command) => {
    let text = args.join(' ').trim();
    if (m.quoted && (m.quoted.text || m.quoted.caption)) {
      text = m.quoted.text || m.quoted.caption;
    }

    const isParafrasear = ['parafrasear', 'parf', 'reescribir'].includes(command.toLowerCase());
    if (!text) {
      const mode = isParafrasear ? 'parafrasear' : 'humanizar';
      return m.reply(`📝 Ingresa o responde al texto que deseas ${mode}.\n*Ejemplo:* \`${usedPrefix + command} La inteligencia artificial es...\``);
    }

    if (text.length > 2500) {
      return m.reply('⚠️ El texto supera los 2,500 caracteres recomendados. Divídelo en partes más breves.');
    }

    try {
      await m.react('⏳');
      const initMsg = isParafrasear
        ? `🔄 *Parafraseando texto y enriqueciendo estructura...*`
        : `🧬 *Humanizando redacción y optimizando naturalidad...*`;
      const { key } = await client.sendMessage(m.chat, { text: initMsg }, { quoted: m });

      const promptParf = `Eres un editor académico. Parafrasea el texto manteniendo el significado original exacto pero cambiando la estructura sintáctica, usando sinónimos formales y variando la longitud de oraciones. Devuelve únicamente el texto parafraseado sin notas.`;
      const promptHum = `Eres un especialista en estilística y lingüística aplicada. Reescribe el texto para darle un tono completamente humano, natural y fluido en español. Varía el ritmo de las oraciones, añade conectores naturales y elimina frases cliché típicas de modelos de lenguaje. Devuelve únicamente el texto reescrito en limpio.`;

      const prompt = isParafrasear ? promptParf : promptHum;
      const responseText = await getAIResponse({ content: text, prompt, user: m.sender });

      const header = isParafrasear ? '🔄 *TEXTO PARAFRASEADO*' : '🧬 *TEXTO HUMANIZADO*';
      await client.sendMessage(m.chat, {
        text: `${header}\n\n${responseText.trim()}`,
        edit: key
      });
      await m.react('✔️');
    } catch (e) {
      await m.react('❌');
      return m.reply(`> ⚠️ Error al procesar el texto: ${e.message}`);
    }
  }
};

const cmdApa = {
  command: ['apa', 'bibguru', 'citar'],
  category: 'academia',
  desc: 'Genera una cita bibliográfica en formato APA 7ma edición a partir de un enlace.',
  usage: '<url>',
  run: async (client, m, args, usedPrefix, command) => {
    const url = args.join(' ').trim();
    if (!url) {
      return m.reply(`🎓 Ingresa la URL del artículo o sitio web a citar.\n*Ejemplo:* \`${usedPrefix + command} https://es.wikipedia.org/wiki/Ciencia\``);
    }
    if (!/^https?:\/\/\S+$/i.test(url)) {
      return m.reply('⚠️ La URL no es válida. Debe iniciar con `http://` o `https://`.');
    }

    try {
      await m.react('⏳');
      const citation = await formatAPA(url, client, m);
      const text = `┌───「 🎓 *REFERENCIA APA (7ª ED.)* 🎓 」───┐\n│\n│ ${citation}\n│\n└──────────────────────────────────────────┘`;
      await m.reply(text);
      await m.react('✔️');
    } catch (e) {
      await m.react('❌');
      return m.reply(`> ⚠️ Error al generar la cita APA: ${e.message}`);
    }
  }
};

const cmdImagine = {
  command: ['imagine', 'dibujar', 'dibuja', 'aiimage'],
  category: 'academia',
  desc: 'Genera ilustraciones e imágenes a partir de una descripción con IA.',
  usage: '<descripción>',
  run: async (client, m, args, usedPrefix, command) => {
    const text = args.join(' ').trim();
    if (!text) {
      return m.reply(`🎨 Escribe lo que deseas que la IA dibuje.\n*Ejemplo:* \`${usedPrefix + command} Un astronauta leyendo un libro en la luna, arte digital 4k\``);
    }

    await m.react('🕒');
    let imageBuffer = null;

    for (const provider of IMAGE_PROVIDERS) {
      try {
        const url = provider(text);
        const res = await fetch(url, { signal: AbortSignal.timeout(18000) });
        if (res.ok) {
          const ab = await res.arrayBuffer();
          if (ab && ab.byteLength > 1000) {
            imageBuffer = Buffer.from(ab);
            break;
          }
        }
      } catch {}
    }

    if (!imageBuffer) {
      await m.react('❌');
      return m.reply('❌ No se pudo generar la imagen en este momento. Intenta con otra descripción.');
    }

    await client.sendMessage(
      m.chat,
      { image: imageBuffer, caption: `🎨 *IMAGEN GENERADA POR IA*\n_Prompt:_ "${text}"` },
      { quoted: m }
    );
    await m.react('✔️');
  }
};

const cmdVis = {
  command: ['vis', 'iavisual', 'leerimagen', 'analizarfoto'],
  category: 'academia',
  desc: 'Análisis visual de imágenes, problemas matemáticos, esquemas o diagramas.',
  usage: '<pregunta> (adjuntando o respondiendo a una imagen)',
  run: async (client, m, args, usedPrefix, command) => {
    const q = m.quoted ? m.quoted : m;
    const mime = q.mime || q.msg?.mimetype || (q.msg || q).mimetype || q.mediaType || '';
    const isImage = /image/.test(mime) || q.type === 'imageMessage' || q.mtype === 'imageMessage' || Boolean(q.message?.imageMessage);

    if (!isImage) {
      return m.reply(`📸 Envía o responde a una imagen con tu pregunta.\n*Ejemplo:* \`${usedPrefix + command} Resuelve el ejercicio matemático de esta foto.\``);
    }

    const question = args.join(' ').trim() || 'Describe y resuelve detalladamente lo que aparece en la imagen con rigor académico.';

    try {
      await m.react('🕒');
      const { key } = await client.sendMessage(m.chat, { text: `👁️ *Leyendo y analizando imagen con visión computacional...*` }, { quoted: m });

      let imageBuffer = null;
      try {
        if (typeof q.download === 'function') {
          imageBuffer = await q.download();
        } else if (m.quoted && typeof m.quoted.download === 'function') {
          imageBuffer = await m.quoted.download();
        } else {
          const stream = await downloadContentFromMessage(q.msg || q.message?.imageMessage || q, 'image');
          const chunks = [];
          for await (const chunk of stream) chunks.push(chunk);
          imageBuffer = Buffer.concat(chunks);
        }
      } catch (dlErr) {
        console.error('[Vis] Error al descargar imagen:', dlErr);
      }

      if (!imageBuffer || imageBuffer.length === 0) {
        await m.react('❌');
        return client.sendMessage(m.chat, { text: '❌ No se pudo descargar la imagen para el análisis.', edit: key });
      }

      // 1. Extraer texto, fórmulas y diagramas de la imagen con el motor OCR
      let extractedText = '';
      try {
        const body = new URLSearchParams();
        body.append('apikey', 'helloworld');
        body.append('base64Image', `data:${mime || 'image/jpeg'};base64,${imageBuffer.toString('base64')}`);
        body.append('language', 'spa');
        body.append('isOverlayRequired', 'false');
        body.append('detectOrientation', 'true');
        body.append('scale', 'true');

        const ocrRes = await fetch('https://api.ocr.space/parse/image', {
          method: 'POST',
          body,
          signal: AbortSignal.timeout(18000)
        });
        const ocrData = await ocrRes.json();
        if (!ocrData.IsErroredOnProcessing && ocrData.ParsedResults?.[0]?.ParsedText) {
          extractedText = ocrData.ParsedResults[0].ParsedText.trim();
        }
      } catch (ocrErr) {
        console.warn('[Vis] Error al extraer texto con OCR:', ocrErr.message);
      }

      // 2. Construir prompt pedagógico para la IA
      let aiQuery = '';
      let prompt = '';

      if (extractedText) {
        prompt = `Eres un tutor doctoral de ciencias exactas y humanidades con visión artificial. Se ha analizado y extraído el contenido visual de la imagen proporcionada por el estudiante.
Analiza con rigor pedagógico el texto, fórmulas, ecuaciones, ejercicios o diagramas leídos de la foto.

Estructura de respuesta:
1. Planteamiento e identificación de datos/incógnitas del problema.
2. Desarrollo detallado paso a paso con explicación clara.
3. Resultado final destacado y comprobación.

Idioma: Español claro, directo y estructurado con formato markdown.`;

        aiQuery = `Consulta del alumno: "${question}"\n\n[Contenido y fórmulas extraídas de la imagen]:\n"""\n${extractedText}\n"""`;
      } else {
        prompt = `Eres un tutor académico y analista visual. El usuario te formula una consulta sobre una imagen: "${question}". Explica detalladamente los principios teóricos o la solución a su inquietud con rigor pedagógico en español.`;
        aiQuery = `Consulta del estudiante sobre la imagen: "${question}".`;
      }

      // 3. Obtener resolución con los modelos de razonamiento (DeepSeek-R1, Gemini, Llama)
      const aiResponse = await getAIResponse({
        content: aiQuery,
        prompt,
        user: m.sender
      });

      const finalMessage = extractedText
        ? `👁️ *ANÁLISIS VISUAL ACADÉMICO*\n\n` +
          `🔎 *Texto detectado en la imagen:*\n_${extractedText.slice(0, 200).replace(/\n/g, ' ')}${extractedText.length > 200 ? '...' : ''}_\n\n` +
          `📝 *Resolución Pedagógica:*\n${aiResponse.trim()}`
        : `👁️ *ANÁLISIS VISUAL ACADÉMICO*\n\n${aiResponse.trim()}\n\n` +
          `> 💡 *Nota:* Si la imagen contenía fórmulas o texto y no fue detectado, asegúrate de enviar la foto enfocada y con buena iluminación.`;

      await client.sendMessage(m.chat, {
        text: finalMessage,
        edit: key
      });
      await m.react('✔️');
    } catch (e) {
      await m.react('❌');
      return m.reply(`> ⚠️ Error en el análisis visual: ${e.message || 'Servidor ocupado'}`);
    }
  }
};

const cmdPomo = {
  command: ['pomo', 'pomodoro', 'estudio'],
  category: 'academia',
  desc: 'Temporizador Pomodoro para sesiones de estudio enfocadas.',
  usage: '[minutos / stop]',
  run: async (client, m, args, usedPrefix, command) => {
    const sessionKey = `${m.sender}_${m.chat}`;
    const sub = (args[0] || '').toLowerCase();

    if (sub === 'stop' || sub === 'cancel' || sub === 'parar') {
      const active = activePomodoros.get(sessionKey);
      if (!active) {
        return m.reply('ℹ️ No tienes ningún temporizador Pomodoro activo.');
      }
      clearTimeout(active.timer);
      activePomodoros.delete(sessionKey);
      return m.reply('🛑 *Sesión Pomodoro cancelada.*');
    }

    if (activePomodoros.has(sessionKey)) {
      const active = activePomodoros.get(sessionKey);
      const remainingMs = active.endsAt - Date.now();
      const remainingMin = Math.max(1, Math.ceil(remainingMs / 60000));
      return m.reply(`⏳ Ya tienes un Pomodoro en curso. Faltan aproximadamente *${remainingMin} minutos*.\nUsa \`${usedPrefix + command} stop\` si deseas detenerlo.`);
    }

    let studyMinutes = parseInt(args[0]) || 25;
    if (studyMinutes < 1 || studyMinutes > 120) {
      return m.reply('⚠️ Por favor ingresa un tiempo entre 1 y 120 minutos (por defecto 25).');
    }

    const durationMs = studyMinutes * 60 * 1000;
    const endsAt = Date.now() + durationMs;

    const timer = setTimeout(async () => {
      activePomodoros.delete(sessionKey);
      const endMessage =
        `⏰ *¡TIEMPO POMODORO CUMPLIDO!* ⏰\n\n` +
        `@${m.sender.split('@')[0]}, completaste tu sesión de estudio de *${studyMinutes} minutos*.\n` +
        `☕ Es momento de un descanso de *5 minutos*.\n` +
        `_Usa \`${usedPrefix + command} 5\` para cronometrar tu descanso._`;

      await client.sendMessage(m.chat, { text: endMessage, mentions: [m.sender] });
    }, durationMs);

    activePomodoros.set(sessionKey, { timer, endsAt, studyMinutes });

    const startMessage =
      `🍅 *SESIÓN POMODORO INICIADA* 🍅\n\n` +
      `⏱️ *Tiempo de enfoque:* ${studyMinutes} minutos\n` +
      `🎯 *Consejo:* Silencia distracciones y concéntrate en una sola tarea.\n\n` +
      `_Te avisaré cuando termine el bloque. Para cancelar: \`${usedPrefix + command} stop\`_`;

    return client.sendMessage(m.chat, { text: startMessage }, { quoted: m });
  }
};

export default [cmdSolve, cmdResumir, cmdCorregir, cmdHumanizar, cmdApa, cmdImagine, cmdVis, cmdPomo];
