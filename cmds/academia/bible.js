/**
 * 📖 bible.js — Interceptor y buscador de versículos bíblicos.
 * Soporta traducciones precisas y literales como NBLA (Nueva Biblia de las Américas)
 * y LBLA (La Biblia de las Américas), con fallback a RVR1960 / NVI.
 */

// Caché en memoria para respuestas inmediatas (0ms)
const verseCache = new Map();
const MAX_CACHE_SIZE = 150;

const SPANISH_NAMES = {
  'Genesis': 'Génesis', 'Exodus': 'Éxodo', 'Leviticus': 'Levítico', 'Numbers': 'Números',
  'Deuteronomy': 'Deuteronomio', 'Joshua': 'Josué', 'Judges': 'Jueces', 'Ruth': 'Rut',
  '1 Samuel': '1 Samuel', '2 Samuel': '2 Samuel', '1 Kings': '1 Reyes', '2 Kings': '2 Reyes',
  '1 Chronicles': '1 Crónicas', '2 Chronicles': '2 Crónicas', 'Ezra': 'Esdras', 'Nehemiah': 'Nehemías',
  'Esther': 'Ester', 'Job': 'Job', 'Psalms': 'Salmos', 'Proverbs': 'Proverbios',
  'Ecclesiastes': 'Eclesiastés', 'Song of Solomon': 'Cantares', 'Isaiah': 'Isaías', 'Jeremiah': 'Jeremías',
  'Lamentations': 'Lamentaciones', 'Ezekiel': 'Ezequiel', 'Daniel': 'Daniel', 'Hosea': 'Oseas',
  'Joel': 'Joel', 'Amos': 'Amós', 'Obadiah': 'Abdías', 'Jonah': 'Jonás', 'Micah': 'Miqueas',
  'Nahum': 'Nahúm', 'Habakkuk': 'Habacuc', 'Zephaniah': 'Sofonías', 'Haggai': 'Hageo',
  'Zechariah': 'Zacarías', 'Malachi': 'Malaquías', 'Matthew': 'Mateo', 'Mark': 'Marcos',
  'Luke': 'Lucas', 'John': 'Juan', 'Acts': 'Hechos', 'Romans': 'Romanos', '1 Corinthians': '1 Corintios',
  '2 Corinthians': '2 Corintios', 'Galatians': 'Gálatas', 'Ephesians': 'Efesios', 'Philippians': 'Filipenses',
  'Colossians': 'Colosenses', '1 Thessalonians': '1 Tesalonicenses', '2 Thessalonians': '2 Tesalonicenses',
  '1 Timothy': '1 Timoteo', '2 Timothy': '2 Timoteo', 'Titus': 'Tito', 'Philemon': 'Filemón',
  'Hebrews': 'Hebreos', 'James': 'Santiago', '1 Peter': '1 Pedro', '2 Peter': '2 Pedro',
  '1 John': '1 Juan', '2 Juan': '2 Juan', '3 Juan': '3 Juan', 'Jude': 'Judas', 'Revelation': 'Apocalipsis'
};

