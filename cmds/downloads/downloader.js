// cmds/downloads/downloader.js
/**
 * Centralized media downloader for Facebook, Instagram, TikTok, Pinterest, Studocu, Scribd, YouTube, Twitter, and Google Images.
 * Employs a robust fallback mechanism to ensure high availability.
 */
import config from '../../config.js';
import axios from 'axios';
import vm from 'node:vm';
import { cache } from '../../utils/tools.js';
import { scrapePinterest } from '../../utils/pinterestScraper.js';
import { scrapeTikTokVideo, searchTikTokVideos } from '../../utils/tiktokScraper.js';
import { scrapeYouTubeAudio, scrapeYouTubeVideo } from '../../utils/youtubeScraper.js';
import { isApiOnline, setApiOffline } from '../../utils/healthChecker.js';

const delay = ms => new Promise(res => setTimeout(res, ms));
const getApiBase = (entry) => (entry?.url || entry || '').replace(/\/api\/?$/, '');

// TTL por plataforma (milisegundos). Las descargas directas se cachean 5 min,
// las búsquedas 2 min porque los resultados cambian más frecuentemente.
const CACHE_TTL = {
  download: 5 * 60 * 1000,   // 5 min
  search:   2 * 60 * 1000,   // 2 min
};

// Límites de tamaño de archivo para proteger al bot en dispositivos limitados
const MAX_FILE_SIZE = {
  video: 100 * 1024 * 1024,  // 100 MB
  image:  30 * 1024 * 1024,  //  30 MB
  document: 50 * 1024 * 1024 //  50 MB
};

function cacheKey(platform, identifier) {
  return `downloader|${platform}|${identifier}`;
}

/**
 * Validates a media URL by performing a HEAD request.
 * Returns { valid, contentType, size } or { valid: false, reason }.
 */
export async function validateMediaUrl(url, expectedType = 'video') {
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  try {
    const { headers } = await axios.head(url, { 
      timeout: 6000, 
      headers: { 'User-Agent': userAgent } 
    });
    const contentType = headers['content-type'] || '';
    const size = parseInt(headers['content-length'] || '0', 10);
    const limit = MAX_FILE_SIZE[expectedType] || MAX_FILE_SIZE.video;

    if (size > limit) {
      return { valid: false, reason: `Archivo demasiado grande (${(size / 1024 / 1024).toFixed(1)} MB, máx ${(limit / 1024 / 1024).toFixed(0)} MB)`, contentType, size };
    }
    return { valid: true, contentType, size };
  } catch (e) {
    // Fallback: algunos CDNs bloquean HEAD (retornan 403 o 405). Intentamos un GET parcial con Range.
    try {
      const { headers } = await axios.get(url, {
        timeout: 6000,
        headers: {
          'Range': 'bytes=0-0',
          'User-Agent': userAgent
        }
      });
      const contentType = headers['content-type'] || '';
      
      let size = 0;
      const contentRange = headers['content-range'] || '';
      if (contentRange) {
        const match = contentRange.match(/\/(\d+)$/);
        if (match) size = parseInt(match[1], 10);
      }
      if (!size) {
        size = parseInt(headers['content-length'] || '0', 10);
      }

      const limit = MAX_FILE_SIZE[expectedType] || MAX_FILE_SIZE.video;
      if (size > limit) {
        return { valid: false, reason: `Archivo demasiado grande (${(size / 1024 / 1024).toFixed(1)} MB, máx ${(limit / 1024 / 1024).toFixed(0)} MB)`, contentType, size };
      }
      return { valid: true, contentType, size };
    } catch {
      // Si ambos fallan, dejamos pasar por seguridad
      return { valid: true, contentType: null, size: 0 };
    }
  }
}

/**
 * Helper to resolve API name from its endpoint URL
 */
function getApiName(url) {
  if (!url) return null;
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('yuki-wabot.my.id')) return 'stellar';
  if (urlLower.includes('vreden.web.id')) return 'vreden';
  if (urlLower.includes('siputzx.my.id')) return 'siputzx';
  if (urlLower.includes('ootaizumi.web.id')) return 'ootaizumi';
  if (urlLower.includes('delirius.store')) return 'delirius';
  if (urlLower.includes('nekolabs.web.id')) return 'nekolabs';
  if (urlLower.includes('apiaxi.i11.eu')) return 'axi';
  if (urlLower.includes('api-faa.my.id')) return 'apifaa';
  if (urlLower.includes('api.xyro.site')) return 'xyro';
  if (urlLower.includes('ryzendesu.vip')) return 'ryzen';
  if (urlLower.includes('aemt.me')) return 'aemt';
  if (urlLower.includes('zenzxz.my.id')) return 'zenzxz';
  
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace('api.', '').split('.')[0];
  } catch {
    return null;
  }
}

/**
 * Generic API fallback executor.
 * Reduces boilerplate for looping through APIs, handling errors, and caching.
 */
