// Global TLS bypass for Termux environments (must be FIRST)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import config from "./config.js";

// Bridge for legacy plugin globals
global.owner = config.owner;
global.botNumber = config.botNumber;
global.sessionName = config.sessionName;
global.version = config.version;
global.dev = config.dev;
global.links = config.links;
global.my = config.my;
global.mess = config.mess;
global.APIs = config.APIs;
global.APIKeys = config.APIKeys;
global.config = config;
import main, { initCommands } from './main.js';
import events from './core/system/events.js';
import { Browsers, makeWASocket, makeCacheableSignalKeyStore, useMultiFileAuthState, fetchLatestBaileysVersion, jidDecode, DisconnectReason } from "@whiskeysockets/baileys";
import cfonts from 'cfonts';
import pino from "pino";
import qrcode from "qrcode-terminal";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import readlineSync from "readline-sync";
import NodeCache from "node-cache";
import { smsg, decorateClient, getCachedMeta, setCachedMeta, deleteCachedMeta, setCachedPushName, patchGroupMetadata } from "./core/message.js";
import db from "./core/system/database.js";
import { exec } from "child_process";

import Logger from './utils/logger.js';

// Anti-crash handlers are at the bottom of this file
// ---------------------------
const log = {
  ...Logger,
  warning: Logger.warn
};

const maxCache = 100;
// PARCHE RENDER: Fijamos el número de teléfono desde el arranque
let phoneNumber = "573246039414"; 
let phoneInput = "";
const methodCodeQR = process.argv.includes("--qr");
const methodCode = process.argv.includes("code");
const DIGITS = (s = "") => String(s).replace(/\D/g, "");

function normalizePhoneForPairing(input) {
  let s = DIGITS(input);
  if (!s) return "";
  if (s.startsWith("0")) s = s.replace(/^0+/, "");
  if (s.length === 10 && s.startsWith("3")) s = "57" + s;
  if (s.startsWith("52") && !s.startsWith("521") && s.length >= 12) s = "521" + s.slice(2);
  if (s.startsWith("54") && !s.startsWith("549") && s.length >= 11) s = "549" + s.slice(2);
  return s;
}

const { say } = cfonts
console.log(chalk.magentaBright('\nIniciando...'))
say('Yuki Suou', {
  align: 'center',
  gradient: ['red', 'blue']
})
say('Made with love by Destroy', {
  font: 'console',
  align: 'center',
  gradient: ['blue', 'magenta']
})

if (!fs.existsSync('./tmp')) fs.mkdirSync('./tmp', { recursive: true });
const reconnecting = new Set();
const msgRetryCounterCache = new NodeCache();