const BOOK_ALIASES = {
  // Antiguo Testamento
  'genesis': 'Genesis', 'gen': 'Genesis', 'gn': 'Genesis', 'gén': 'Genesis',
  'exodo': 'Exodus', 'éxodo': 'Exodus', 'ex': 'Exodus',
  'levitico': 'Leviticus', 'levítico': 'Leviticus', 'lv': 'Leviticus', 'lev': 'Leviticus',
  'numeros': 'Numbers', 'números': 'Numbers', 'nm': 'Numbers', 'num': 'Numbers',
  'deuteronomio': 'Deuteronomy', 'dt': 'Deuteronomy', 'deut': 'Deuteronomy',
  'josue': 'Joshua', 'josué': 'Joshua', 'jos': 'Joshua',
  'jueces': 'Judges', 'jue': 'Judges', 'jc': 'Judges',
  'rut': 'Ruth', 'rt': 'Ruth',
  '1 samuel': '1 Samuel', '1samuel': '1 Samuel', '1sam': '1 Samuel', '1 sam': '1 Samuel',
  '2 samuel': '2 Samuel', '2samuel': '2 Samuel', '2sam': '2 Samuel', '2 sam': '2 Samuel',
  '1 reyes': '1 Kings', '1reyes': '1 Kings', '1rey': '1 Kings', '1 rey': '1 Kings',
  '2 reyes': '2 Kings', '2reyes': '2 Kings', '2rey': '2 Kings', '2 rey': '2 Kings',
  '1 cronicas': '1 Chronicles', '1cronicas': '1 Chronicles', '1 crónicas': '1 Chronicles', '1cr': '1 Chronicles',
  '2 cronicas': '2 Chronicles', '2cronicas': '2 Chronicles', '2 crónicas': '2 Chronicles', '2cr': '2 Chronicles',
  'esdras': 'Ezra', 'esd': 'Ezra',
  'nehemias': 'Nehemiah', 'nehemías': 'Nehemiah', 'neh': 'Nehemiah',
  'ester': 'Esther', 'est': 'Esther',
  'job': 'Job',
  'salmos': 'Psalms', 'salmo': 'Psalms', 'sal': 'Psalms', 'sl': 'Psalms', 'psalm': 'Psalms',
  'proverbios': 'Proverbs', 'prov': 'Proverbs', 'pr': 'Proverbs',
  'eclesiastes': 'Ecclesiastes', 'eclesiastés': 'Ecclesiastes', 'ecl': 'Ecclesiastes', 'ec': 'Ecclesiastes',
  'cantares': 'Song of Solomon', 'cantar': 'Song of Solomon', 'cnt': 'Song of Solomon', 'cantar de los cantares': 'Song of Solomon',
  'isaias': 'Isaiah', 'isaías': 'Isaiah', 'is': 'Isaiah',
  'jeremias': 'Jeremiah', 'jeremías': 'Jeremiah', 'jr': 'Jeremiah',
  'lamentaciones': 'Lamentations', 'lam': 'Lamentations',
  'ezequiel': 'Ezekiel', 'ez': 'Ezekiel',
  'daniel': 'Daniel', 'dn': 'Daniel', 'dan': 'Daniel',
  'oseas': 'Hosea', 'os': 'Hosea',
  'joel': 'Joel', 'jl': 'Joel',
  'amos': 'Amos', 'amós': 'Amos',
  'abdias': 'Obadiah', 'abdías': 'Obadiah', 'abd': 'Obadiah',
  'jonas': 'Jonah', 'jonás': 'Jonah',
  'miqueas': 'Micah', 'miq': 'Micah',
  'nahum': 'Nahum', 'nahúm': 'Nahum',
  'habacuc': 'Habakkuk', 'hab': 'Habakkuk',
  'sofonias': 'Zephaniah', 'sofonías': 'Zephaniah', 'sof': 'Zephaniah',
  'hageo': 'Haggai', 'hag': 'Haggai',
  'zacarias': 'Zechariah', 'zacarías': 'Zechariah', 'zac': 'Zechariah',
  'malaquias': 'Malachi', 'malaquías': 'Malachi', 'mal': 'Malachi',

  // Nuevo Testamento
  'mateo': 'Matthew', 'mt': 'Matthew', 'mat': 'Matthew',
  'marcos': 'Mark', 'mr': 'Mark', 'mc': 'Mark',
  'lucas': 'Luke', 'lc': 'Luke', 'luc': 'Luke',
  'juan': 'John', 'jn': 'John',
  'hechos': 'Acts', 'hch': 'Acts', 'hec': 'Acts',
  'romanos': 'Romans', 'ro': 'Romans', 'rom': 'Romans',
  '1 corintios': '1 Corinthians', '1corintios': '1 Corinthians', '1cor': '1 Corinthians', '1co': '1 Corinthians',
  '2 corintios': '2 Corinthians', '2corintios': '2 Corinthians', '2cor': '2 Corinthians', '2co': '2 Corinthians',
  'galatas': 'Galatians', 'gálatas': 'Galatians', 'gal': 'Galatians', 'gl': 'Galatians',
  'efesios': 'Ephesians', 'ef': 'Ephesians',
  'filipenses': 'Philippians', 'fil': 'Philippians', 'flp': 'Philippians',
  'colosenses': 'Colossians', 'col': 'Colossians',
  '1 tesalonicenses': '1 Thessalonians', '1tesalonicenses': '1 Thessalonians', '1tes': '1 Thessalonians',
  '2 tesalonicenses': '2 Thessalonians', '2tesalonicenses': '2 Thessalonians', '2tes': '2 Thessalonians',
  '1 timoteo': '1 Timothy', '1timoteo': '1 Timothy', '1tim': '1 Timothy',
  '2 timoteo': '2 Timothy', '2timoteo': '2 Timothy', '2tim': '2 Timothy',
  'tito': 'Titus', 'tit': 'Titus',
  'filemon': 'Philemon', 'filemón': 'Philemon', 'flm': 'Philemon',
  'hebreos': 'Hebrews', 'heb': 'Hebrews', 'he': 'Hebrews',
  'santiago': 'James', 'stg': 'James', 'stgo': 'James',
  '1 pedro': '1 Peter', '1pedro': '1 Peter', '1pe': '1 Peter', '1p': '1 Peter',
  '2 pedro': '2 Peter', '2pedro': '2 Peter', '2pe': '2 Peter', '2p': '2 Peter',
  '1 juan': '1 John', '1juan': '1 John', '1jn': '1 John',
  '2 juan': '2 John', '2juan': '2 John', '2jn': '2 John',
  '3 juan': '3 John', '3juan': '3 John', '3jn': '3 John',
  'judas': 'Jude', 'jud': 'Jude',
  'apocalipsis': 'Revelation', 'ap': 'Revelation', 'apoc': 'Revelation'
};

