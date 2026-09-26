// utils/ai.js
import config from '../config.js';
import axios from 'axios';
import https from 'https';

/**
 * Centralized AI client with fallback chain.
 * Timeout-optimized for Termux: aggressive timeouts, no wasted cycles.
 */

const AI_TIMEOUT = 8000;

// Agente HTTPS para ignorar certificados autofirmados (ej. Ryzen)
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// Prompt maestro determinista condensado de alta densidad (optimizado para velocidad y límites de proxy/URL)
export const DEFAULT_AI_SYSTEM_PROMPT = `[SISTEMA DETERMINISTA]:
- Factualidad estricta: Basa todo en fuentes verificadas (literatura revisada por pares con citas APA 7 y DOI en ciencia/técnica; fuentes oficiales/educativas en general). Sin especulación; si no es verificable, declara: "Información no disponible o no verificable". Ejecuta Chain-of-Verification previa.
- Restricciones absolutas: Prohibidos emojis, opiniones, adjetivos subjetivos, empatía artificial, preámbulos, saludos, preguntas de seguimiento y menús de retención.
- Inicio y fin: Inicia directamente con el primer dato solicitado. Termina abruptamente tras la última referencia bibliográfica.
- Estructura: Jerarquía de encabezados (#, ##), listas simples (prohibidas anidadas) y tablas cuantitativas.
- Referencias: Sección final obligatoria "## Referencias" con DOIs activos y URLs verificables.`;

// Versión ultracompacta para consultas extensas o endpoints GET con límites de URI estrictos
export const COMPACT_AI_SYSTEM_PROMPT = `[SISTEMA]: Hechos verificados, citas APA 7 y DOIs/URLs en "## Referencias". Sin emojis, opiniones, saludos ni preámbulos: inicia directo con el primer dato. Encabezados (#, ##) y listas simples (no anidadas). Sin especulación: si no es verificable declara "Información no disponible o no verificable". Termina tras la última referencia.`;