async function executeWithFallback(platform, identifier, apis, customOptions = {}) {
  const key = cacheKey(platform, identifier);
  const isSearch = identifier.includes('|search');
  const ttl = customOptions.ttl || (isSearch ? CACHE_TTL.search : CACHE_TTL.download);

  if (!customOptions.skipCache) {
    const cached = cache.get(key);
    if (cached) return cached;
  }

  for (const api of apis) {
    try {
      const isPost = api.method === 'POST';
      const options = {
        timeout: customOptions.timeout || 7500,
        headers: api.headers || {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      };

      let res;
      if (isPost) {
        res = (await axios.post(api.endpoint, api.data, options)).data;
      } else {
        res = (await axios.get(api.endpoint, options)).data;
      }

      const result = api.extractor(res);
      if (result) {
        if (Array.isArray(result) && result.length === 0) {
           throw new Error('Empty array result');
        }
        if (result.status === false && !result.data && !result.url) {
           throw new Error('API returned false status');
        }

        if (!customOptions.skipCache) {
          cache.set(key, result, ttl);
        }
        return result;
      }
    } catch (e) {
      // Continuar al siguiente proveedor de la lista
    }
    await delay(300);
  }
  return null;
}

export async function getFacebookMedia(url) {
  const apis = [
    {
      endpoint: `https://api.lempi.lat/dl/facebook?url=${encodeURIComponent(url)}&apikey=montekey28`,
      extractor: res => {
        if (!res.status || !res.datos?.url) return null;
        return {
          type: 'video',
          title: res.titulo || 'Facebook Video',
          resolution: res.datos.calidad || 'HD',
          format: 'mp4',
          url: res.datos.url
        };
      }
    },
    {
      endpoint: `https://api.siputzx.my.id/api/d/facebook?url=${encodeURIComponent(url)}`,
      extractor: res => {
        if (!res.status || !res.data?.downloads?.length) return null;
        const dl = res.data.downloads.find(d => d.quality?.includes('HD') || d.quality?.includes('720p')) || res.data.downloads[0];
        return dl?.url ? {
          type: dl.type || 'video',
          title: res.data.title || 'Facebook Video',
          resolution: dl.quality || 'HD',
          format: 'mp4',
          url: dl.url,
          thumbnail: res.data.thumbnail || null
        } : null;
      }
    },
    {
      endpoint: `${config.APIs.stellar.url}/dl/facebook?url=${encodeURIComponent(url)}&key=${config.APIs.stellar.key}`,
      extractor: res => {
        if (!res.status || !Array.isArray(res.resultados)) return null;
        const media = res.resultados.find(x => x.quality?.includes('720p')) || res.resultados.find(x => x.quality?.includes('360p'));
        return media?.url ? { type: 'video', title: null, resolution: media.quality || null, format: 'mp4', url: media.url } : null;
      }
    },
    {
      endpoint: `${config.APIs.ootaizumi.url}/downloader/facebook?url=${encodeURIComponent(url)}`,
      extractor: res => {
        if (!res.status || !res.result?.downloads?.length) return null;
        const media = res.result.downloads.find(x => x.quality?.includes('720p')) || res.result.downloads.find(x => x.quality?.includes('360p'));
        return media?.url ? { type: media.url.includes('.jpg') ? 'image' : 'video', title: null, resolution: media.quality || null, format: media.url.includes('.jpg') ? 'jpg' : 'mp4', url: media.url, thumbnail: res.result.thumbnail || null } : null;
      }
    },
    {
      endpoint: `${getApiBase(config.APIs.vreden)}/api/v1/download/facebook?url=${encodeURIComponent(url)}`,
      extractor: res => {
        if (!res.status || !res.result?.download) return null;
        const urlVideo = res.result.download.hd || res.result.download.sd;
        return urlVideo ? { type: 'video', title: res.result.title || null, resolution: res.result.download.hd ? 'HD' : 'SD', format: 'mp4', url: urlVideo, thumbnail: res.result.thumbnail || null, duration: res.result.durasi || null } : null;
      }
    },
    {
      endpoint: `${config.APIs.delirius.url}/download/facebook?url=${encodeURIComponent(url)}`,
      extractor: res => {
        if (!res.urls || !Array.isArray(res.urls)) return null;
        const urlVideo = res.urls.find(x => x.hd)?.hd || res.urls.find(x => x.sd)?.sd;
        return urlVideo ? { type: 'video', title: res.title || null, resolution: res.urls.find(x => x.hd)?.hd ? 'HD' : 'SD', format: 'mp4', url: urlVideo } : null;
      }
    }
  ];
  // Intentar con las APIs externas primero
  const apiResult = await executeWithFallback('facebook', url, apis);
  if (apiResult) return apiResult;

  // Fallback 2: Scraper directo de Facebook
  try {
    const directResult = await scrapeFacebookDirect(url);
    if (directResult) return directResult;
  } catch (e) {
    console.error("[Facebook Fallback Direct Error]:", e.message);
  }
  
  return null;
}

const FB_RE_URL = /(?:https?:\/\/)?(?:www\.|m\.|web\.|l\.)?facebook\.com\/[^\s<>"']+|fb\.watch\/[^\s<>"']+/i;
const FB_RE_ID = /\/reel\/(\d+)|[?&]v=(\d+)|\/videos\/(\d+)/;
const FB_RE_SHORT = /\/share\/(?:v|r|p)\/|fb\.watch\//;

const FB_HDR = {
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'accept-language': 'es-ES,es;q=0.9,en;q=0.8',
  'cache-control': 'no-cache',
  pragma: 'no-cache',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'none',
  'sec-fetch-user': '?1',
  'upgrade-insecure-requests': '1',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
};

const fbFetch = async (url, timeout = 15000) => {
  const res = await axios.get(url, {
    headers: FB_HDR,
    timeout,
    maxRedirects: 5,
    validateStatus: () => true
  });
  const finalUrl = res.request?.res?.responseUrl || url;
  return { status: res.status, url: finalUrl, body: res.data };
};

const fbReelPage = id => `https://www.facebook.com/reel/${id}`;
const fbReelId = u => (u.match(FB_RE_ID) || []).slice(1).find(Boolean);

const fbUnesc = s => String(s || '')
  .replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
  .replace(/\\\//g, '/');

const fbDecodeHtml = s => String(s || '')
  .replace(/&amp;/g, '&')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&nbsp;/g, ' ')
  .trim();

const fbParseNum = v => {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v).replace(/[^\d.,KMB]/gi, '').replace(',', '.'));
  if (Number.isNaN(n)) return null;
  const u = String(v).toUpperCase();
  if (/K|MIL/.test(u)) return Math.round(n * 1e3);
  if (/M/.test(u)) return Math.round(n * 1e6);
  return Math.round(n);
};

