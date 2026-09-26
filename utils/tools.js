import axios from 'axios';
import NodeCache from 'node-cache';

// ── Network ──

export async function getBuffer(url, options) {
  const res = await axios({ method: 'get', url, headers: { DNT: 1, 'Upgrade-Insecure-Request': 1 }, timeout: 15000, ...options, responseType: 'arraybuffer' });
  return res.data;
}

// ── Time Formatting ──

export function runtime(seconds) {
  seconds = Number(seconds);
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const dDisplay = d > 0 ? d + (d == 1 ? ' day, ' : ' days, ') : '';
  const hDisplay = h > 0 ? h + (h == 1 ? ' hour, ' : ' hours, ') : '';
  const mDisplay = m > 0 ? m + (m == 1 ? ' minute, ' : ' minutes, ') : '';
  const sDisplay = s > 0 ? s + (s == 1 ? ' second' : ' seconds') : '';
  return dDisplay + hDisplay + mDisplay + sDisplay;
}



/**
 * Formats ms to readable spanish string.
 * 125000 → "2 minutos 5 segundos"
 */
export function formatTime(ms) {
  if (ms <= 0 || isNaN(ms)) return 'Ahora';
  const totalSec = Math.ceil(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const parts = [];
  if (days > 0) parts.push(`${days} día${days !== 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hora${hours !== 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} minuto${minutes !== 1 ? 's' : ''}`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds} segundo${seconds !== 1 ? 's' : ''}`);
  return parts.join(' ');
}

/** Alias for backwards compat */
export const msToTime = formatTime;

export function clockStringHuman(ms) {
  const d = Math.floor(ms / 86400000);
  const h = Math.floor(ms / 3600000) % 24;
  const m = Math.floor(ms / 60000) % 60;
  const s = Math.floor(ms / 1000) % 60;
  const parts = [];
  if (d > 0) parts.push(`${d} ${d === 1 ? 'día' : 'días'}`);
  if (h > 0) parts.push(`${h} ${h === 1 ? 'hora' : 'horas'}`);
  if (m > 0) parts.push(`${m} ${m === 1 ? 'minuto' : 'minutos'}`);
  if (s > 0) parts.push(`${s} ${s === 1 ? 'segundo' : 'segundos'}`);
  return parts.join(' ') || '0 segundos';
}

// ── Size Formatting ──

export function bytesToSize(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// ── Utility ──

export function pickRandom(list) {
  return list[Math.floor(list.length * Math.random())];
}

export async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isUrl(url) {
  return url.match(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/gi);
}

export function parseMention(text = '') {
  return [...text.matchAll(/@([0-9]{5,16}|0)/g)].map((v) => v[1] + '@s.whatsapp.net');
}

export function getGroupAdmins(participants) {
  const admins = [];
  for (const i of participants) {
    if (i.admin === 'superadmin' || i.admin === 'admin') admins.push(i.id);
  }
  return admins;
}

// ── Economy Helpers ──

export function formatNumber(number) {
  return Number(number).toLocaleString();
}

export function getBotId(client) {
  return (client?.user?.id?.split(':')[0] || '') + '@s.whatsapp.net';
}

export function getBotSettings(client) {
  return global.db.data.settings[getBotId(client)] || {};
}

export function getBotCurrency(client) {
  return getBotSettings(client).currency || 'Yenes';
}

// ── Level/XP ──

const XP_GROWTH = Math.pow(Math.PI / Math.E, 1.618) * Math.E * 0.75;

export function xpRange(level, multiplier = global.multiplier || 2) {
  if (level < 0) throw new TypeError('level cannot be negative value');
  level = Math.floor(level);
  const min = level === 0 ? 0 : Math.round(Math.pow(level, XP_GROWTH) * multiplier) + 1;
  const max = Math.round(Math.pow(level + 1, XP_GROWTH) * multiplier);
  return { min, max, xp: max - min };
}

export function findLevel(xp, multiplier = global.multiplier || 2) {
  if (xp === Infinity) return Infinity;
  if (isNaN(xp)) return NaN;
  if (xp <= 0) return -1;

  const XP_GROWTH = Math.pow(Math.PI / Math.E, 1.618) * Math.E * 0.75;
  let approx = Math.floor(Math.pow((xp - 1) / multiplier, 1 / XP_GROWTH));
  if (approx < 0) approx = 0;

  let level = approx;
  while (xpRange(level + 1, multiplier).min <= xp) {
    level++;
  }
  while (level > 0 && xpRange(level, multiplier).min > xp) {
    level--;
  }
  return level;
}

export function canLevelUp(level, xp, multiplier = global.multiplier || 2) {
  if (level < 0) return false;
  if (xp === Infinity) return true;
  if (isNaN(xp)) return false;
  if (xp <= 0) return false;
  return level < findLevel(xp, multiplier);
}

// ── Group Meta (cached) ──
const localGroupMetaCache = new NodeCache({ stdTTL: 300, checkperiod: 60, useClones: false });

export async function getGroupMeta(client, chatId) {
  if (!chatId?.endsWith('@g.us')) return null;
  if (global.groupMetaCache) {
    const cached = global.groupMetaCache.get(chatId);
    if (cached) return cached;
  }
  const localCached = localGroupMetaCache.get(chatId);
  if (localCached) return localCached;

  const metadata = await client?.groupMetadata?.(chatId).catch(() => null);
  if (metadata) {
    localGroupMetaCache.set(chatId, metadata);
    if (global.groupMetaCache) {
      global.groupMetaCache.set(chatId, metadata);
    }
  }
  return metadata;
}

// ── Duration Parser ──

export function msParser(str) {
  const match = String(str).match(/^(\d+)([smhd])$/i);
  if (!match) return null;
  const num = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return num * (multipliers[unit] || 0);
}

// ── HTTP Wrappers (Consolidated) ──
export async function httpGet(url, options = {}) {
  const response = await axios.get(url, options);
  return response.data;
}

export async function httpPost(url, body, options = {}) {
  const response = await axios.post(url, body, options);
  return response.data;
}

export const httpAxios = axios;

// ── Cache Manager (Consolidated) ──
class Cache {
  constructor() {
    this.store = new NodeCache({ stdTTL: 300, checkperiod: 60, useClones: false });
  }
  static key(...parts) {
    return parts.map(p => typeof p === 'object' ? JSON.stringify(p) : String(p)).join('|');
  }
  get(key) {
    return this.store.get(key);
  }
  set(key, value, ttlMs = 5 * 60 * 1000) { 
    const ttlSeconds = Math.ceil(ttlMs / 1000);
    this.store.set(key, value, ttlSeconds);
  }
  clear() {
    this.store.flushAll();
  }
}
export const cache = new Cache();

// ── Free Translation Helper (Consolidated) ──
export async function translate(text, to = 'es', from = 'auto') {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await axios.get(url);
    if (res.data && res.data[0]) {
      return res.data[0].map((item) => item[0]).join('');
    }
    return text;
  } catch (err) {
    console.error('[Tools] Error al traducir texto', err);
    return text;
  }
}

// ── URL Extractor Helper (Consolidated) ──
const URL_REGEX_EXTRACT = /https?:\/\/[^\s]+/i;
export function extractUrl(m, text) {
  if (text) {
    const match = text.match(URL_REGEX_EXTRACT);
    if (match) return match[0];
  }
  if (m.quoted) {
    const quotedText = m.quoted.text || m.quoted.body || '';
    const match = quotedText.match(URL_REGEX_EXTRACT);
    if (match) return match[0];
  }
  return null;
}
