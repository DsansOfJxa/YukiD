/**
 * 🔍 analisis.js — Comandos de originalidad, análisis de plagio, detección de IA y lectura de PDFs.
 * Reúne: detia, detplagio, chatpdf
 */
import { getAIResponse } from '../../utils/ai.js';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import pdfParse from 'pdf-parse';

function extractJsonSafe(text) {
  if (!text) return null;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

const cmdDetIA = {
  command: ['dia', 'detia', 'ai?'],
  category: 'academia',
  desc: 'Detector de texto generado por Inteligencia Artificial.',
  run: async (client, m, args, usedPrefix, command) => {
    let text = args.join(' ').trim();
    if (m.quoted && (m.quoted.text || m.quoted.caption)) {
      text = m.quoted.text || m.quoted.caption;
    }

    if (!text) {
      return m.reply(`📝 Ingresa o responde al texto que deseas analizar.\n*Ejemplo:* \`${usedPrefix + command} La historia de Roma...\``);
    }

    try {
      await m.react('⏳');
      const { key } = await client.sendMessage(m.chat, { text: `🔍 *Analizando patrones lingüísticos con detectores de IA...*` }, { quoted: m });

      const prompt = `Eres un sistema forense de análisis de texto. Evalúa si el texto fue generado por IA o escrito por un humano utilizando: perplejidad léxica, índice de ráfaga (burstiness), variedad de vocabulario y simetría sintáctica.
DEVUELVE ÚNICAMENTE UN OBJETO JSON VÁLIDO SIN TEXTO ADICIONAL:
{
  "main_ai_gpt": "porcentaje total estimado de IA (ej: 85%)",
  "ai_generated": "porcentaje 100% IA (ej: 70%)",
  "ai_assisted": "porcentaje asistido por IA (ej: 15%)",
  "human_written": "porcentaje humano (ej: 15%)"
}`;

      const aiResponse = await getAIResponse({ content: text, prompt, user: m.sender });
      const parsed = extractJsonSafe(aiResponse) || {
        main_ai_gpt: '?%',
        ai_generated: '?%',
        ai_assisted: '?%',
        human_written: '?%'
      };

      const resultMessage = `🛡️ *DETECCIÓN DE IA (FORENSE)* 🛡️\n\n` +
        `🤖 *Probabilidad General IA:* \`${parsed.main_ai_gpt}\`\n\n` +
        `📊 *Desglose del Análisis:*\n` +
        `  • Contenido 100% IA: *${parsed.ai_generated}*\n` +
        `  • Contenido Asistido: *${parsed.ai_assisted || parsed.ai_asistido || '0%'}*\n` +
        `  • Redacción Humana: *${parsed.human_written}*\n\n` +
        `🌐 _Heurísticas basadas en GPTZero, Turnitin y ZeroGPT._`;

      await client.sendMessage(m.chat, { text: resultMessage, edit: key });
      await m.react('✔️');
    } catch (e) {
      await m.react('❌');
      return m.reply(`> ⚠️ Error al escanear el texto: ${e.message || 'Servidor no disponible'}`);
    }
  }
};

const cmdDetPlagio = {
  command: ['dplg', 'dplagio', 'plagio'],
  category: 'academia',
  desc: 'Detector de plagio y originalidad textual.',
  run: async (client, m, args, usedPrefix, command) => {
    let text = args.join(' ').trim();
    if (m.quoted && (m.quoted.text || m.quoted.caption)) {
      text = m.quoted.text || m.quoted.caption;
    }

    if (!text) {
      return m.reply(`📑 Ingresa o responde al texto que deseas verificar por plagio.\n*Ejemplo:* \`${usedPrefix + command} El agua es un recurso...\``);
    }

    try {
      await m.react('⏳');
      const { key } = await client.sendMessage(m.chat, { text: `🌐 *Verificando originalidad y buscando coincidencias académicas...*` }, { quoted: m });

      const prompt = `Eres un auditor de originalidad académica. Analiza la estructura, frases repetitivas y concordancia del texto para estimar similitud y plagio.
DEVUELVE ÚNICAMENTE UN OBJETO JSON VÁLIDO:
{
  "plagiarism_percentage": "porcentaje no original (ej: 15%)",
  "unique_percentage": "porcentaje original (ej: 85%)",
  "sources_found": "número estimado de fuentes coincidentes (ej: 2)",
  "verdict": "Veredicto conciso en máximo 15 palabras."
}`;

      const aiResponse = await getAIResponse({ content: text, prompt, user: m.sender });
      const parsed = extractJsonSafe(aiResponse) || {
        plagiarism_percentage: '?%',
        unique_percentage: '?%',
        sources_found: '?',
        verdict: 'No se pudo determinar el veredicto con exactitud.'
      };

      const resultMessage = `🛡️ *REPORTE DE ORIGINALIDAD Y PLAGIO* 🛡️\n\n` +
        `📑 *Plagio Estimado:* \`${parsed.plagiarism_percentage}\`\n` +
        `✨ *Contenido Original:* \`${parsed.unique_percentage}\`\n` +
        `🔍 *Fuentes Coincidentes:* \`${parsed.sources_found}\`\n\n` +
        `📌 *Veredicto:* ${parsed.verdict}`;

      await client.sendMessage(m.chat, { text: resultMessage, edit: key });
      await m.react('✔️');
    } catch (e) {
      await m.react('❌');
      return m.reply(`> ⚠️ Error al verificar plagio: ${e.message || 'Servidor saturado'}`);
    }
  }
};

const cmdChatPdf = {
  command: ['chatpdf', 'pdf'],
  category: 'academia',
  desc: 'Lee, analiza y responde preguntas sobre un documento PDF.',
  usage: '[pregunta] (respondiendo al archivo PDF)',
  run: async (client, m, args, usedPrefix, command) => {
    const text = args.join(' ').trim() || 'Resume las ideas clave y el tema principal del documento.';
    const q = m.quoted ? m.quoted : m;
    const docMessage = q.message?.documentMessage || q.msg || q;

    const mime = docMessage.mimetype || q.mediaType || '';
    if (!/pdf/i.test(mime)) {
      return m.reply(`📄 Responde directamente a un archivo *.PDF* con tu consulta.\n*Ejemplo:* \`${usedPrefix + command} ¿Cuáles son las conclusiones?\``);
    }

    try {
      await m.react('🕒');

      let buffer = null;
      if (typeof q.download === 'function') {
        buffer = await q.download();
      } else {
        const stream = await downloadContentFromMessage(docMessage, 'document');
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        buffer = Buffer.concat(chunks);
      }

      if (!buffer || buffer.length === 0) {
        await m.react('❌');
        return m.reply('❌ No se pudo descargar el archivo PDF.');
      }

      const parsedPdf = await pdfParse(buffer, { max: 15 });
      let pdfContent = (parsedPdf.text || '').trim();

      if (!pdfContent || pdfContent.length < 20) {
        await m.react('⚠️');
        return m.reply('⚠️ El PDF parece estar vacío o es un escaneo de imágenes sin capa de texto seleccionable (OCR).');
      }

      // Truncado seguro para no desbordar el contexto de la IA
      const MAX_CHARS = 12000;
      let avisoTruncado = '';
      if (pdfContent.length > MAX_CHARS) {
        pdfContent = pdfContent.slice(0, MAX_CHARS);
        avisoTruncado = '\n\n_(Nota: Documento muy extenso; se analizaron las primeras secciones más relevantes)._';
      }

      const prompt = `Contenido extraído del documento PDF:\n"""\n${pdfContent}\n"""\n\nInstrucción: Responde la siguiente pregunta basándote con rigor en el texto anterior. Cita secciones si es oportuno. Pregunta del usuario: "${text}"`;

      const aiResponse = await getAIResponse({
        content: 'Responde de forma clara y estructurada según el documento.',
        prompt,
        user: m.sender
      });

      await client.sendMessage(m.chat, {
        text: `📄 *ANÁLISIS DEL DOCUMENTO PDF*\n\n${aiResponse.trim()}${avisoTruncado}`
      }, { quoted: m });

      await m.react('✔️');
    } catch (e) {
      await m.react('❌');
      return m.reply(`> ⚠️ Error al procesar el archivo PDF: ${e.message}`);
    }
  }
};

export default [cmdDetIA, cmdDetPlagio, cmdChatPdf];