const BIBLE_REF_REGEX = /(?:^|\s)((?:[123]\s?)?(?:[A-ZÁÉÍÓÚÑa-záéíóúñ]{2,20}))\s+(\d{1,3})\s*[:]\s*(\d{1,3})(?:\s*[-]\s*(\d{1,3}))?(?=\s|$|[.,;!?)])/gi;

function extractReferences(text) {
  if (!text || text.length < 5) return [];
  const refs = [];
  let match;
  BIBLE_REF_REGEX.lastIndex = 0;

  while ((match = BIBLE_REF_REGEX.exec(text)) !== null) {
    const rawBook = match[1].trim();
    const chapter = parseInt(match[2]);
    const verseStart = parseInt(match[3]);
    const verseEnd = match[4] ? parseInt(match[4]) : null;

    const lower = rawBook.toLowerCase();
    const normalized = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const apiBookName = BOOK_ALIASES[lower] || BOOK_ALIASES[normalized];
    if (!apiBookName) continue;

    if (chapter < 1 || chapter > 150) continue;
    if (verseStart < 1 || verseStart > 176) continue;
    if (verseEnd && (verseEnd < verseStart || verseEnd > 176)) continue;

    refs.push({
      book: apiBookName,
      spanishBook: SPANISH_NAMES[apiBookName] || apiBookName,
      chapter,
      verseStart,
      verseEnd,
      original: match[0].trim()
    });
  }
  return refs;
}

/**
 * Consulta el pasaje en BibleGateway con la versión deseada (NBLA o LBLA por defecto).
 */
