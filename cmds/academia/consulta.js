/**
 * 📚 consulta.js — Comandos de consulta lexicográfica, enciclopédica, frases célebres y sorteos.
 * Reúne: def, wiki, frase, ruleta
 */
import { getAIResponse } from '../../utils/ai.js';
import { translate, pickRandom } from '../../utils/tools.js';

const FALLBACK_FRASES = [
  { q: "La educación es el arma más poderosa que puedes usar para cambiar el mundo.", a: "Nelson Mandela" },
  { q: "Lo que sabemos es una gota de agua; lo que ignoramos es el océano.", a: "Isaac Newton" },
  { q: "La mente no es un recipiente que llenar, sino un fuego que encender.", a: "Plutarco" },
  { q: "Nunca consideres el estudio como una obligación, sino como una oportunidad para penetrar en el bello y maravilloso mundo del saber.", a: "Albert Einstein" },
  { q: "El sabio no dice todo lo que piensa, pero siempre piensa todo lo que dice.", a: "Aristóteles" },
  { q: "La perseverancia es la clave del triunfo en cualquier empresa de la vida.", a: "Santiago Ramón y Cajal" },
  { q: "Nada en este mundo debe ser temido, solo debe ser entendido.", a: "Marie Curie" }
];

const cmdDef = {
  command: ['def', 'significado', 'diccionario'],
  category: 'academia',
  desc: 'Diccionario virtual lexicográfico de la RAE con etimología y ejemplos.',
  run: async (client, m, args, usedPrefix, command) => {
    let text = args.join(' ').trim();
    if (m.quoted && (m.quoted.text || m.quoted.caption)) {
      text = m.quoted.text || m.quoted.caption;
    }

    if (!text) {
      return m.reply(`📖 Escribe o responde a la palabra que deseas consultar.\n*Ejemplo:* \`${usedPrefix + command} Resiliencia\``);
    }

    try {
      await m.react('📖');
      const logic = "Actúa como un lexicógrafo de la Real Academia Española. Formato obligatorio:\n1. Categoría gramatical (género, número, transitividad).\n2. Definición principal exacta y rigurosa.\n3. Etimología de origen (latín, griego, etc.) si existe.\n4. Un ejemplo breve de uso en contexto.\nDevuelve únicamente la entrada en limpio sin saludos ni comentarios.";

      const responseText = await getAIResponse({ content: text, prompt: logic, user: m.sender });
      if (!responseText) throw new Error("Respuesta vacía");

      const title = text.length > 30 ? "CONCEPTO" : text;
      await client.sendMessage(m.chat, {
        text: `📕 *DICCIONARIO RAE: ${title.toUpperCase()}*\n\n${responseText.trim()}`
      }, { quoted: m });

      await m.react('✅');
    } catch (e) {
      await m.react('❌');
      return m.reply('❌ No se pudo obtener la definición en este momento. Intenta más tarde.');
    }
  }
};

const cmdWiki = {
  command: ['wiki', 'wikipedia'],
  category: 'academia',
  desc: 'Búsqueda de artículos y conceptos en Wikipedia en español.',
  run: async (client, m, args, usedPrefix, command, text) => {
    const query = (text || args.join(' ')).trim();
    if (!query) {
      return m.reply(`🔍 Escribe qué término deseas buscar en Wikipedia.\n*Ejemplo:* \`${usedPrefix + command} Fotosíntesis\``);
    }

    try {
      await m.react('⏳');
      const api = `https://es.wikipedia.org/w/api.php?format=json&action=query&prop=extracts&exintro=1&explaintext=1&redirects=1&titles=${encodeURIComponent(query)}`;

      const res = await fetch(api, { signal: AbortSignal.timeout(10000) });
      const data = await res.json();
      const pages = data.query?.pages || {};
      const pageId = Object.keys(pages)[0];

      if (!pageId || pageId === '-1') {
        await m.react('❌');
        return m.reply(`⚠️ No se encontró ningún artículo para: *${query}*`);
      }

      const page = pages[pageId];
      let extract = (page.extract || '').trim();
      const pageTitle = page.title || query;

      if (!extract) {
        await m.react('⚠️');
        return m.reply(`ℹ️ El artículo *${pageTitle}* existe pero no tiene introducción textual disponible.`);
      }

      // Truncado limpio a un tamaño cómodo de lectura (~2000 caracteres)
      if (extract.length > 2000) {
        extract = extract.slice(0, 2000) + '...';
      }

      const wikiUrl = `https://es.wikipedia.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`;
      const responseText = `📚 *WIKIPEDIA: ${pageTitle.toUpperCase()}*\n\n${extract}\n\n🌐 _Leer completo: ${wikiUrl}_`;

      await client.sendMessage(m.chat, { text: responseText }, { quoted: m });
      await m.react('✅');
    } catch (e) {
      await m.react('❌');
      return m.reply(`❌ Error al conectar con Wikipedia: ${e.message}`);
    }
  }
};

