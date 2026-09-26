// utils/apaHelper.js
import axios from 'axios';
import cheerio from 'cheerio';
import { getAIResponse } from './ai.js';

/**
 * Formatea una referencia APA 7ª edición a partir de una URL usando IA.
 * @param {string} url - URL del recurso a citar.
 * @param {object} client - Instancia de Baileys.
 * @param {object} m - Mensaje original.
 * @returns {Promise<string>} - Cadena con la cita APA formateada.
 */
export async function formatAPA(url, client, m) {
  if (!/^https?:\/\/[^\s]+$/.test(url)) {
    throw new Error('URL inválida. Debe empezar con http:// o https://');
  }

  let finalUrl = url;
  try {
    const head = await axios.head(url, { maxRedirects: 5, timeout: 5000 });
    finalUrl = head?.request?.res?.responseUrl || url;
  } catch (_) {}

  const { data: html } = await axios.get(finalUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    timeout: 12000,
  });

  const $ = cheerio.load(html);

  // Intentar extraer metadatos de JSON-LD
  let ldJson = null;
  $('script[type="application/ld+json"]').each((i, el) => {
    try {
      const data = JSON.parse($(el).html());
      if (data['@type'] === 'Article' || data['@type'] === 'NewsArticle' || data['@type'] === 'WebPage') {
        ldJson = data;
      }
    } catch (e) {}
  });

  const title = ldJson?.headline || ldJson?.name || $('title').first().text().trim() || 'Sin título';
  const site = ldJson?.publisher?.name || $('meta[property="og:site_name"]').attr('content') || new URL(finalUrl).hostname.replace('www.', '');
  
  let author = ldJson?.author?.name || $('meta[name="author"]').attr('content') || $('meta[property="article:author"]').attr('content') || 'Autor desconocido';
  if (Array.isArray(ldJson?.author)) author = ldJson.author.map(a => a.name).join(', ');

  const datePublished = ldJson?.datePublished || $('meta[property="article:published_time"]').attr('content') || $('meta[name="citation_date"]').attr('content') || 'Fecha desconocida';

  // Extraer un fragmento del texto para contexto adicional
  const textSnippet = $('body').text().replace(/\s+/g, ' ').substring(0, 500).trim();

  const prompt = `Eres un generador estricto de citas bibliográficas en formato APA 7ma edición, idéntico a BibGuru. 
Tu única tarea es recibir datos de una página web y devolver ÚNICAMENTE la cita APA 7 perfecta.
Reglas APA 7 para páginas web:
1. Apellido, Iniciales. (Año, Mes Día). _Título de la página web en cursiva usando guiones bajos_. Nombre del Sitio Web. URL
2. Si no hay autor, el título va al principio.
3. Si no hay fecha, usa (s.f.).
No agregues saludos, explicaciones ni notas. Solo la cita.`;

  const query = `Por favor, genera la cita APA 7 para esta página web:
URL: ${finalUrl}
Título: ${title}
Autor: ${author}
Fecha de publicación: ${datePublished}
Sitio web: ${site}
Fragmento de texto (por si ayuda a confirmar autor/fecha): "${textSnippet}"`;

  try {
    const aiCitation = await getAIResponse({ content: query, prompt, user: m.sender });
    return aiCitation.trim();
  } catch (error) {
    // Fallback manual si falla la IA
    return `${author}. (${datePublished.split('T')[0]}). _${title}_. ${site}. ${finalUrl}`;
  }
}