const fbFromTitle = (t, k) => fbParseNum(t?.match(new RegExp(`([\\d.,]+)\\s*(mil|k|m)?\\s*${k}`, 'i'))?.[0]);
const fbBeforePost = (h, pid, re) => h.match(new RegExp(`${re.source}[\\s\\S]{0,8000}?"post_id":"${pid}"`))?.[1];

function fbParseStats(h, id) {
  const ogT = h.match(/property="og:title" content="([^"]+)"/i)?.[1];
  const ogD = h.match(/property="og:description" content="([^"]+)"/i)?.[1];
  const pid = h.match(new RegExp(`"video":\\{"id":"${id}"[\\s\\S]{0,12000}?"post_id":"(\\d+)"`))?.[1]
    || h.match(/"post_id":"(\d+)"/)?.[1];
  const last = ogT?.split('|').pop()?.trim();

  const s = {
    reelId: id,
    url: fbReelPage(id),
    description: fbDecodeHtml(ogD || (last && !/views|reproducciones|reactions|reacciones/i.test(last) ? last : null)),
    views: +(h.match(/"(?:play|video_view|view)_count":(\d+)/)?.[1] || '') || fbFromTitle(ogT, 'reproducciones|views?'),
    reactions: pid ? +(fbBeforePost(h, pid, /"unified_reactors":\{"count":(\d+)/) || '') : null,
    comments: pid ? +(fbBeforePost(h, pid, /"total_comment_count":(\d+)/) || '') : null,
    shares: pid ? fbParseNum(fbBeforePost(h, pid, /"share_count_reduced":"([^"]+)"/)) : null,
    ownerId: h.match(new RegExp(`facebook\\.com/(\\d+)/videos/[^"']*${id}`))?.[1],
  };

  if (!s.reactions) s.reactions = fbFromTitle(ogT, 'reacciones|reactions?');
  if (!s.views) s.views = fbFromTitle(ogT, 'reproducciones|views?');
  return s;
}

function fbParseVideo(h, id) {
  const c = h.includes(`"id":"${id}"`)
    ? h.slice(h.indexOf(`"id":"${id}"`), h.indexOf(`"id":"${id}"`) + 25e3)
    : h;

  const m = re => (c.match(re) || h.match(re))?.[1];

  return fbDecodeHtml(fbUnesc(
    m(/"browser_native_hd_url":"((?:\\.|[^"\\])+)"/) ||
    m(/"browser_native_sd_url":"((?:\\.|[^"\\])+)"/) ||
    m(/"playable_url":"((?:\\.|[^"\\])+)"/) ||
    ''
  ));
}

export async function scrapeFacebookDirect(fbUrl) {
  try {
    const raw = String(fbUrl || '').trim();
    const link = (raw.match(FB_RE_URL)?.[0] || raw.split(/\s+/)[0])?.replace(/[.,;:!?)]+$/g, '');
    if (!link) return null;

    const source = link.startsWith('http') ? link : `https://${link}`;
    let id = fbReelId(source);
    let html = null;
    let lastError = null;

    if (!id && FB_RE_SHORT.test(source)) {
      try {
        const r = await fbFetch(source);
        id = fbReelId(r.url) || r.body?.match?.(/\/reel\/(\d+)/)?.[1];
        html = r.body;
      } catch (e) {
        lastError = e;
      }
      if (!id) return null;
    }

    if (!id) return null;

    const url = fbReelPage(id);
    const pages = [...new Set([
      source,
      url,
      `https://m.facebook.com/reel/${id}`,
      `https://web.facebook.com/reel/${id}`,
      `https://www.facebook.com/watch/?v=${id}`,
      `https://m.facebook.com/watch/?v=${id}`
    ])];

    if (!html || !fbParseVideo(html, id)) {
      html = null;
      for (const page of pages) {
        try {
          const r = await fbFetch(page);
          if (r.url && /login|two_step_verification/i.test(r.url)) {
            lastError = new Error('Reel privado o requiere login');
            continue;
          }
          if (
            r.body &&
            (
              r.status === 200 ||
              r.body.includes(`"id":"${id}"`) ||
              r.body.includes('browser_native_hd_url') ||
              r.body.includes('browser_native_sd_url') ||
              r.body.includes('playable_url')
            )
          ) {
            html = r.body;
            if (fbParseVideo(html, id)) {
              break;
            }
          }
          lastError = new Error(`HTTP ${r.status}`);
        } catch (e) {
          lastError = e;
        }
      }
    }

    if (!html) return null;

    const videoUrl = fbParseVideo(html, id);
    if (!videoUrl) return null;

    const stats = fbParseStats(html, id);
    return {
      type: 'video',
      title: stats.description || 'Facebook Video',
      resolution: html.includes('browser_native_hd_url') ? 'HD' : 'SD',
      format: 'mp4',
      url: videoUrl,
      thumbnail: null,
      duration: null
    };
  } catch (err) {
    console.error("[Facebook Direct Scraper Exception]:", err.message);
    return null;
  }
}

export async function scrapeInstagramSnapSave(url) {
  try {
    const res = await axios.post('https://snapsave.app/action.php?lang=en', new URLSearchParams({ url }).toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': 'https://snapsave.app',
        'Referer': 'https://snapsave.app/'
      },
      timeout: 12000
    });
    const text = res.data || '';
    if (!text || typeof text !== 'string') return null;

    let htmlResult = '';
    const loc = { hostname: 'snapsave.app', href: 'https://snapsave.app/' };
    
    const createMockElement = () => ({
      set innerHTML(val) { htmlResult += val; },
      get innerHTML() { return htmlResult; },
      set textContent(val) { htmlResult += val; },
      append: () => {},
      appendChild: () => {},
      remove: () => {},
      reset: () => {},
      style: {},
      classList: { add: () => {}, remove: () => {} },
      setAttribute: () => {},
      getAttribute: () => ''
    });

    const mockElement = createMockElement();

    const sandbox = {
      window: {},
      location: loc,
      gtag: () => {},
      document: {
        location: loc,
        getElementById: () => mockElement,
        querySelector: () => mockElement,
        querySelectorAll: () => [mockElement],
        createElement: () => createMockElement()
      },
      $: () => ({
        html: (val) => { htmlResult += val; },
        append: () => {},
        remove: () => {}
      })
    };
    sandbox.window = sandbox;

    const context = vm.createContext(sandbox);
    vm.runInContext(text, context);

    const matches = [...htmlResult.matchAll(/href="([^"]+)"/g)].map(m => m[1]).filter(u => u.startsWith('http') && !u.includes('snapsave.app') && !u.includes('facebook.com') && !u.includes('google'));
    
    if (matches.length > 0) {
      const urls = matches.map(u => ({
        type: u.includes('.mp4') ? 'video' : 'image',
        url: u
      }));
      return { isCarousel: urls.length > 1, urls, title: 'Instagram Media', caption: null };
    }
  } catch (e) {
    // Ignore and proceed to fallback APIs
  }
  return null;
}