async function fetchFromBibleGateway(ref, version = 'NBLA') {
  const range = ref.verseEnd ? `${ref.verseStart}-${ref.verseEnd}` : `${ref.verseStart}`;
  const query = `${ref.spanishBook} ${ref.chapter}:${range}`;
  const url = `https://www.biblegateway.com/passage/?search=${encodeURIComponent(query)}&version=${version.toUpperCase()}`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
    },
    signal: AbortSignal.timeout(8000)
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();

  const match = html.match(/<div class=["']passage-text["']>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i)
    || html.match(/<div class=['"]passage-content[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i);

  if (!match) throw new Error('No se encontró el texto del pasaje');
  let passageHtml = match[1];

  // Remover notas, hipervínculos de capítulo, subtítulos y encabezados
  passageHtml = passageHtml.replace(/<sup class=['"]crossreference[\s\S]*?<\/sup>/gi, '');
  passageHtml = passageHtml.replace(/<sup class=['"]footnote[\s\S]*?<\/sup>/gi, '');
  passageHtml = passageHtml.replace(/<div class=['"]crossrefs[\s\S]*?<\/div>/gi, '');
  passageHtml = passageHtml.replace(/<div class=['"]footnotes[\s\S]*?<\/div>/gi, '');
  passageHtml = passageHtml.replace(/<a class=['"]full-chap-link[\s\S]*?<\/a>/gi, '');
  passageHtml = passageHtml.replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, '');

  // Marcar los versículos
  passageHtml = passageHtml.replace(/<sup class=['"]versenum['"][^>]*>\s*(\d+)[^<]*<\/sup>/gi, '\n__V__$1 ');

  // Eliminar etiquetas HTML restantes
  let text = passageHtml.replace(/<[^>]+>/g, ' ');

  // Decodificar entidades HTML comunes
  text = text.replace(/&raquo;/g, '»')
             .replace(/&laquo;/g, '«')
             .replace(/&ldquo;/g, '“')
             .replace(/&rdquo;/g, '”')
             .replace(/&lsquo;/g, '‘')
             .replace(/&rsquo;/g, '’')
             .replace(/&quot;/g, '"')
             .replace(/&amp;/g, '&')
             .replace(/&lt;/g, '<')
             .replace(/&gt;/g, '>')
             .replace(/&#8217;/g, "'")
             .replace(/&#8220;/g, '“')
             .replace(/&#8221;/g, '”')
             .replace(/&nbsp;/g, ' ');

  // Limpiar notas y basura típica
  text = text.replace(/\b[A-Za-zÁÉÍÓÚáéíóú0-9:\s]+in all (?:Spanish )?translations[\s\S]*$/i, '');
  text = text.replace(/\[\s*[a-z]\s*\]/gi, '');
  text = text.replace(/\s+([,.;:?!])/g, '$1');
  text = text.replace(/[ \t]+/g, ' ').trim();
  text = text.replace(/^(\d+)\s+/, '__V__$1 ');

  const parts = text.split('__V__').map(p => p.trim()).filter(Boolean);
  const formattedVerses = [];

  for (const part of parts) {
    const numMatch = part.match(/^(\d+)\s*([\s\S]*)/);
    if (numMatch) {
      const vNum = numMatch[1];
      const vText = numMatch[2].replace(/\s+/g, ' ').trim();
      formattedVerses.push(`*${vNum}.* ${vText}`);
    } else {
      const vText = part.replace(/\s+/g, ' ').trim();
      if (vText) formattedVerses.push(`*${ref.verseStart}.* ${vText}`);
    }
  }

  if (!formattedVerses.length) throw new Error('Pasaje vacío');

  const fullVersionName = version.toUpperCase() === 'LBLA'
    ? 'La Biblia de las Américas (LBLA)'
    : 'Nueva Biblia de las Américas (NBLA)';

  return `📖 *${ref.spanishBook} ${ref.chapter}:${range}*\n_${fullVersionName}_\n\n` + formattedVerses.join('\n');
}

/**
 * Fallback secundario a la API de Midvash si BibleGateway está inaccesible.
 */
async function fetchFromMidvash(ref) {
  const verseRange = ref.verseEnd ? `${ref.verseStart}-${ref.verseEnd}` : `${ref.verseStart}`;
  const bookSlug = ref.book.toLowerCase().replace(/\s+/g, '-');
  const url = `https://api.midvash.com/v1/rvr1960/${bookSlug}/${ref.chapter}/${verseRange}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) return null;

  const json = await res.json();
  const result = json?.data;
  if (!result || !Array.isArray(result.verses) || result.verses.length === 0) return null;

  let formatted = `📖 *${ref.spanishBook} ${result.chapter}:${verseRange}*\n_Reina-Valera 1960 (RVR1960)_\n\n`;
  let currentVerse = result.verse || ref.verseStart;
  for (const vText of result.verses) {
    formatted += `*${currentVerse}.* ${vText.replace(/\s+/g, ' ').trim()}\n`;
    currentVerse++;
  }
  return formatted.trim();
}

/**
 * Consulta un pasaje con soporte de caché y failover automático.
 */
async function getBiblePassage(ref, version = 'NBLA') {
  const range = ref.verseEnd ? `${ref.verseStart}-${ref.verseEnd}` : `${ref.verseStart}`;
  const cacheKey = `${ref.book}_${ref.chapter}_${range}_${version}`.toLowerCase();

  // Comprobar caché en memoria
  if (verseCache.has(cacheKey)) {
    return verseCache.get(cacheKey);
  }

  let passage = null;

  // Intento 1: BibleGateway con la traducción precisa solicitada (NBLA / LBLA)
  try {
    passage = await fetchFromBibleGateway(ref, version);
  } catch (err) {
    // Intento 2: Fallback a Midvash RVR1960
    try {
      passage = await fetchFromMidvash(ref);
    } catch {}
  }

  if (passage) {
    if (verseCache.size >= MAX_CACHE_SIZE) {
      const oldest = verseCache.keys().next().value;
      verseCache.delete(oldest);
    }
    verseCache.set(cacheKey, passage);
  }

  return passage;
}

export default {
  command: ['bible', 'biblia'],
  category: 'academia',
  desc: 'Controla el detector bíblico y permite elegir la traducción (NBLA, LBLA, RVR1960).',
  isAdmin: true,
  run: async (client, m, args, usedPrefix, command) => {
    if (!global.db.data?.chats) return;
    if (!global.db.data.chats[m.chat]) global.db.data.chats[m.chat] = {};
    const chat = global.db.data.chats[m.chat];

    const action = (args[0] || '').toLowerCase();

    if (action === 'on' || action === 'enable') {
      chat.bible = true;
      return m.reply('📖 *BibleBot activado.*\nEscribe citas como _Juan 3:16_ o _Salmos 23:1-4_ y responderé con el versículo.');
    }

    if (action === 'off' || action === 'disable') {
      chat.bible = false;
      return m.reply('📖 *BibleBot desactivado* en este chat.');
    }

    if (action === 'version' || action === 'ver' || action === 'traduccion') {
      const targetVer = (args[1] || '').toUpperCase();
      if (!['NBLA', 'LBLA', 'RVR1960'].includes(targetVer)) {
        return m.reply(`📖 *Traducciones bíblicas disponibles:*\n• \`NBLA\` — Nueva Biblia de las Américas (Precisa y formal contemporánea)\n• \`LBLA\` — La Biblia de las Américas (Traducción literal clásica)\n• \`RVR1960\` — Reina-Valera 1960\n\n*Uso:* \`${usedPrefix + command} version NBLA\``);
      }
      chat.bibleVersion = targetVer;
      return m.reply(`✅ Traducción bíblica del grupo configurada a: *${targetVer}*.`);
    }

    const status = chat.bible !== false ? '🟢 Activado' : '🔴 Desactivado';
    const currentVer = chat.bibleVersion || 'NBLA';

    return client.sendMessage(m.chat, {
      text:
        `📖 *CONTROL DE DETECCIÓN BÍBLICA*\n\n` +
        `*Estado:* ${status}\n` +
        `*Traducción activa:* \`${currentVer}\`\n\n` +
        `*Comandos de configuración:*\n` +
        `• \`${usedPrefix + command} on\` — Activar detección\n` +
        `• \`${usedPrefix + command} off\` — Desactivar detección\n` +
        `• \`${usedPrefix + command} version NBLA\` — Traducción NBLA (Recomendada)\n` +
        `• \`${usedPrefix + command} version LBLA\` — Traducción LBLA\n\n` +
        `_Escribe cualquier cita como_ *Juan 3:16* _o_ *1 Corintios 13:4-7* _en el chat para verla automáticamente._`
    }, { quoted: m });
  }
};

export async function before(client, m) {
  if (!m.text || m.text.length < 5) return false;

  const chat = global.db.data?.chats?.[m.chat];
  if (chat && chat.bible === false) return false;

  const refs = extractReferences(m.text);
  if (!refs.length) return false;

  const version = chat?.bibleVersion || 'NBLA';
  const limitedRefs = refs.slice(0, 3);

  try {
    const results = [];
    for (const ref of limitedRefs) {
      const text = await getBiblePassage(ref, version);
      if (text) results.push(text);
    }

    if (!results.length) return false;

    const response = results.join('\n\n───────────────\n\n');
    await client.sendMessage(m.chat, { text: response }, { quoted: m });
  } catch {}

  return false;
}