const cmdFrase = {
  command: ['frase', 'motivacion', 'cita'],
  category: 'academia',
  desc: 'Frase célebre motivacional o académica.',
  run: async (client, m) => {
    try {
      await m.react('💡');

      let quote = '';
      let author = '';

      try {
        const res = await fetch('https://zenquotes.io/api/random', { signal: AbortSignal.timeout(6000) });
        const json = await res.json();
        if (json && json[0]?.q) {
          const rawEn = json[0].q;
          author = json[0].a || 'Anónimo';
          quote = await translate(rawEn, 'es', 'en').catch(() => rawEn);
        }
      } catch {}

      if (!quote) {
        const fallback = pickRandom(FALLBACK_FRASES);
        quote = fallback.q;
        author = fallback.a;
      }

      const finalMsg = `🎓 *FRASE DEL DÍA*\n\n_"${quote}"_\n\n— *${author}*`;
      await client.sendMessage(m.chat, { text: finalMsg }, { quoted: m });
      await m.react('✅');
    } catch (e) {
      await m.react('❌');
      return m.reply('❌ No se pudo cargar una frase en este momento.');
    }
  }
};

const cmdRuleta = {
  command: ['ruleta', 'sorteo', 'asignar'],
  category: 'academia',
  desc: 'Sorteo y asignación aleatoria de estudiantes a temas o tareas.',
  run: async (client, m, args, usedPrefix, command) => {
    const text = args.join(' ').trim();
    if (!text.includes('|')) {
      return m.reply(`🎲 *Formato requerido:* Separa los estudiantes de los temas con una barra vertical \`|\`.\n*Ejemplo:* \`${usedPrefix + command} Juan, María, Carlos | Tema 1, Tema 2, Tema 3\``);
    }

    try {
      await m.react('🎲');
      const [estudiantesStr, temasStr] = text.split('|');
      if (!estudiantesStr || !temasStr) {
        return m.reply('⚠️ Debes ingresar participantes a la izquierda de `|` y temas a la derecha.');
      }

      const parseItems = (str) => str.includes(',')
        ? str.split(',').map(s => s.trim()).filter(Boolean)
        : str.split(/\s+/).map(s => s.trim()).filter(Boolean);

      let estudiantes = parseItems(estudiantesStr);
      let temas = parseItems(temasStr);

      if (!estudiantes.length || !temas.length) {
        return m.reply('⚠️ No se detectaron estudiantes o temas válidos en la entrada.');
      }

      // Mezcla aleatoria (Fisher-Yates)
      for (let i = estudiantes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [estudiantes[i], estudiantes[j]] = [estudiantes[j], estudiantes[i]];
      }
      for (let i = temas.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [temas[i], temas[j]] = [temas[j], temas[i]];
      }

      let txt = `🎯 *SORTEO ACADÉMICO REALIZADO*\n\n`;
      estudiantes.forEach((estudiante, idx) => {
        const tema = temas[idx % temas.length];
        txt += `• 👤 *${estudiante}* ➔ 📚 \`${tema}\`\n`;
      });

      await client.sendMessage(m.chat, { text: txt.trim() }, { quoted: m });
      await m.react('✅');
    } catch (e) {
      await m.react('❌');
      return m.reply('❌ Error inesperado al procesar el sorteo.');
    }
  }
};

export default [cmdDef, cmdWiki, cmdFrase, cmdRuleta];
