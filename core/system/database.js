import path from 'path';
import fs from 'fs';
import { DatabaseSync } from 'node:sqlite';
import { AsyncLocalStorage } from 'async_hooks';
import Logger from '../../utils/logger.js';

const dbPath = path.join(process.cwd(), 'core', 'database.db');
const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA synchronous = NORMAL");
db.exec("PRAGMA cache_size = -32000");
db.exec("PRAGMA busy_timeout = 5000");

// Request-scoped storage for transactions (Unit of Work)
export const dbStorage = new AsyncLocalStorage();

const stmts = {};
function stmt(sql) {
  if (!stmts[sql]) stmts[sql] = db.prepare(sql);
  return stmts[sql];
}

class TtlCache {
  map = new Map();
  get(key) {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.ts > entry.ttl) { this.map.delete(key); return undefined; }
    return entry.data;
  }
  set(key, data, ttl) {
    this.map.set(key, { data, ts: Date.now(), ttl });
  }
  delete(key) { this.map.delete(key); }
  deletePrefix(prefix) {
    for (const k of this.map.keys()) if (k.startsWith(prefix)) this.map.delete(k);
  }
  clear() { this.map.clear(); }
  startGC(intervalMs = 120000) {
    const id = setInterval(() => {
      const now = Date.now();
      for (const [k, v] of this.map) if (now - v.ts > v.ttl) this.map.delete(k);
    }, intervalMs);
    id.unref?.();
    return id;
  }
}

const memCache = new TtlCache();
memCache.startGC();
const USER_CACHE_TTL = 600000;
const CHAT_CACHE_TTL = 600000;
const CHATUSER_CACHE_TTL = 600000;
const SET_CACHE_TTL = 300000;
const CHAR_CACHE_TTL = 600000;
const STICKERPACK_CACHE_TTL = 600000;

function toStore(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'object') return JSON.stringify(val);
  if (typeof val === 'boolean') return val ? 1 : 0;
  return val;
}

const TEXT_COLUMNS = [
  'name', 'pasatiempo', 'description', 'marry', 'genre', 'birth',
  'sWelcome', 'sGoodbye', 'afkReason', 'primaryBot', 'newsletter_id',
  'nameid', 'link', 'banner', 'icon', 'currency', 'namebot', 'botname', 'owner',
  'title', 'bannedReason', 'bibleVersion'
];

function parseRow(row, jsonFields) {
  if (!row) return row;
  const parsed = { ...row };
  for (const [k, v] of Object.entries(parsed)) {
    if (typeof v === 'string') {
      if (jsonFields.includes(k)) {
        try { parsed[k] = JSON.parse(v); } catch { }
      } else if (!TEXT_COLUMNS.includes(k)) {
        const trimmed = v.trim();
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
          try { parsed[k] = JSON.parse(v); } catch { }
        }
      }
    }
  }
  return parsed;
}

function getCacheKey(type, id) {
  return `${type}:${id}`;
}

export const defUser = {
  name: '',
  exp: 200,
  level: 0,
  usedcommands: 0,
  pasatiempo: '',
  description: '',
  marry: '',
  genre: '',
  birth: '',
  metadatos: null,
  metadatos2: null,
  coins: 0,
  bank: 0,
  health: 100,
  lastdaily: 0,
  lastweekly: 0,
  lastmonthly: 0,
  lastwork: 0,
  lastcrime: 0,
  lastmine: 0,
  lasthunt: 0,
  lastfish: 0,
  lastslut: 0,
  laststeal: 0,
  lastadventure: 0,
  lastdungeon: 0,
  lastinvoke: 0,
  lastppt: 0,
  lastslot: 0,
  lastApuesta: 0,
  inventory: '[]',
  streak: 0,
  lastDailyGlobal: 0,
  weeklyStreak: 0,
  lastWeeklyGlobal: 0,
  monthlyStreak: 0,
  lastMonthlyGlobal: 0,
  banned: 0,
  bannedReason: '',
  marryAnime: null,
  lastDate: 0,
  title: '',
  xpBoost: null,
  shield: null,
  luckBuff: null,
  fortuneBuff: null,
  triviaBuff: null,
  dungeonBuff: null,
  fenixRevive: 0,
  extraDaily: 0,
  cooldownSkip: 0
};

export const defChat = {
  isBanned: 0,
  welcome: 0,
  goodbye: 0,
  sWelcome: '',
  sGoodbye: '',
  nsfw: 0,
  alerts: 1,
  gacha: 1,
  economy: 1,
  adminonly: 0,
  primaryBot: null,
  antilinks: 1,
  antistatus: 0,
  rolls: '{}',
  warnLimit: 3,
  expulsar: 1,
  bible: 1,
  bibleVersion: 'NBLA'
};

export const defChatUser = {
  name: '',
  coins: 0,
  bank: 0,
  lastCmd: 0,
  usedTime: null,
  afk: -1,
  afkReason: '',
  health: 100,
  stamina: 100,
  magic: 100,
  characters: '[]',
  stats: '{}',
  warnings: '[]'
};