export async function getInstagramMedia(url) {
  // 1. Direct Scraper
  try {
    const snapResult = await scrapeInstagramSnapSave(url);
    if (snapResult?.urls?.length) return snapResult;
  } catch {}

  const apis = [
    {
      endpoint: `${config.APIs.stellar.url}/dl/instagram?url=${encodeURIComponent(url)}&key=${config.APIs.stellar.key}`,
      extractor: res => {
        if (!res.status || !Array.isArray(res.data) || !res.data.length) return null;
        const urls = res.data.filter(m => m.url).map(m => ({
          type: m.tipo === 'video' || m.type === 'video' || m.url?.includes('.mp4') ? 'video' : 'image',
          url: m.url
        }));
        return urls.length ? { isCarousel: urls.length > 1, urls, title: null, caption: null } : null;
      }
    },
    {
      endpoint: `${config.APIs.stellar.url}/dl/instagramv2?url=${encodeURIComponent(url)}&key=${config.APIs.stellar.key}`,
      extractor: res => {
        if (!res.status) return null;
        const mediaUrls = res.data.mediaUrls?.length ? res.data.mediaUrls : [res.data.url].filter(Boolean);
        if (!mediaUrls.length) return null;
        const urls = mediaUrls.map(u => ({
          type: u.includes('.mp4') || res.data.type === 'video' || res.data.tipo === 'video' ? 'video' : 'image',
          url: u
        }));
        return { isCarousel: urls.length > 1, urls, title: res.data.username || null, caption: res.data.caption || null };
      }
    },
    {
      endpoint: `${config.APIs.nekolabs.url}/downloader/instagram?url=${encodeURIComponent(url)}`,
      extractor: res => {
        if (!res.success || !res.result?.downloadUrl?.length) return null;
        const urls = res.result.downloadUrl.map(u => ({
          type: u.includes('.mp4') || res.result.metadata?.isVideo || res.result.metadata?.type === 'video' ? 'video' : 'image',
          url: u
        }));
        return { isCarousel: urls.length > 1, urls, title: res.result.metadata?.username || null, caption: res.result.metadata?.caption || null };
      }
    },
    {
      endpoint: `${config.APIs.delirius.url}/download/instagram?url=${encodeURIComponent(url)}`,
      extractor: res => {
        if (!res.status || !Array.isArray(res.data) || !res.data.length) return null;
        const urls = res.data.filter(m => m.url).map(m => ({
          type: m.type === 'video' || m.tipo === 'video' || m.url?.includes('.mp4') ? 'video' : 'image',
          url: m.url
        }));
        return urls.length ? { isCarousel: urls.length > 1, urls, title: null, caption: null } : null;
      }
    },
    {
      endpoint: `${config.APIs.ootaizumi.url}/downloader/instagram/v2?url=${encodeURIComponent(url)}`,
      extractor: res => {
        if (!res.status || !res.result?.url?.length) return null;
        const urls = res.result.url.filter(m => m.url).map(m => ({
          type: m.type === 'mp4' || m.ext === 'mp4' || m.type === 'video' || m.isVideo || m.url?.includes('.mp4') ? 'video' : 'image',
          url: m.url
        }));
        return urls.length ? { isCarousel: urls.length > 1, urls, title: res.result.meta?.username || null, caption: res.result.meta?.title || null } : null;
      }
    },
    {
      endpoint: `${config.APIs.ootaizumi.url}/downloader/instagram/v1?url=${encodeURIComponent(url)}`,
      extractor: res => {
        if (!res.status || !res.result?.media?.length) return null;
        const urls = res.result.media.filter(m => m.url).map(m => ({
          type: m.isVideo || m.type === 'video' || m.url?.includes('.mp4') ? 'video' : 'image',
          url: m.url
        }));
        return urls.length ? { isCarousel: urls.length > 1, urls, title: res.result.metadata?.author || null, caption: null } : null;
      }
    },
    {
      endpoint: `https://api.ryzendesu.vip/api/downloader/igdl?url=${encodeURIComponent(url)}`,
      extractor: res => {
        if (!res.success && !res.data) return null;
        const data = res.data || res;
        if (!Array.isArray(data)) return null;
        const urls = data.map(m => ({
          type: m.url?.includes('.mp4') || m.type === 'video' || m.isVideo ? 'video' : 'image',
          url: m.url
        }));
        return urls.length ? { isCarousel: urls.length > 1, urls, title: null, caption: null } : null;
      }
    },
    {
      endpoint: `https://api.siputzx.my.id/api/d/igdl?url=${encodeURIComponent(url)}`,
      extractor: res => {
        if (!res.status || !res.data) return null;
        const data = Array.isArray(res.data) ? res.data : [res.data];
        const urls = data.map(m => ({
          type: (m.url || m).includes('.mp4') || m.type === 'video' || m.isVideo ? 'video' : 'image',
          url: m.url || m
        }));
        return urls.length ? { isCarousel: urls.length > 1, urls, title: null, caption: null } : null;
      }
    },
    {
      endpoint: `${config.APIs.zenzxz.url}/download/instagram?url=${encodeURIComponent(url)}`,
      extractor: res => {
        if (!res.status || !res.result) return null;
        if (!res.result.url) return null;
        const urls = [{
          type: res.result.is_video || res.result.url?.includes('.mp4') ? 'video' : 'image',
          url: res.result.url
        }];
        return { isCarousel: false, urls, title: res.result.username || null, caption: res.result.caption || null };
      }
    }
  ];
  const customOptions = { skipCache: false };
  return executeWithFallback('instagram', url, apis, customOptions);
}