export async function getAIResponse({ text, content, prompt, user, imageBuffer, preferredProvider }) {
  const query = text || content;
  if (!query) throw new Error('No se proporcionó texto para la IA.');

  // Adaptación inteligente del prompt según la longitud de la consulta
  const isCustomPrompt = Boolean(prompt);
  let logic = prompt || (query.length > 1800 ? COMPACT_AI_SYSTEM_PROMPT : DEFAULT_AI_SYSTEM_PROMPT);
  const username = user || 'usuario';

  const fullPrompt = `${logic}\n\n[Consulta del Usuario]:\n${query}`;
  const totalLength = fullPrompt.length;

  // Versión segura para URLs en peticiones GET (evita errores 414 Request-URI Too Large y timeouts)
  const getPrompt = (!isCustomPrompt && totalLength > 2000)
    ? `${COMPACT_AI_SYSTEM_PROMPT}\n\n[Consulta]: ${query}`
    : fullPrompt;

  // Normalización segura de imageBuffer (evita que se serialice un objeto Buffer binario)
  const safeImage = imageBuffer
    ? (Buffer.isBuffer(imageBuffer) ? imageBuffer.toString('base64') : String(imageBuffer))
    : null;

  const apis = [
    // 1. Rebix DeepSeek-R1 (Razonamiento avanzado)
    {
      name: 'Rebix-DeepSeek-R1',
      alias: ['deepseek', 'r1', 'deepseek-r1'],
      skip: Boolean(imageBuffer) || totalLength > 4800,
      call: () => {
        const base = config.APIs?.rebix_deepseek_r1?.url || 'https://api-rebix.zone.id/api/deepseek-r1';
        return axios.get(`${base}?q=${encodeURIComponent(getPrompt)}`, { timeout: AI_TIMEOUT });
      },
      extract: res => res.data?.response
    },
    // 2. Rebix DeepSeek-V3 (Modelo versátil y rápido)
    {
      name: 'Rebix-DeepSeek-V3',
      alias: ['deepseek', 'v3', 'deepseek-v3'],
      skip: Boolean(imageBuffer) || totalLength > 4800,
      call: () => {
        const base = config.APIs?.rebix_deepseek_v3?.url || 'https://api-rebix.zone.id/api/deepseek-v3';
        return axios.get(`${base}?q=${encodeURIComponent(getPrompt)}`, { timeout: AI_TIMEOUT });
      },
      extract: res => res.data?.response
    },
    // 3. AB Llama AI (Cloudflare Workers - Rápido, preciso y gratuito)
    {
      name: 'Llama-Worker',
      alias: ['llama', 'meta'],
      skip: Boolean(imageBuffer) || totalLength > 4800,
      call: () => {
        const base = config.APIs?.llama?.url || 'https://ab-llama-ai.abrahamdw882.workers.dev';
        return axios.get(`${base}/?q=${encodeURIComponent(getPrompt)}`, { timeout: AI_TIMEOUT });
      },
      extract: res => res.data?.response || res.data?.data
    },
    // 4. Abztech Gemini (POST primario, GET fallback)
    {
      name: 'Abztech-Gemini',
      alias: ['gemini', 'google'],
      skip: Boolean(imageBuffer) || totalLength > 4800,
      call: async () => {
        const base = config.APIs?.abztech_gemini?.url || 'https://api-abztech.zone.id/ai/gemini';
        try {
          return await axios.post(base, { message: fullPrompt }, { timeout: AI_TIMEOUT, headers: { 'Content-Type': 'application/json' } });
        } catch {
          return await axios.get(`${base}?message=${encodeURIComponent(getPrompt)}`, { timeout: AI_TIMEOUT });
        }
      },
      extract: res => res.data?.data?.answer || res.data?.answer
    },
    // 5. Rebix Gemini (GET rápido)
    {
      name: 'Rebix-Gemini',
      alias: ['gemini', 'google'],
      skip: Boolean(imageBuffer) || totalLength > 4800,
      call: () => {
        const base = config.APIs?.rebix_gemini?.url || 'https://api-rebix.zone.id/api/gemini';
        return axios.get(`${base}?q=${encodeURIComponent(getPrompt)}`, { timeout: AI_TIMEOUT });
      },
      extract: res => res.data?.message
    },
    // 6. Capilot (Copilot Vercel API)
    {
      name: 'Capilot',
      alias: ['copilot', 'capilot'],
      skip: Boolean(imageBuffer) || totalLength > 4800,
      call: () => {
        const base = config.APIs?.capilot?.url || 'https://capilotapi.vercel.app';
        return axios.get(`${base}/?q=${encodeURIComponent(getPrompt)}`, { timeout: AI_TIMEOUT });
      },
      extract: res => res.data?.response || res.data?.data?.text
    },
    // 7. Abztech Perplexity (POST primario, GET fallback)
    {
      name: 'Abztech-Perplexity',
      alias: ['perplexity'],
      skip: Boolean(imageBuffer) || totalLength > 4800,
      call: async () => {
        const base = config.APIs?.abztech_perplexity?.url || 'https://api-abztech.zone.id/ai/perplexity';
        try {
          return await axios.post(base, { query: fullPrompt }, { timeout: AI_TIMEOUT, headers: { 'Content-Type': 'application/json' } });
        } catch {
          return await axios.get(`${base}?q=${encodeURIComponent(getPrompt)}`, { timeout: AI_TIMEOUT });
        }
      },
      extract: res => res.data?.answer
    },
    // 8. Siputzx (Luminai — POST con soporte multimedia / visión)
    {
      name: 'Siputzx',
      alias: ['vision', 'siputzx'],
      skip: false,
      call: () => {
        const payload = { content: query, user: username, prompt: logic, webSearchMode: false, model: 'gemini' };
        if (safeImage) payload.imageBuffer = safeImage;
        return axios.post("https://ai.siputzx.my.id", payload, { timeout: AI_TIMEOUT });
      },
      extract: res => res.data?.result
    },
    // 9. Ryzendesu (GPT-4) - GET
    {
      name: 'Ryzen',
      alias: ['chatgpt', 'gpt', 'ryzen'],
      skip: (imageBuffer ? true : false) || totalLength > 4800,
      call: () => axios.get(`https://api.ryzendesu.vip/api/ai/chatgpt?text=${encodeURIComponent(query)}&prompt=${encodeURIComponent(logic)}`, { 
        timeout: AI_TIMEOUT,
        httpsAgent
      }),
      extract: res => res.data?.response
    },
    // 10. AEMT - GET
    {
      name: 'AEMT',
      alias: ['aemt'],
      skip: (imageBuffer ? true : false) || totalLength > 4800,
      call: () => axios.get(`https://aemt.me/prompt/gpt?prompt=${encodeURIComponent(logic)}&text=${encodeURIComponent(query)}`, { timeout: AI_TIMEOUT }),
      extract: res => res.data?.result
    },
    // 11. Stellar (own API) - GET
    {
      name: 'Stellar',
      alias: ['stellar'],
      skip: (imageBuffer ? true : false) || totalLength > 4800,
      call: () => axios.get(`${config.APIs.stellar.url}/ai/gptprompt?text=${encodeURIComponent(query)}&prompt=${encodeURIComponent(logic)}&key=${config.APIs.stellar.key}`, { timeout: AI_TIMEOUT }),
      extract: res => res.data?.result?.text || res.data?.result || res.data?.results
    }
  ];

  let chain = apis;
  if (preferredProvider) {
    const pref = String(preferredProvider).toLowerCase();
    const matched = apis.filter(a => a.alias?.includes(pref) || a.name.toLowerCase().includes(pref));
    const rest = apis.filter(a => !a.alias?.includes(pref) && !a.name.toLowerCase().includes(pref));
    chain = [...matched, ...rest];
  }

  for (const api of chain) {
    if (api.skip) continue;
    try {
      const response = await api.call();
      const result = api.extract(response);
      
      if (result && typeof result === 'string' && result.length > 5) {
        // Filtrar respuestas de error del proveedor (ej: "Error: No WIZ data")
        const lowerResponse = result.toLowerCase().trim();
        if (
          lowerResponse.startsWith('error:') ||
          lowerResponse.includes('no wiz data') ||
          lowerResponse.includes('error al procesar') ||
          lowerResponse.includes('iscriviti e ripeti') ||
          lowerResponse.includes('missing \'q\' parameter')
        ) {
          console.warn(`[AI Client] Proveedor ${api.name} retornó un error de texto en su respuesta. Saltando al fallback...`);
          continue;
        }
        return result;
      }
    } catch (err) {
      // Continuar silenciosamente al siguiente proveedor
    }
  }

  throw new Error("No se pudo obtener una respuesta de la IA en ninguno de los proveedores.");
}