export const defSets = {
  self: 0,
  prefix: '["/","!",".","#"]',
  commandsejecut: 0,
  newsletter_id: '120363401404146384@newsletter',
  nameid: 'ೃ el bot de wasa.ೃ࿐',
  type: 'Owner',
  link: 'https://api.yuki-wabot.my.id',
  banner: 'https://vignette.wikia.nocookie.net/mlp/images/1/17/Pinkie_Pie_starts_rapping_EGS1.png/revision/latest?cb=20170811024135',
  icon: 'https://cdn.twibooru.org/img/2024/3/1/3173192/medium.jpeg',
  currency: 'Ecuadolares',
  namebot: 'el bot de wasa',
  botname: 'el bot de wasa',
  owner: ''
};

export const defStickerPack = {
  packs: '[]'
};

const userJsonFields = [
  'metadatos', 'metadatos2', 'inventory', 'luckBuff', 'fortuneBuff',
  'xpBoost', 'shield', 'triviaBuff', 'dungeonBuff', 'marryAnime'
];
const chatJsonFields = ['rolls'];
const chatUserJsonFields = ['characters', 'stats', 'warnings'];
const settingsJsonFields = ['prefix'];

export function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT DEFAULT '',
      exp INTEGER DEFAULT 0,
      level INTEGER DEFAULT 0,
      usedcommands INTEGER DEFAULT 0,
      pasatiempo TEXT DEFAULT '',
      description TEXT DEFAULT '',
      marry TEXT DEFAULT '',
      genre TEXT DEFAULT '',
      birth TEXT DEFAULT '',
      metadatos TEXT,
      metadatos2 TEXT
    )`);
  db.exec(`
    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      isBanned BOOLEAN DEFAULT 0,
      welcome BOOLEAN DEFAULT 0,
      goodbye BOOLEAN DEFAULT 0,
      sWelcome TEXT DEFAULT '',
      sGoodbye TEXT DEFAULT '',
      nsfw BOOLEAN DEFAULT 0,
      alerts BOOLEAN DEFAULT 1,
      gacha BOOLEAN DEFAULT 1,
      economy BOOLEAN DEFAULT 1,
      adminonly BOOLEAN DEFAULT 0,
      primaryBot TEXT,
      antistatus BOOLEAN DEFAULT 0,
      rolls TEXT DEFAULT '{}',
      warnLimit INTEGER DEFAULT 3,
      expulsar BOOLEAN DEFAULT 1
    )`);
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_users (
      chat_id TEXT,
      user_id TEXT,
      coins INTEGER DEFAULT 0,
      bank INTEGER DEFAULT 0,
      lastCmd INTEGER DEFAULT 0,
      usedTime TEXT,
      afk INTEGER DEFAULT -1,
      afkReason TEXT DEFAULT '',
      health INTEGER DEFAULT 100,
      stamina INTEGER DEFAULT 100,
      magic INTEGER DEFAULT 100,
      characters TEXT DEFAULT '[]',
      stats TEXT DEFAULT '{}',
      PRIMARY KEY (chat_id, user_id)
    )`);
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY,
      self BOOLEAN DEFAULT 0,
      prefix TEXT DEFAULT '["/","!",".","#"]',
      commandsejecut INTEGER DEFAULT 0,
      newsletter_id TEXT DEFAULT '120363401404146384@newsletter',
      nameid TEXT DEFAULT 'ೃ  Pinkanema.ೃ࿐',
      type TEXT DEFAULT 'Owner',
      link TEXT DEFAULT 'https://api.yuki-wabot.my.id',
      banner TEXT DEFAULT 'https://vignette.wikia.nocookie.net/mlp/images/1/17/Pinkie_Pie_starts_rapping_EGS1.png/revision/latest?cb=20170811024135',
      icon TEXT DEFAULT 'https://cdn.twibooru.org/img/2024/3/1/3173192/medium.jpeg',
      currency TEXT DEFAULT 'Yenes',
      namebot TEXT DEFAULT 'el bot de wasa',
      botname TEXT DEFAULT 'el bot de wasa',
      owner TEXT DEFAULT ''
    )`);
  db.exec(`CREATE TABLE IF NOT EXISTS characters (id TEXT PRIMARY KEY, data TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS sticker_packs (id TEXT PRIMARY KEY, packs TEXT DEFAULT '[]')`);
}

export function getUser(id, opt = {}) {
  if (!id) {
    const { orderBy, limit = null, desc = true } = opt;
    if (orderBy) {
      const allowedCols = ['exp', 'level', 'usedcommands', 'name', 'coins', 'bank'];
      if (!allowedCols.includes(orderBy)) throw new Error('Columna no permitida');
      let q = `SELECT * FROM users ORDER BY ${orderBy} ${desc ? 'DESC' : 'ASC'}`;
      if (limit) q += ` LIMIT ${limit}`;
      return stmt(q).all().map(r => parseRow(r, userJsonFields));
    }
    return stmt('SELECT * FROM users').all().map(r => parseRow(r, userJsonFields));
  }
  const key = getCacheKey('user', id);
  const cached = memCache.get(key);
  if (cached !== undefined) return cached;
  let user = stmt('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) {
    stmt(`INSERT OR IGNORE INTO users (id, name, exp, level, usedcommands, pasatiempo, description, marry, genre, birth, metadatos, metadatos2) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, defUser.name, defUser.exp, defUser.level, defUser.usedcommands, defUser.pasatiempo, defUser.description, defUser.marry, defUser.genre, defUser.birth, defUser.metadatos, defUser.metadatos2);
    user = stmt('SELECT * FROM users WHERE id = ?').get(id);
  }
  user = parseRow(user, userJsonFields);
  memCache.set(key, user, USER_CACHE_TTL);
  return user;
}