export async function getTikTokData(input, isUrl) {
  if (isUrl) {
    const apis = [
      { endpoint: `${config.APIs.stellar.url}/dl/tiktok?url=${encodeURIComponent(input)}&key=${config.APIs.stellar.key}`, extractor: res => res.status ? res : null },
      { endpoint: `https://api.ryzendesu.vip/api/downloader/ttdl?url=${encodeURIComponent(input)}`, extractor: res => {
          if (!res.success && !res.data) return null;
          const data = res.data || res;
          return { status: true, data: { title: data.title || '', duration: data.duration || 0, dl: data.play || data.play_url || data.video || (data.images ? data.images : []), author: { nickname: data.author?.nickname || '' }, stats: { likes: data.digg_count || 0 }, type: data.images ? 'image' : 'video' } };
        }
      }
    ];
    
    // First try the specialized scraper (which uses tikwm)
    const primaryResult = await scrapeTikTokVideo(input);
    if (primaryResult) return primaryResult;

    // Then fallback to other APIs
    return executeWithFallback('tiktok', `${input}|url`, apis);
  } else {
    const apis = [
      { endpoint: `${config.APIs.stellar.url}/search/tiktok?query=${encodeURIComponent(input)}&key=${config.APIs.stellar.key}`, extractor: res => res.status ? res : null },
      { endpoint: `${getApiBase(config.APIs.vreden)}/api/v1/search/tiktok?query=${encodeURIComponent(input)}`, extractor: res => {
          if (!res.status || !res.result?.search_data) return null;
          const mapped = res.result.search_data.map(v => ({
            title: v.title,
            dl: v.data?.find(d => d.type === 'no_watermark')?.url || v.data?.[0]?.url,
            author: { nickname: v.author?.nickname, unique_id: v.author?.id },
            duration: v.duration,
            stats: { likes: v.stats?.likes, comments: v.stats?.comment, views: v.stats?.views, shares: v.stats?.share }
          }));
          return { status: true, data: mapped };
        }
      }
    ];

    // First try the specialized scraper search
    const primaryResult = await searchTikTokVideos(input, 15);
    if (primaryResult) return primaryResult;

    // Fallback to other APIs
    return executeWithFallback('tiktok', `${input}|search`, apis);
  }
}