async function cleanCache() {
  try {
    const tmpFolder = './tmp';
    if (fs.existsSync(tmpFolder)) {
      const files = await fs.promises.readdir(tmpFolder);
      let cleaned = 0;
      const now = Date.now();
      for (const file of files) {
        try {
          const filePath = path.join(tmpFolder, file);
          const stat = await fs.promises.stat(filePath);
          if (now - stat.mtimeMs > 10 * 60 * 1000) {
            await fs.promises.unlink(filePath);
            cleaned++;
          }
        } catch { }
      }
      if (cleaned > 0) console.log(chalk.gray(`[ 🗑️ ] Cache tmp: ${cleaned} archivos expirados eliminados`));
    }
    const sessionsFolder = './Sessions';
    if (fs.existsSync(sessionsFolder)) {
      const getFolderSizeBytes = async (dir) => {
        let total = 0;
        const files = await fs.promises.readdir(dir);
        for (const file of files) {
          try {
            const filePath = path.join(dir, file);
            const stat = await fs.promises.stat(filePath);
            total += stat.isDirectory() ? await getFolderSizeBytes(filePath) : stat.size;
          } catch { }
        }
        return total;
      };
      const sizeMB = (await getFolderSizeBytes(sessionsFolder)) / (1024 * 1024);
      if (sizeMB > maxCache) {
        console.log(chalk.yellow(`[ ⚠ ] Sessions ${sizeMB.toFixed(1)}MB — purgando sync temporal...`));
        const safeDeleteSync = async (dir) => {
          const files = await fs.promises.readdir(dir);
          for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = await fs.promises.stat(filePath);
            if (stat.isDirectory()) {
              await safeDeleteSync(filePath);
            } else if (file.startsWith('app-state-sync-') || file.startsWith('syncd-')) {
              try { await fs.promises.unlink(filePath); } catch { }
            }
          }
        };
        const botFolder = path.join(sessionsFolder, 'Owner');
        if (fs.existsSync(botFolder)) await safeDeleteSync(botFolder);
      }

      const cleanCorruptedFiles = async (dir) => {
        const files = await fs.promises.readdir(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          try {
            const stat = await fs.promises.stat(filePath);
            if (stat.isDirectory()) {
              await cleanCorruptedFiles(filePath);
            } else if (file.endsWith('.json') && file !== 'creds.json') {
              if (stat.size === 0) {
                await fs.promises.unlink(filePath);
                console.log(chalk.gray(`[ 🗑️ ] Archivo de sesión vacío eliminado: ${file}`));
              } else {
                const content = await fs.promises.readFile(filePath, 'utf-8');
                try {
                  JSON.parse(content);
                } catch {
                  await fs.promises.unlink(filePath);
                  console.log(chalk.yellow(`[ ⚠️ ] Archivo de sesión corrupto eliminado: ${file}`));
                }
              }
            }
          } catch { }
        }
      };
      const botFolder = path.join(sessionsFolder, 'Owner');
      if (fs.existsSync(botFolder)) await cleanCorruptedFiles(botFolder);
    }
  } catch (e) {
    console.error(chalk.red('Error en cleanCache: '), e);
  }
}

// PARCHE RENDER: Reestructuración limpia de la condicional de inicio
let opcion = "2";
if (methodCodeQR) {
  opcion = "1";
} else if (!fs.existsSync("./Sessions/Owner/creds.json")) {
  console.log(chalk.bold.green(`\n[ Parche Render ] Saltando lectura interactiva de TTY...`));
  // Mapeo directo sin invocar terminal interactiva readlineSync
}

let reconexion = 0;
const intentos = 15;
let lastActivityTimestamp = Date.now();

function cleanupSocket() {
  if (global.watchdogTimer) {
    clearInterval(global.watchdogTimer);
    global.watchdogTimer = null;
  }
  if (global.client) {
    try {
      global.client.ev.removeAllListeners();
      if (global.client.ws) {
        global.client.ws.close();
      }
    } catch { }
    global.client = null;
  }
}

const msgStore = new Map();
const msgLimit = 500;
global.msgStore = msgStore;

const versionCache = { value: null, expiresAt: 0 };
async function getVersion() {
  if (versionCache.value && Date.now() < versionCache.expiresAt) return versionCache.value;
  try {
    const latest = await fetchLatestBaileysVersion();
    versionCache.value = latest.version;
    versionCache.expiresAt = Date.now() + 60 * 60 * 1000;
  } catch (e) {
    if (!versionCache.value) versionCache.value =;
  }
  return versionCache.value;
}

async function warmupGroups(sock) {
  try {
    const allChats = db.data?.chats ? Object.keys(db.data.chats).map(id => ({ id })) : [];
    const chatIds = allChats
      .map(c => c.id || c)
      .filter(id => typeof id === 'string' && id.endsWith('@g.us'))
      .slice(0, 50);
    if (!chatIds.length) return;
    console.log(chalk.gray(`[ ✿ ] Precargando metadata de ${chatIds.length} grupos...`));
    const t = Date.now();
    const batches = [];
    for (let i = 0; i < chatIds.length; i += 10) {
      batches.push(chatIds.slice(i, i + 10));
    }
    await Promise.allSettled(batches.map(batch => Promise.allSettled(batch.map(async id => {
      try {
        const meta = await sock.groupMetadata(id);
        if (meta) setCachedMeta(id, meta);
      } catch { }
    }))));
    console.log(chalk.gray(`[ ✿ ] Warmup completado.`));
  } catch (e) {
    console.error(e);
  }
}