export function setUser(id, field, val) {
  const user = stmt('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) return;
  memCache.delete(getCacheKey('user', id));
  return stmt(`UPDATE users SET ${field} = ? WHERE id = ?`).run(toStore(val), id);
}

export function getChat(id) {
  if (!id) return stmt('SELECT * FROM chats').all().map(r => parseRow(r, chatJsonFields));
  const key = getCacheKey('chat', id);
  const cached = memCache.get(key);
  if (cached !== undefined) return cached;
  let chat = stmt('SELECT * FROM chats WHERE id = ?').get(id);
  if (!chat) {
    stmt(`INSERT OR IGNORE INTO chats (id, isBanned, welcome, goodbye, sWelcome, sGoodbye, nsfw, alerts, gacha, economy, adminonly, primaryBot, antilinks, antistatus, rolls, warnLimit, expulsar) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, defChat.isBanned, defChat.welcome, defChat.goodbye, defChat.sWelcome, defChat.sGoodbye, defChat.nsfw, defChat.alerts, defChat.gacha, defChat.economy, defChat.adminonly, defChat.primaryBot, defChat.antilinks, defChat.antistatus, defChat.rolls, defChat.warnLimit, defChat.expulsar);
    chat = stmt('SELECT * FROM chats WHERE id = ?').get(id);
  }
  chat = parseRow(chat, chatJsonFields);
  memCache.set(key, chat, CHAT_CACHE_TTL);
  return chat;
}

export function setChat(id, field, val) {
  const chat = stmt('SELECT id FROM chats WHERE id = ?').get(id);
  if (!chat) return;
  memCache.delete(getCacheKey('chat', id));
  return stmt(`UPDATE chats SET ${field} = ? WHERE id = ?`).run(toStore(val), id);
}

export function getChatUser(chatId, userId, opt = {}) {
  if (!chatId) {
    return stmt('SELECT * FROM chat_users').all().map(u => parseRow(u, chatUserJsonFields));
  }
  if (chatId && !userId) {
    const { orderBy, limit = null, desc = true } = opt;
    let query = 'SELECT * FROM chat_users WHERE chat_id = ?';
    const params = [chatId];
    if (orderBy) {
      const allowedCols = ['coins', 'bank', 'lastCmd', 'usedTime', 'afk', 'health', 'stamina', 'magic'];
      if (!allowedCols.includes(orderBy)) throw new Error('Columna no permitida');
      query += ` ORDER BY ${orderBy} ${desc ? 'DESC' : 'ASC'}`;
    }
    if (limit) { query += ' LIMIT ?'; params.push(limit); }
    return stmt(query).all(...params).map(u => parseRow(u, chatUserJsonFields));
  }
  const key = getCacheKey('chatuser', `${chatId}:${userId}`);
  const cached = memCache.get(key);
  if (cached !== undefined) return cached;
  let cu = stmt('SELECT * FROM chat_users WHERE chat_id = ? AND user_id = ?').get(chatId, userId);
  if (!cu) {
    stmt(`INSERT OR IGNORE INTO chat_users (chat_id, user_id, coins, bank, lastCmd, usedTime, afk, afkReason, health, stamina, magic, characters, stats) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(chatId, userId, defChatUser.coins, defChatUser.bank, defChatUser.lastCmd, defChatUser.usedTime, defChatUser.afk, defChatUser.afkReason, defChatUser.health, defChatUser.stamina, defChatUser.magic, defChatUser.characters, defChatUser.stats);
    cu = stmt('SELECT * FROM chat_users WHERE chat_id = ? AND user_id = ?').get(chatId, userId);
  }
  if (cu) {
    cu = parseRow(cu, chatUserJsonFields);
    memCache.set(key, cu, CHATUSER_CACHE_TTL);
  }
  return cu;
}

export function setChatUser(chatId, userId, field, val) {
  memCache.delete(getCacheKey('chatuser', `${chatId}:${userId}`));
  return stmt(`UPDATE chat_users SET ${field} = ? WHERE chat_id = ? AND user_id = ?`).run(toStore(val), chatId, userId);
}

export function getSettings(id) {
  if (!id) {
    return stmt('SELECT * FROM settings').all().map(row => parseRow(row, settingsJsonFields));
  }
  const key = getCacheKey('set', id);
  const cached = memCache.get(key);
  if (cached !== undefined) return cached;
  let row = stmt('SELECT * FROM settings WHERE id = ?').get(id);
  if (!row) {
    stmt(`INSERT OR IGNORE INTO settings (id, self, prefix, commandsejecut, newsletter_id, nameid, type, link, banner, icon, currency, namebot, botname, owner) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, defSets.self, defSets.prefix, defSets.commandsejecut, defSets.newsletter_id, defSets.nameid, defSets.type, defSets.link, defSets.banner, defSets.icon, defSets.currency, defSets.namebot, defSets.botname, defSets.owner);
    row = stmt('SELECT * FROM settings WHERE id = ?').get(id);
  }
  row = parseRow(row, settingsJsonFields);
  memCache.set(key, row, SET_CACHE_TTL);
  return row;
}

export function setSettings(id, field, val) {
  const setting = stmt('SELECT id FROM settings WHERE id = ?').get(id);
  if (!setting) return;
  memCache.delete(getCacheKey('set', id));
  let stored = val;
  if (val === true) stored = "1";
  else if (Array.isArray(val) || typeof val === 'object') stored = JSON.stringify(val);
  return stmt(`UPDATE settings SET ${field} = ? WHERE id = ?`).run(stored, id);
}

export function getCharacter(id) {
  const key = getCacheKey('char', id || 'all');
  const cached = memCache.get(key);
  if (cached !== undefined) return cached;
  if (!id) {
    const rows = stmt('SELECT id, data FROM characters').all();
    const characters = {};
    for (const row of rows) { characters[row.id] = parseRow({ data: row.data }, ['data']).data; }
    memCache.set(key, characters, CHAR_CACHE_TTL);
    return characters;
  }
  const row = stmt('SELECT data FROM characters WHERE id = ?').get(id);
  if (!row) return null;
  const data = parseRow({ data: row.data }, ['data']).data;
  memCache.set(key, data, CHAR_CACHE_TTL);
  return data;
}

export function setCharacter(id, data) {
  memCache.delete(getCacheKey('char', id));
  stmt('REPLACE INTO characters (id, data) VALUES (?, ?)').run(id, toStore(data));
  return true;
}

export function getStickersPack(id) {
  if (!id) return stmt('SELECT * FROM sticker_packs').all().map(r => parseRow(r, ['packs']));
  const key = getCacheKey('stickerpack', id);
  const cached = memCache.get(key);
  if (cached !== undefined) return cached;
  let stickerPack = stmt('SELECT * FROM sticker_packs WHERE id = ?').get(id);
  if (!stickerPack) {
    stmt(`INSERT OR IGNORE INTO sticker_packs (id, packs) VALUES (?, ?)`).run(id, defStickerPack.packs);
    stickerPack = stmt('SELECT * FROM sticker_packs WHERE id = ?').get(id);
  }
  stickerPack = parseRow(stickerPack, ['packs']);
  memCache.set(key, stickerPack, STICKERPACK_CACHE_TTL);
  return stickerPack;
}

export function setStickersPack(id, field, val) {
  const stickerPack = stmt('SELECT id FROM sticker_packs WHERE id = ?').get(id);
  if (!stickerPack) return;
  memCache.delete(getCacheKey('stickerpack', id));
  return stmt(`UPDATE sticker_packs SET ${field} = ? WHERE id = ?`).run(toStore(val), id);
}

export function deletedb(type, ...ids) {
  if (!type || !ids || ids.length === 0) return false;
  switch (type) {
    case 'user': memCache.delete(getCacheKey('user', ids[0])); return stmt('DELETE FROM users WHERE id = ?').run(ids[0]).changes > 0;
    case 'chat': memCache.delete(getCacheKey('chat', ids[0])); return stmt('DELETE FROM chats WHERE id = ?').run(ids[0]).changes > 0;
    case 'chatuser':
      if (ids.length < 2) return false;
      memCache.delete(getCacheKey('chatuser', `${ids[0]}:${ids[1]}`));
      return stmt('DELETE FROM chat_users WHERE chat_id = ? AND user_id = ?').run(ids[0], ids[1]).changes > 0;
    case 'settings': memCache.delete(getCacheKey('set', ids[0])); return stmt('DELETE FROM settings WHERE id = ?').run(ids[0]).changes > 0;
    case 'character': memCache.delete(getCacheKey('char', ids[0])); return stmt('DELETE FROM characters WHERE id = ?').run(ids[0]).changes > 0;
    case 'stickerpack': memCache.delete(getCacheKey('stickerpack', ids[0])); return stmt('DELETE FROM sticker_packs WHERE id = ?').run(ids[0]).changes > 0;
    default: return false;
  }
}

export function setCreate(table, identifier, field, value) {
  const tableConfig = {
    users: { primaryKeys: ['id'], identifierFields: ['id'], jsonFields: userJsonFields },
    chats: { primaryKeys: ['id'], identifierFields: ['id'], jsonFields: chatJsonFields },
    chat_users: { primaryKeys: ['chat_id', 'user_id'], identifierFields: ['chat_id', 'user_id'], jsonFields: chatUserJsonFields },
    settings: { primaryKeys: ['id'], identifierFields: ['id'], jsonFields: settingsJsonFields },
    characters: { primaryKeys: ['id'], identifierFields: ['id'], jsonFields: [], isSimpleTable: true },
    sticker_packs: { primaryKeys: ['id'], identifierFields: ['id'], jsonFields: ['packs'] }
  };
  const config = tableConfig[table];
  if (!config) throw new Error(`Tabla '${table}' no soportada`);
  if (config.isSimpleTable) {
    let existingData = getCharacter(identifier);
    if (!existingData) {
      setCharacter(identifier, { [field]: value });
      return value;
    }
    if (existingData[field] === undefined) {
      setCharacter(identifier, { ...existingData, [field]: value });
      return value;
    }
    return existingData[field];
  }
  const columnExists = (tableName, columnName) => {
    try {
      return stmt(`PRAGMA table_info(${tableName})`).all().some(col => col.name === columnName);
    } catch { return false; }
  };
  if (!columnExists(table, field)) {
    const sqlType = typeof value === 'number' ? 'INTEGER' : typeof value === 'boolean' ? 'BOOLEAN' : 'TEXT';
    let defaultVal = 'NULL';
    if (typeof value === 'number') defaultVal = '0';
    else if (typeof value === 'boolean') defaultVal = '0';
    else if (Array.isArray(value)) defaultVal = "'[]'";
    else if (typeof value === 'object' && value !== null) defaultVal = "'{}'";
    else if (typeof value === 'string') defaultVal = "''";
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${field} ${sqlType} DEFAULT ${defaultVal}`);
    for (const k of Object.keys(stmts).filter(k => k.includes(table))) {
      try { stmts[k].finalize(); } catch { }
      delete stmts[k];
    }
  }
  if (table === 'chat_users') {
    if (!Array.isArray(identifier) || identifier.length < 2) throw new Error('chat_users requiere [chatId, userId]');
    const [chatId, userId] = identifier;
    const record = getChatUser(chatId, userId);
    if (!record) {
      stmt(`INSERT OR IGNORE INTO chat_users (chat_id, user_id, ${field}) VALUES (?, ?, ?)`).run(chatId, userId, value);
      clearCache('chatuser', `${chatId}:${userId}`);
      return value;
    }
    if (record[field] === undefined) { setChatUser(chatId, userId, field, value); return value; }
    return record[field];
  } else if (table === 'users') {
    const record = getUser(identifier);
    if (!record) {
      stmt(`INSERT OR IGNORE INTO users (id, ${field}) VALUES (?, ?)`).run(identifier, value);
      clearCache('user', identifier);
      return value;
    }
    if (record[field] === undefined) { setUser(identifier, field, value); return value; }
    return record[field];
  } else if (table === 'chats') {
    const record = getChat(identifier);
    if (!record) {
      stmt(`INSERT OR IGNORE INTO chats (id, ${field}) VALUES (?, ?)`).run(identifier, value);
      clearCache('chat', identifier);
      return value;
    }
    if (record[field] === undefined) { setChat(identifier, field, value); return value; }
    return record[field];
  } else if (table === 'settings') {
    const record = getSettings(identifier);
    if (!record) {
      stmt(`INSERT OR IGNORE INTO settings (id, ${field}) VALUES (?, ?)`).run(identifier, value);
      clearCache('set', identifier);
      return value;
    }
    if (record[field] === undefined) { setSettings(identifier, field, value); return value; }
    return record[field];
  } else if (table === 'sticker_packs') {
    const record = getStickersPack(identifier);
    if (!record) {
      stmt(`INSERT OR IGNORE INTO sticker_packs (id, ${field}) VALUES (?, ?)`).run(identifier, value);
      clearCache('stickerpack', identifier);
      return value;
    }
    if (record[field] === undefined) { setStickersPack(identifier, field, value); return value; }
    return record[field];
  }
  return value;
}

export function clearCache(type, id) {
  if (type === undefined && id === undefined) { memCache.clear(); return true; }
  if (id) {
    memCache.delete(getCacheKey(type, id));
  } else {
    memCache.deletePrefix(`${type}:`);
  }
}

export function clearDB() {
  if (!global.cleardb) {
    global.cleardb = true;
    const INACTIVE_MS = 20 * 86400000;
    setInterval(() => {
      const now = Date.now();
      for (const cu of stmt('SELECT chat_id, user_id, usedTime, lastCmd FROM chat_users').all()) {
        const last = cu.lastCmd > 0 ? cu.lastCmd : (cu.usedTime ? new Date(JSON.parse(cu.usedTime)).getTime() : 0);
        if (last === 0 || now - last > INACTIVE_MS) {
          stmt('DELETE FROM chat_users WHERE chat_id = ? AND user_id = ?').run(cu.chat_id, cu.user_id);
          memCache.delete(getCacheKey('chatuser', `${cu.chat_id}:${cu.user_id}`));
        }
      }
      for (const u of stmt('SELECT id FROM users WHERE exp = 0 AND id NOT IN (SELECT user_id FROM chat_users)').all()) {
        stmt('DELETE FROM users WHERE id = ?').run(u.id);
        memCache.delete(getCacheKey('user', u.id));
      }
    }, 86400000);
  }
}

// ----------------------------------------------------
// Automatic JSON-to-SQLite Migration Routine
// ----------------------------------------------------
export function migrateJSONToSQLite() {
  const dbDir = path.join(process.cwd(), 'core');
  const userJson = path.join(dbDir, 'db_users.json');
  const chatJson = path.join(dbDir, 'db_chats.json');
  const setJson = path.join(dbDir, 'db_settings.json');
  const legacyJson = path.join(dbDir, 'database.json');

  if (fs.existsSync(userJson)) {
    try {
      const data = JSON.parse(fs.readFileSync(userJson, 'utf8'));
      Logger.info(`[DB] Migrando ${Object.keys(data).length} usuarios de JSON a SQLite...`);
      for (const [id, val] of Object.entries(data)) {
        stmt(`INSERT OR IGNORE INTO users (id) VALUES (?)`).run(id);
        for (const [k, v] of Object.entries(val)) {
          setCreate('users', id, k, v);
        }
      }
      fs.renameSync(userJson, userJson + '.migrated');
      Logger.info('[DB] Migración exitosa de usuarios JSON a SQLite');
    } catch (e) {
      Logger.error('[DB] Error migrando usuarios JSON', e);
    }
  }

  if (fs.existsSync(chatJson)) {
    try {
      const data = JSON.parse(fs.readFileSync(chatJson, 'utf8'));
      Logger.info(`[DB] Migrando ${Object.keys(data).length} chats de JSON a SQLite...`);
      for (const [chatId, val] of Object.entries(data)) {
        stmt(`INSERT OR IGNORE INTO chats (id) VALUES (?)`).run(chatId);
        for (const [k, v] of Object.entries(val)) {
          if (k === 'users') {
            for (const [userId, userVal] of Object.entries(v)) {
              stmt(`INSERT OR IGNORE INTO chat_users (chat_id, user_id) VALUES (?, ?)`).run(chatId, userId);
              for (const [uk, uv] of Object.entries(userVal)) {
                setCreate('chat_users', [chatId, userId], uk, uv);
              }
            }
          } else {
            setCreate('chats', chatId, k, v);
          }
        }
      }
      fs.renameSync(chatJson, chatJson + '.migrated');
      Logger.info('[DB] Migración exitosa de chats JSON a SQLite');
    } catch (e) {
      Logger.error('[DB] Error migrando chats JSON', e);
    }
  }

  if (fs.existsSync(setJson)) {
    try {
      const data = JSON.parse(fs.readFileSync(setJson, 'utf8'));
      Logger.info(`[DB] Migrando ${Object.keys(data).length} configuraciones de JSON a SQLite...`);
      for (const [id, val] of Object.entries(data)) {
        stmt(`INSERT OR IGNORE INTO settings (id) VALUES (?)`).run(id);
        for (const [k, v] of Object.entries(val)) {
          setCreate('settings', id, k, v);
        }
      }
      fs.renameSync(setJson, setJson + '.migrated');
      Logger.info('[DB] Migración exitosa de configuraciones JSON a SQLite');
    } catch (e) {
      Logger.error('[DB] Error migrando configuraciones JSON', e);
    }
  }

  if (fs.existsSync(legacyJson)) {
    try {
      const data = JSON.parse(fs.readFileSync(legacyJson, 'utf8'));
      Logger.info(`[DB] Migrando base de datos monolithic JSON a SQLite...`);
      if (data.users) {
        for (const [id, val] of Object.entries(data.users)) {
          stmt(`INSERT OR IGNORE INTO users (id) VALUES (?)`).run(id);
          for (const [k, v] of Object.entries(val)) setCreate('users', id, k, v);
        }
      }
      if (data.chats) {
        for (const [chatId, val] of Object.entries(data.chats)) {
          stmt(`INSERT OR IGNORE INTO chats (id) VALUES (?)`).run(chatId);
          for (const [k, v] of Object.entries(val)) {
            if (k === 'users') {
              for (const [userId, userVal] of Object.entries(v)) {
                stmt(`INSERT OR IGNORE INTO chat_users (chat_id, user_id) VALUES (?, ?)`).run(chatId, userId);
                for (const [uk, uv] of Object.entries(userVal)) setCreate('chat_users', [chatId, userId], uk, uv);
              }
            } else {
              setCreate('chats', chatId, k, v);
            }
          }
        }
      }
      if (data.settings) {
        for (const [id, val] of Object.entries(data.settings)) {
          stmt(`INSERT OR IGNORE INTO settings (id) VALUES (?)`).run(id);
          for (const [k, v] of Object.entries(val)) setCreate('settings', id, k, v);
        }
      }
      fs.renameSync(legacyJson, legacyJson + '.migrated');
      Logger.info('[DB] Migración exitosa de base de datos legacy JSON a SQLite');
    } catch (e) {
      Logger.error('[DB] Error migrando database.json legacy', e);
    }
  }
}

// Dynamic SQLite schema sync (adds columns on startup if missing)
try {
  initDB();
  const tables = [
    { name: 'users', def: defUser, exclude: ['id'] },
    { name: 'chats', def: defChat, exclude: ['id'] },
    { name: 'chat_users', def: defChatUser, exclude: ['chat_id', 'user_id'] },
    { name: 'settings', def: defSets, exclude: ['id'] },
    { name: 'sticker_packs', def: defStickerPack, exclude: ['id'] }
  ];
  for (const table of tables) {
    if (!stmt(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table.name)) continue;
    const existingCols = stmt(`PRAGMA table_info(${table.name})`).all();
    const existingNames = existingCols.map(c => c.name);
    const missingCols = Object.keys(table.def).filter(col => !existingNames.includes(col) && !table.exclude.includes(col));
    for (const col of missingCols) {
      const defaultValue = table.def[col];
      let sqlType = 'TEXT';
      if (typeof defaultValue === 'number') sqlType = 'INTEGER';
      else if (typeof defaultValue === 'boolean') sqlType = 'BOOLEAN';
      const defaultStr = defaultValue === null ? 'NULL' : JSON.stringify(defaultValue);
      db.exec(`ALTER TABLE ${table.name} ADD COLUMN ${col} ${sqlType} DEFAULT ${defaultStr}`);
      for (const k of Object.keys(stmts).filter(k => k.includes(table.name))) {
        try { stmts[k].finalize?.(); } catch { }
        delete stmts[k];
      }
      if (table.name === 'chat_users') {
        for (const row of stmt(`SELECT chat_id, user_id FROM ${table.name}`).all())
          stmt(`UPDATE ${table.name} SET ${col} = ? WHERE chat_id = ? AND user_id = ?`).run(toStore(defaultValue), row.chat_id, row.user_id);
      } else {
        for (const row of stmt(`SELECT id FROM ${table.name}`).all())
          stmt(`UPDATE ${table.name} SET ${col} = ? WHERE id = ?`).run(toStore(defaultValue), row.id);
      }
    }
  }
} catch (e) {
  Logger.error('[DB migration error]', e);
}

// ----------------------------------------------------
// Proxy Bridge Object for global.db / global.DATABASE
// ----------------------------------------------------
export class DbSession {
  constructor() {
    this.cache = {
      users: new Map(),
      chats: new Map(),
      settings: new Map(),
      chatUsers: new Map()
    };
    this.original = {
      users: new Map(),
      chats: new Map(),
      settings: new Map(),
      chatUsers: new Map()
    };
  }

  getUser(id) {
    if (this.cache.users.has(id)) return this.cache.users.get(id);
    const row = getUser(id);
    const cloned = JSON.parse(JSON.stringify(row));
    this.cache.users.set(id, cloned);
    this.original.users.set(id, JSON.stringify(row));
    return cloned;
  }

  getChat(id) {
    if (this.cache.chats.has(id)) return this.cache.chats.get(id);
    const row = getChat(id);
    const cloned = JSON.parse(JSON.stringify(row));
    this.cache.chats.set(id, cloned);
    this.original.chats.set(id, JSON.stringify(row));
    return cloned;
  }

  getSettings(id) {
    if (this.cache.settings.has(id)) return this.cache.settings.get(id);
    const row = getSettings(id);
    const cloned = JSON.parse(JSON.stringify(row));
    this.cache.settings.set(id, cloned);
    this.original.settings.set(id, JSON.stringify(row));
    return cloned;
  }

  flush() {
    // Commit user changes
    for (const [id, current] of this.cache.users.entries()) {
      const origStr = this.original.users.get(id);
      const orig = JSON.parse(origStr);
      for (const [k, v] of Object.entries(current)) {
        if (k.startsWith('_') || !(k in defUser)) continue;
        if (JSON.stringify(orig[k]) !== JSON.stringify(v)) {
          setUser(id, k, v);
        }
      }
    }
    // Commit chat changes (except users bridging)
    for (const [id, current] of this.cache.chats.entries()) {
      const origStr = this.original.chats.get(id);
      const orig = JSON.parse(origStr);
      for (const [k, v] of Object.entries(current)) {
        if (k === 'users' || k.startsWith('_') || !(k in defChat)) continue;
        if (JSON.stringify(orig[k]) !== JSON.stringify(v)) {
          setChat(id, k, v);
        }
      }
    }
    // Commit settings changes
    for (const [id, current] of this.cache.settings.entries()) {
      const origStr = this.original.settings.get(id);
      const orig = JSON.parse(origStr);
      for (const [k, v] of Object.entries(current)) {
        if (k.startsWith('_') || !(k in defSets)) continue;
        if (JSON.stringify(orig[k]) !== JSON.stringify(v)) {
          setSettings(id, k, v);
        }
      }
    }
    // Commit chatUsers changes
    for (const [key, current] of this.cache.chatUsers.entries()) {
      const [chatId, userId] = key.split(':');
      const origStr = this.original.chatUsers.get(key);
      const orig = JSON.parse(origStr);
      for (const [k, v] of Object.entries(current)) {
        if (k.startsWith('_') || !(k in defChatUser)) continue;
        if (JSON.stringify(orig[k]) !== JSON.stringify(v)) {
          setChatUser(chatId, userId, k, v);
        }
      }
    }
  }
}

export const dbProxy = new Proxy({
  users: {},
  chats: {},
  settings: {}
}, {
  get(target, table) {
    const session = dbStorage.getStore();
    if (table === 'users') {
      return new Proxy({}, {
        get(t, id) {
          if (typeof id !== 'string') return undefined;
          if (session) return session.getUser(id);
          return getUser(id);
        },
        set(t, id, val) {
          if (typeof id !== 'string') return false;
          if (session) {
            const obj = session.getUser(id);
            Object.assign(obj, val);
          } else {
            for (const [k, v] of Object.entries(val)) {
              setUser(id, k, v);
            }
          }
          return true;
        },
        has(t, id) {
          const row = stmt('SELECT id FROM users WHERE id = ?').get(id);
          return !!row;
        },
        ownKeys(t) {
          const rows = stmt('SELECT id FROM users').all();
          return rows.map(r => r.id);
        },
        getOwnPropertyDescriptor(t, prop) {
          return { enumerable: true, configurable: true };
        }
      });
    }
    if (table === 'chats') {
      return new Proxy({}, {
        get(t, chatId) {
          if (typeof chatId !== 'string') return undefined;
          let chatObj = session ? session.getChat(chatId) : getChat(chatId);

          return new Proxy(chatObj, {
            get(chat, key) {
              if (key === 'users') {
                return new Proxy({}, {
                  get(tu, userId) {
                    if (typeof userId !== 'string') return undefined;
                    if (session) {
                      const sessionKey = `${chatId}:${userId}`;
                      if (session.cache.chatUsers.has(sessionKey)) {
                        return session.cache.chatUsers.get(sessionKey);
                      }
                      const cu = getChatUser(chatId, userId);
                      const cloned = JSON.parse(JSON.stringify(cu));
                      session.cache.chatUsers.set(sessionKey, cloned);
                      session.original.chatUsers.set(sessionKey, JSON.stringify(cu));
                      return cloned;
                    }
                    return getChatUser(chatId, userId);
                  },
                  set(tu, userId, val) {
                    if (typeof userId !== 'string') return false;
                    if (session) {
                      const sessionKey = `${chatId}:${userId}`;
                      if (!session.cache.chatUsers.has(sessionKey)) {
                        const cu = getChatUser(chatId, userId);
                        session.cache.chatUsers.set(sessionKey, JSON.parse(JSON.stringify(cu)));
                        session.original.chatUsers.set(sessionKey, JSON.stringify(cu));
                      }
                      const obj = session.cache.chatUsers.get(sessionKey);
                      Object.assign(obj, val);
                    } else {
                      for (const [k, v] of Object.entries(val)) {
                        setChatUser(chatId, userId, k, v);
                      }
                    }
                    return true;
                  },
                  has(tu, userId) {
                    const row = stmt('SELECT user_id FROM chat_users WHERE chat_id = ? AND user_id = ?').get(chatId, userId);
                    return !!row;
                  },
                  ownKeys(tu) {
                    const rows = stmt('SELECT user_id FROM chat_users WHERE chat_id = ?').all(chatId);
                    return rows.map(r => r.user_id);
                  },
                  getOwnPropertyDescriptor(tu, prop) {
                    return { enumerable: true, configurable: true };
                  }
                });
              }
              return chat[key];
            }
          });
        },
        set(t, chatId, val) {
          if (typeof chatId !== 'string') return false;
          if (session) {
            const obj = session.getChat(chatId);
            for (const [k, v] of Object.entries(val)) {
              if (k === 'users') {
                Object.assign(obj.users, v);
              } else {
                obj[k] = v;
              }
            }
          } else {
            for (const [k, v] of Object.entries(val)) {
              if (k === 'users') {
                for (const [userId, userVal] of Object.entries(v)) {
                  for (const [uk, uv] of Object.entries(userVal)) {
                    setChatUser(chatId, userId, uk, uv);
                  }
                }
              } else {
                setChat(chatId, k, v);
              }
            }
          }
          return true;
        },
        has(t, id) {
          const row = stmt('SELECT id FROM chats WHERE id = ?').get(id);
          return !!row;
        },
        ownKeys(t) {
          const rows = stmt('SELECT id FROM chats').all();
          return rows.map(r => r.id);
        },
        getOwnPropertyDescriptor(t, prop) {
          return { enumerable: true, configurable: true };
        }
      });
    }
    if (table === 'settings') {
      return new Proxy({}, {
        get(t, id) {
          if (typeof id !== 'string') return undefined;
          if (session) return session.getSettings(id);
          return getSettings(id);
        },
        set(t, id, val) {
          if (typeof id !== 'string') return false;
          if (session) {
            const obj = session.getSettings(id);
            Object.assign(obj, val);
          } else {
            for (const [k, v] of Object.entries(val)) {
              setSettings(id, k, v);
            }
          }
          return true;
        },
        has(t, id) {
          const row = stmt('SELECT id FROM settings WHERE id = ?').get(id);
          return !!row;
        },
        ownKeys(t) {
          const rows = stmt('SELECT id FROM settings').all();
          return rows.map(r => r.id);
        },
        getOwnPropertyDescriptor(t, prop) {
          return { enumerable: true, configurable: true };
        }
      });
    }
    return target[table];
  }
});

const exportsObj = {
  data: dbProxy,
  initDB,
  getUser,
  setUser,
  getChat,
  setChat,
  getChatUser,
  setChatUser,
  getSettings,
  setSettings,
  getCharacter,
  setCharacter,
  getStickersPack,
  setStickersPack,
  deletedb,
  setCreate,
  clearCache,
  clearDB,
  migrateJSONToSQLite,
  db
};

global.db = exportsObj;
global.markPartitionDirty = () => { };
global.DATABASE = exportsObj;

export default exportsObj;