export async function getPinterestData(input, isUrl) {
  if (isUrl) {
    // 1. Direct Pinterest HTML scraper (high reliability, zero API dependency)
    try {
      const pinRes = await axios.get(input, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
        },
        timeout: 10000
      });
      const html = pinRes.data || '';
      const videoMatch = html.match(/https:\/\/v\.pinimg\.com\/videos\/mc\/[a-zA-Z0-9_\/.-]+\.mp4/) || html.match(/https:\/\/v\.pinimg\.com\/videos\/[a-zA-Z0-9_\/.-]+\.mp4/);
      const origMatch = html.match(/https:\/\/i\.pinimg\.com\/originals\/[a-zA-Z0-9_\/.-]+\.(?:jpg|png|webp|gif)/) || html.match(/https:\/\/i\.pinimg\.com\/736x\/[a-zA-Z0-9_\/.-]+\.(?:jpg|png|webp|gif)/);
      const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/) || html.match(/<title>([^<]+)<\/title>/);
      
      const mediaUrl = videoMatch ? videoMatch[0] : (origMatch ? origMatch[0] : null);
      if (mediaUrl) {
        return {
          type: videoMatch ? 'video' : 'image',
          title: titleMatch ? titleMatch[1].replace(' | Pinterest', '').trim() : 'Pinterest Media',
          format: videoMatch ? 'mp4' : 'jpg',
          url: mediaUrl,
          thumbnail: origMatch ? origMatch[0] : mediaUrl
        };
      }
    } catch {}

    const apis = [
      { endpoint: `${config.APIs.stellar.url}/dl/pinterest?url=${encodeURIComponent(input)}&key=${config.APIs.stellar.key}`, extractor: res => (res.status && res.data?.dl) ? { type: res.data.type, title: res.data.title || null, author: res.data.author || null, username: res.data.username || null, uploadDate: res.data.uploadDate || null, format: res.data.type === 'video' ? 'mp4' : 'jpg', url: res.data.dl, thumbnail: res.data.thumbnail || null } : null },
      { endpoint: `${getApiBase(config.APIs.vreden)}/api/v1/download/pinterest?url=${encodeURIComponent(input)}`, extractor: res => {
          if (!res.status || !res.result?.media_urls?.length) return null;
          const media = res.result.media_urls.find(m => m.quality === 'original') || res.result.media_urls[0];
          return media?.url ? { type: media.type, title: res.result.title || null, description: res.result.description || null, author: res.result.uploader?.full_name || null, username: res.result.uploader?.username || null, uploadDate: res.result.created_at || null, likes: res.result.statistics?.likes || null, views: res.result.statistics?.views || null, saved: res.result.statistics?.saved || null, format: media.type, url: media.url } : null;
        }
      },
      { endpoint: `${config.APIs.nekolabs.url}/downloader/pinterest?url=${encodeURIComponent(input)}`, extractor: res => {
          if (!res.success || !res.result?.medias?.length) return null;
          const media = res.result.medias.find(m => m.extension === 'mp4' || m.extension === 'jpg');
          return media?.url ? { type: media.extension === 'mp4' ? 'video' : 'image', title: res.result.title || null, description: null, format: media.extension, url: media.url, thumbnail: res.result.thumbnail || null, duration: res.result.duration || null } : null;
        }
      },
      { endpoint: `${config.APIs.delirius.url}/download/pinterestdl?url=${encodeURIComponent(input)}`, extractor: res => (res.status && res.data?.download?.url) ? { type: res.data.download.type, title: res.data.title || null, description: res.data.description || null, author: res.data.author_name || null, username: res.data.username || null, followers: res.data.followers || null, uploadDate: res.data.upload || null, likes: res.data.likes || null, comments: res.data.comments || null, format: res.data.download.type, url: res.data.download.url, thumbnail: res.data.thumbnail || null, source: res.data.source || null } : null },
      { endpoint: `${config.APIs.ootaizumi.url}/downloader/pinterest?url=${encodeURIComponent(input)}`, extractor: res => (res.status && res.result?.download) ? { type: res.result.download.includes('.mp4') ? 'video' : 'image', title: res.result.title || null, description: null, author: res.result.author?.name || null, username: res.result.author?.username || null, uploadDate: res.result.upload || null, format: res.result.download.includes('.mp4') ? 'mp4' : 'jpg', url: res.result.download, thumbnail: res.result.thumb || null, source: res.result.source || null } : null }
    ];
    return executeWithFallback('pinterest', `${input}|url`, apis);
  } else {
    const endpoints = [
      `https://api.siputzx.my.id/api/s/pinterest?query=${encodeURIComponent(input)}`,
      `https://api.dorratz.com/v2/pinterest?q=${encodeURIComponent(input)}`,
      `${config.APIs.stellar.url}/search/pinterest?query=${encodeURIComponent(input)}&key=${config.APIs.stellar.key}`,
      `${config.APIs.stellar.url}/search/pinterestv2?query=${encodeURIComponent(input)}&key=${config.APIs.stellar.key}`,
      `${config.APIs.delirius.url}/search/pinterestv2?text=${encodeURIComponent(input)}`,
      `${getApiBase(config.APIs.vreden)}/api/v1/search/pinterest?query=${encodeURIComponent(input)}`,
      `${getApiBase(config.APIs.vreden)}/api/v2/search/pinterest?query=${encodeURIComponent(input)}&limit=10&type=videos`,
      `${config.APIs.delirius.url}/search/pinterest?text=${encodeURIComponent(input)}`
    ];
    
    const apis = endpoints.map(endpoint => ({
      endpoint,
      extractor: res => {
        let result = null;
        if (res?.ok && res?.data?.results?.length) {
          result = res.data.results.map(d => ({
            type: 'image',
            title: d.title || null,
            description: null,
            name: d.author || null,
            username: null,
            followers: null,
            likes: null,
            created_at: null,
            image: d.image_large_url || d.image_medium_url || d.image_small_url || d.image_url || null
          })).filter(r => r.image);
        } else if (res?.data?.length) {
          result = res.data.map(d => {
            const img = typeof d === 'string' ? d : (d.image_url || d.hd || d.image || d.images?.orig?.url || d.media_urls?.[0]?.url || d.url || null);
            return {
              type: (d.type === 'video' || (typeof d === 'string' && d.includes('.mp4'))) ? 'video' : 'image',
              title: typeof d === 'object' ? (d.title || d.grid_title || d.seo_alt_text || null) : null,
              description: typeof d === 'object' ? (d.description || null) : null,
              name: typeof d === 'object' ? (d.pinner?.full_name || d.full_name || d.name || null) : null,
              username: typeof d === 'object' ? (d.pinner?.username || d.username || null) : null,
              followers: typeof d === 'object' ? (d.pinner?.follower_count || d.followers || null) : null,
              likes: typeof d === 'object' ? (d.reaction_counts?.['1'] || d.likes || null) : null,
              created_at: typeof d === 'object' ? (d.created_at || d.created || null) : null,
              image: img
            };
          }).filter(r => r.image);
        } else if (res?.response?.pins?.length) {
          result = res.response.pins.map(p => ({ type: p.media?.video ? 'video' : 'image', title: p.title || null, description: p.description || null, name: p.uploader?.full_name || null, username: p.uploader?.username || null, followers: p.uploader?.followers || null, likes: null, created_at: null, image: p.media?.images?.orig?.url || null })).filter(r => r.image);
        } else if (res?.results?.length) {
          result = res.results.map(url => ({ type: 'image', title: null, description: null, name: null, username: null, followers: null, likes: null, created_at: null, image: typeof url === 'string' ? url : (url.image_url || url.image || url.url || null) })).filter(r => r.image);
        } else if (res?.result?.search_data?.length) {
          result = res.result.search_data.map(url => ({ type: 'image', title: null, description: null, name: null, username: null, followers: null, likes: null, created_at: null, image: typeof url === 'string' ? url : (url.image_url || url.image || url.url || null) })).filter(r => r.image);
        } else if (res?.result?.result?.length) {
          result = res.result.result.map(d => ({ type: d.media_urls?.[0]?.type || 'video', title: d.title || null, description: d.description || null, name: d.uploader?.full_name || null, username: d.uploader?.username || null, followers: d.uploader?.followers || null, likes: null, created_at: null, image: d.media_urls?.[0]?.url || null })).filter(r => r.image);
        }
        return (result && result.length > 0) ? result : null;
      }
    }));
    
    // Intentar APIs primero
    const apiResult = await executeWithFallback('pinterest', `${input}|search`, apis);
    if (apiResult) return apiResult;

    // Fallback final: Direct Scraper de Pinterest
    try {
      const scraped = await scrapePinterest(input, 15);
      if (scraped && scraped.length > 0) return scraped;
    } catch {
      return null;
    }
    
    return null;
  }
}

async function getAudioFromOpik(url) {
  try {
    const opik_api = 'https://dlp.opik.net/api/download';
    const opik_base = 'https://dlp.opik.net';
    const body = {
      args: `${url} -x --audio-format mp3 --embed-thumbnail`,
      label: ''
    };
    const res = await axios.post(opik_api, body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 25000
    });
    const file = res.data?.generated_files?.[0] || res.data?.job?.generated_files?.[0] || null;
    const download_url = res.data?.download_url || file?.absolute_url || file?.url || null;
    if (!download_url && !file?.url && !file?.absolute_url) return null;

    let full_url = download_url;
    if (full_url && !full_url.startsWith('http')) {
      full_url = new URL(full_url, opik_base).href;
    }
    return {
      url: full_url,
      name: file?.name || null,
      size: file?.size || null
    };
  } catch {
    return null;
  }
}

async function getVideoFromRyze(url) {
  try {
    const ryze_api = 'https://ryzecodes.xyz/api/scrapers/36/run';
    const ryze_key = 'ryzk0cdn';
    const ryze_format = '480p';
    
    const res = await axios.post(ryze_api, {
      input: {
        url,
        format: ryze_format,
        attempts: 6,
        interval_ms: 1100
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': ryze_key
      },
      timeout: 25000
    });

    const result = res.data?.result;
    if (!res.data?.success || !result?.success) return null;

    const video_url = result.file_url || result.download_urls?.[0] || null;
    if (!video_url) return null;

    return {
      url: video_url,
      title: result.title || null,
      quality: result.selected_media?.quality || result.format || ryze_format,
      size: result.selected_media?.size || null
    };
  } catch {
    return null;
  }
}

export function getVideoId(text = '') {
  const raw = String(text || '').trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    /[?&]v=([a-zA-Z0-9_-]{11})/
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

export function cleanYouTubeUrl(input = '') {
  const raw = String(input || '').trim();
  const id = getVideoId(raw);
  if (id) return `https://youtu.be/${id}`;
  return raw;
}

export async function getYouTubeAudioData(rawUrl) {
  const url = cleanYouTubeUrl(rawUrl);

  // 1. Try Lempi API (Fast and active)
  const apis = [
    {
      endpoint: `https://api.lempi.lat/dl/yta?url=${encodeURIComponent(url)}&apikey=montekey28`,
      extractor: res => {
        const downloadUrl = res.datos?.url || res.descarga?.url || res.data?.url || (typeof res.datos === 'string' ? res.datos : null);
        if (res.status && downloadUrl) {
          return {
            url: downloadUrl,
            title: res.titulo || res.title || 'YouTube Audio',
            author: res.canal || res.author || '',
            duration: res.duracion || res.duration || '',
            thumbnail: res.miniatura || res.thumbnail || '',
            api: 'Lempi'
          };
        }
        return null;
      }
    },
    {
      endpoint: `https://api.ryzendesu.vip/api/downloader/ytmp3?url=${encodeURIComponent(url)}`,
      extractor: res => res.url || res.data?.url || res.download ? { url: res.url || res.data?.url || res.download, api: 'RyzenDesu' } : null
    },
    {
      endpoint: `${getApiBase(config.APIs.vreden) || 'https://api.vreden.web.id'}/api/v1/download/youtube/audio?url=${encodeURIComponent(url)}&quality=256`,
      extractor: res => res.result?.download?.url ? { url: res.result.download.url, title: res.result.title, author: res.result.author?.name, duration: res.result.duration, thumbnail: res.result.image, api: 'Vreden' } : null
    },
    {
      endpoint: `${config.APIs.stellar?.url || 'https://api.yuki-wabot.my.id'}/dl/ytdl?url=${encodeURIComponent(url)}&format=mp3&key=${config.APIs.stellar?.key || 'zB5h1m-Gj4R8s-vT3q7x'}`,
      extractor: res => res.result?.download ? { url: res.result.download, title: res.result.title, api: 'Stellar' } : null
    },
    {
      endpoint: `https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(url)}`,
      extractor: res => res.data?.dl ? { url: res.data.dl, api: 'Siputzx' } : null
    }
  ];

  const apiRes = await executeWithFallback('youtube_audio', url, apis, { timeout: 15000 });
  if (apiRes) return apiRes;

  // Fallback to internal scrapers
  const opikResult = await getAudioFromOpik(url);
  if (opikResult?.url) return { url: opikResult.url, api: 'Opik' };

  const primaryResult = await scrapeYouTubeAudio(url);
  if (primaryResult) return primaryResult;

  return null;
}

export async function getYouTubeVideoData(rawUrl) {
  const url = cleanYouTubeUrl(rawUrl);

  // 1. Try Lempi API (Fast and active)
  const apis = [
    {
      endpoint: `https://api.lempi.lat/dl/ytv?url=${encodeURIComponent(url)}&apikey=montekey28`,
      extractor: res => {
        const downloadUrl = res.datos?.url || res.descarga?.url || res.data?.url || (typeof res.datos === 'string' ? res.datos : null);
        if (res.status && downloadUrl) {
          return {
            url: downloadUrl,
            title: res.titulo || res.title || 'YouTube Video',
            author: res.canal || res.author || '',
            duration: res.duracion || res.duration || '',
            thumbnail: res.miniatura || res.thumbnail || '',
            api: 'Lempi'
          };
        }
        return null;
      }
    },
    {
      endpoint: `https://api.ryzendesu.vip/api/downloader/ytmp4?url=${encodeURIComponent(url)}`,
      extractor: res => res.url || res.data?.url || res.download ? { url: res.url || res.data?.url || res.download, api: 'RyzenDesu' } : null
    },
    {
      endpoint: `${getApiBase(config.APIs.vreden) || 'https://api.vreden.web.id'}/api/v1/download/youtube/video?url=${encodeURIComponent(url)}&quality=720`,
      extractor: res => res.result?.download?.url ? { url: res.result.download.url, title: res.result.title, author: res.result.author?.name, duration: res.result.duration, thumbnail: res.result.image, api: 'Vreden' } : null
    },
    {
      endpoint: `${config.APIs.stellar?.url || 'https://api.yuki-wabot.my.id'}/dl/ytdl?url=${encodeURIComponent(url)}&format=mp4&key=${config.APIs.stellar?.key || 'zB5h1m-Gj4R8s-vT3q7x'}`,
      extractor: res => res.result?.download ? { url: res.result.download, title: res.result.title, api: 'Stellar' } : null
    },
    {
      endpoint: `https://api.siputzx.my.id/api/d/ytmp4?url=${encodeURIComponent(url)}`,
      extractor: res => res.data?.dl ? { url: res.data.dl, api: 'Siputzx' } : null
    }
  ];

  const apiRes = await executeWithFallback('youtube_video', url, apis, { timeout: 15000 });
  if (apiRes) return apiRes;

  // Fallback to internal scrapers
  const ryzeResult = await getVideoFromRyze(url);
  if (ryzeResult?.url) return { url: ryzeResult.url, api: 'Ryze' };

  const primaryResult = await scrapeYouTubeVideo(url);
  if (primaryResult) return primaryResult;

  return null;
}

export async function getGoogleImageData(query) {
  const apis = [
    { endpoint: `${config.APIs.stellar.url}/search/googleimagen?query=${encodeURIComponent(query)}&key=${config.APIs.stellar.key}`, extractor: res => res.data?.length ? res.data.map(d => ({ url: d.url, title: d.title || null, domain: d.domain || null, resolution: d.width && d.height ? `${d.width}x${d.height}` : null })) : null },
    { endpoint: `${getApiBase(config.APIs.siputzx) || 'https://api.siputzx.my.id'}/api/images?query=${encodeURIComponent(query)}`, extractor: res => res.data?.length ? res.data.map(d => ({ url: d.url, title: null, domain: null, resolution: d.width && d.height ? `${d.width}x${d.height}` : null })) : null },
    { endpoint: `${config.APIs.delirius.url}/search/gimage?query=${encodeURIComponent(query)}`, extractor: res => res.data?.length ? res.data.map(d => ({ url: d.url, title: d.origin?.title || null, domain: d.origin?.website?.domain || null, resolution: d.width && d.height ? `${d.width}x${d.height}` : null })) : null },
    { endpoint: `${config.APIs.apifaa.url}/faa/google-image?query=${encodeURIComponent(query)}`, extractor: res => res.result?.length ? res.result.map(u => ({ url: u, title: null, domain: null, resolution: null })) : null }
  ];
  return executeWithFallback('google_image', query, apis) || [];
}

export async function isImageUrl(url) {
  try {
    const res = await axios.head(url, {
      timeout: 3500,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    return res.status < 400 && res.headers['content-type']?.startsWith('image/');
  } catch {
    return /\.(jpe?g|png|gif|webp)(\?.*)?$/i.test(url);
  }
}

export async function getTwitterMedia(url) {
  const apis = [
    {
      endpoint: `${config.APIs.stellar.url}/dl/twitter?url=${encodeURIComponent(url)}&key=${config.APIs.stellar.key}`,
      extractor: res => {
        if (!res.status || !res.data?.result?.length) return null;
        const media = res.data.result[0];
        return { type: res.data.type, title: res.data.title || null, duration: res.data.duration || null, resolution: media.quality || null, url: media.url, thumbnail: res.data.thumbnail || null };
      }
    },
    {
      endpoint: `${config.APIs.nekolabs.url}/downloader/twitter?url=${encodeURIComponent(url)}`,
      extractor: res => {
        if (!res.success || !res.result?.media?.length) return null;
        const media = res.result.media[0];
        const variant = media.variants?.at(-1);
        return { type: media.type, title: res.result.title || null, resolution: variant?.resolution || null, url: variant?.url || null, thumbnail: media.cover || media.thumbnail || null };
      }
    },
    {
      endpoint: `${config.APIs.delirius.url}/download/twitterv2?url=${encodeURIComponent(url)}`,
      extractor: res => {
        if (!res.status || !res.data?.media?.length) return null;
        const media = res.data.media[0];
        const video = media.videos?.at(-1);
        return { type: media.type, title: res.data.description || null, author: res.data.author?.username || null, date: res.data.createdAt || null, duration: media.duration || null, resolution: video?.quality || null, url: video?.url || null, thumbnail: media.cover || null, views: res.data.view || null, likes: res.data.favorite || null, comments: res.data.replie || null, retweets: res.data.retweet || null };
      }
    },
    {
      endpoint: `${getApiBase(config.APIs.siputzx) || 'https://api.siputzx.my.id'}/api/d/twitter?url=${encodeURIComponent(url)}`,
      extractor: res => {
        if (!res.status || !res.data?.downloadLink) return null;
        return { type: 'video', title: res.data.videoTitle || null, url: res.data.downloadLink, thumbnail: res.data.imgUrl || null };
      }
    }
  ];
  return executeWithFallback('twitter', url, apis);
}

// Export a generic dispatcher for ease of use in command files
export async function getMedia(platform, url, options = {}) {
  switch (platform) {
    case 'facebook': return await getFacebookMedia(url);
    case 'facebook_search':
      throw new Error(
        'La búsqueda de Facebook no está disponible. Por favor, descargue directamente ingresando el enlace del video.'
      );
    case 'instagram': return await getInstagramMedia(url);
    case 'tiktok': return await getTikTokData(url, options.isUrl);
    case 'pinterest': return await getPinterestData(url, options.isUrl);
    case 'youtube_audio': return await getYouTubeAudioData(url);
    case 'youtube_video': return await getYouTubeVideoData(url);
    case 'google_image': return await getGoogleImageData(url);
    case 'twitter': return await getTwitterMedia(url);
    default: throw new Error(`Unsupported platform: ${platform}`);
  }
}
