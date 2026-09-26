import initDB from "./initDB.js";
import antilink from "./antilink.js";
import antistatus from "./antistatus.js";
import config from "../../config.js";
import NodeCache from "node-cache";
import chalk from "chalk";
import Logger from "../../utils/logger.js";
import level from "../../utils/levelHook.js";
import { registry } from "./commandLoader.js";
import { enqueueTask } from "../../utils/mediaQueue.js";
import { gameEngine } from "../../utils/gameEngine.js";
import { getCachedMeta, setCachedMeta, setCachedPushName } from "../message.js";

// Cache for spam and cooldowns
const spamCache = new Map();
const cooldownCache = new Map();
const cooldownWarnCache = new Map();

// Intervals for cleaning caches to prevent memory leaks
setInterval(
  () => {
    const now = Date.now();
    for (const [sender, state] of spamCache.entries()) {
      if (now - state.lastMessageTime > 600000) spamCache.delete(sender);
    }
  },
  60 * 60 * 1000,
);

setInterval(
  () => {
    const now = Date.now();
    for (const [key, expiresAt] of cooldownCache.entries()) {
      if (now > expiresAt) cooldownCache.delete(key);
    }
    for (const [key, warnedAt] of cooldownWarnCache.entries()) {
      if (now > warnedAt) cooldownWarnCache.delete(key);
    }
  },
  60 * 60 * 1000,
);

// Set of commands allowed in private chats
const ALLOWED_IN_PRIVATE = new Set([
  "play",
  "mp3",
  "play2",
  "mp4",
  "facebook",
  "fb",
  "tiktok",
  "tt",
  "instagram",
  "ig",
  "pinterest",
  "pin",
  "imagen",
  "img",
  "chatgpt",
  "ia",
  "humanizar",
  "hd",
  "remini",
  "read",
  "readviewonce",
  "ocr",
  "texto",
  "ssweb",
  "ss",
  "inspect",
  "get",
  "fetch",
  "apa",
  "citar",
  "tts",
  "audio",
  "decir",
  "clima",
  "weather",
  "tiny",
  "shorturl",
  "acortar",
  "recordar",
  "remind",
  "trad",
  "traducir",
  "tr",
  "qr",
  "qrcode",
  "yts",
  "ytsr",
  "wiki",
  "wikipedia",
  "math",
  "calcular",
  "resumir",
  "resumen",
  "pomodoro",
  "estudio",
  "trivia",
  "preguntados",
  "frase",
  "motivacion",
  "quote",
  "corregir",
  "ortografia",
  "parafrasear",
  "reescribir",
  "def",
  "significado",
  "diccionario",
  "ruleta",
  "sorteo",
  "asignar",
  "menu",
  "help",
  "allmenu",
  "ping",
  "p",
  "status",
  "botstats",
  "stats",
  "estado",
  "balance",
  "bal",
  "saldo",
  "profile",
  "perfil",
  "inv",
  "inventory",
  "inventario",
  // Stickers
  "s",
  "sticker",
  "wm",
  "take",
  "brat",
  "bratv",
  "qc",
  "emojimix",
  // Descargas adicionales
  "twitter",
  "x",
  "threads",
  "ytmp3",
  "ytmp4",
  "media",
]);

// Recalculates Colombia today date string
let _cachedToday = "";
let _todayExpiry = 0;
function getToday() {
  const now = Date.now();
  if (now > _todayExpiry) {
    _cachedToday = new Date()
      .toLocaleDateString("es-CO", {
        timeZone: "America/Bogota",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
      .split("/")
      .reverse()
      .join("-");
    _todayExpiry = now + 60000;
  }
  return _cachedToday;
}

// ----------------------------------------------------
// Pipeline Engine
// ----------------------------------------------------
export async function runPipeline(ctx, middlewares) {
  let index = -1;
  async function dispatch(i) {
    if (i <= index) throw new Error("next() called multiple times");
    index = i;
    const fn = middlewares[i];
    if (fn) {
      try {
        return await fn(ctx, () => dispatch(i + 1));
      } catch (err) {
        throw err;
      }
    }
  }
  return dispatch(0);
}

// ----------------------------------------------------
// Middlewares
// ----------------------------------------------------

export async function dbInitMiddleware(ctx, next) {
  const { client, m } = ctx;
  if (m.isBot && m.fromMe) return;

  initDB(m, client);
  if (m.isGroup) {
    antilink(client, m);
    antistatus(client, m);
  }

  // Buffer messages para comandos como .q, .q2, .q3
  global.msgBuffer = global.msgBuffer || {};
  global.msgBuffer[m.chat] = global.msgBuffer[m.chat] || [];
  global.msgBuffer[m.chat].push(m);
  if (global.msgBuffer[m.chat].length > 100) global.msgBuffer[m.chat].shift();

  const bufKeys = Object.keys(global.msgBuffer);
  if (bufKeys.length > 50) delete global.msgBuffer[bufKeys[0]];

  const botJid = (client?.user?.id?.split(":")[0] || "") + "@s.whatsapp.net";
  const chat = global.db.data.chats[m.chat] || {};
  const settings = global.db.data.settings[botJid] || {};
  const user = (global.db.data.users[m.sender] ||= {});

  if (!chat.users) chat.users = {};
  if (!chat.users[m.sender]) chat.users[m.sender] = {};
  const users = chat.users[m.sender];
  const pushname = m.pushName || user.name || "Sin nombre";

  if (m.pushName) {
    user.name = m.pushName;
    users.name = m.pushName;
    setCachedPushName(m.sender, m.pushName);
  }

  let groupMetadata = null;
  let groupAdmins = [];
  let groupName = "";

  if (m.isGroup) {
    groupMetadata = getCachedMeta(m.chat);
    if (!groupMetadata) {
      groupMetadata = await client.groupMetadata(m.chat).catch(() => null);
      if (groupMetadata) {
        setCachedMeta(m.chat, groupMetadata);
      }
    }
    groupName = groupMetadata?.subject || "";
    groupAdmins =
      groupMetadata?.participants?.filter(
        (p) => p.admin === "admin" || p.admin === "superadmin",
      ) || [];
  }

  const isBotAdmins = m.isGroup
    ? groupAdmins.some(
        (p) =>
          p.phoneNumber === botJid ||
          p.jid === botJid ||
          p.id === botJid ||
          p.lid === botJid,
      )
    : false;
  const isAdmins = m.isGroup
    ? groupAdmins.some(
        (p) =>
          p.phoneNumber === m.sender ||
          p.jid === m.sender ||
          p.id === m.sender ||
          p.lid === m.sender,
      )
    : false;
  const isOwners = [
    botJid,
    ...(settings.owner ? [settings.owner] : []),
    ...config.owner.map((num) => num + "@s.whatsapp.net"),
  ].includes(m.sender);

  ctx.botJid = botJid;
  ctx.chat = chat;
  ctx.settings = settings;
  ctx.user = user;
  ctx.users = users;
  ctx.pushname = pushname;
  ctx.sender = m.sender;
  ctx.groupMetadata = groupMetadata;
  ctx.groupAdmins = groupAdmins;
  ctx.groupName = groupName;
  ctx.isBotAdmins = isBotAdmins;
  ctx.isAdmins = isAdmins;
  ctx.isOwners = isOwners;

  for (const name in global.plugins) {
    const plugin = global.plugins[name];
    if (plugin && typeof plugin.all === "function") {
      try {
        await plugin.all(client, m);
      } catch (err) {
        console.error(`Error en plugin.all -> ${name}`, err);
      }
    }
  }

  return next();
}

const prefixCacheMap = new Map();

function getBotPrefixRegex(botJid, settings) {
  const pc = prefixCacheMap.get(botJid);
  const prefixChanged =
    !pc ||
    !(pc.regex instanceof RegExp) ||
    pc.namebot !== settings.namebot ||
    pc.type !== settings.type ||
    pc.prefixSettings !== settings.prefix;

  if (prefixChanged) {
    const rawBotname = settings.namebot || "Yuki";
    const cleanBotname = rawBotname.replace(/[^a-zA-Z0-9\s]/g, "");
    const namebot = cleanBotname || "Yuki";
    const shortForms = [
      namebot.charAt(0),
      namebot.split(" ")[0],
      namebot.split(" ")[0].slice(0, 2),
      namebot.split(" ")[0].slice(0, 3),
    ];
    const prefixes = shortForms.map((name) => `${name}`);
    prefixes.unshift(namebot);
    let prefixReg;
    if (Array.isArray(settings.prefix) || typeof settings.prefix === "string") {
      const prefixArray = Array.isArray(settings.prefix)
        ? settings.prefix
        : [settings.prefix];
      prefixReg = new RegExp(
        "^(" +
          prefixes.join("|") +
          ")?(" +
          prefixArray
            .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
            .join("|") +
          ")",
        "i",
      );
    } else if (settings.prefix === true) {
      prefixReg = new RegExp("^", "i");
    } else {
      prefixReg = new RegExp("^(" + prefixes.join("|") + ")?", "i");
    }
    const newEntry = {
      namebot: settings.namebot,
      type: settings.type,
      prefixSettings: settings.prefix,
      regex: prefixReg,
    };
    prefixCacheMap.set(botJid, newEntry);
    return prefixReg;
  }
  return pc.regex;
}

export async function prefixResolverMiddleware(ctx, next) {
  const { client, m, settings, users, botJid } = ctx;

  const today = getToday();
  if (!users.stats) users.stats = {};
  if (!users.stats[today]) users.stats[today] = { msgs: 0, cmds: 0 };
  users.stats[today].msgs++;
  global.markPartitionDirty("chats");
  ctx.today = today;

  const jidKey = botJid || (client?.user?.id?.split(":")[0] || "") + "@s.whatsapp.net";
  let prefix = getBotPrefixRegex(jidKey, settings);
  const strRegex = (str) => str.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
  let customCmd = null;
  let pluginPrefix = client.prefix ? client.prefix : prefix;

  for (const [cmdName, data] of registry.comandos) {
    if (data && data.customPrefix) {
      const cp = data.customPrefix;
      const ms = cp instanceof RegExp
        ? [[cp.exec(m.text), cp]]
        : Array.isArray(cp)
          ? cp.map((p) => {
              let r = p instanceof RegExp ? p : new RegExp(strRegex(p));
              return [r.exec(m.text), r];
            })
          : typeof cp === "string"
            ? [[new RegExp(strRegex(cp)).exec(m.text), new RegExp(strRegex(cp))]]
            : [[null, null]];
      if (ms.find((p) => p[0])) {
        customCmd = cmdName;
        pluginPrefix = cp;
        break;
      }
    }
  }

  let matchs =
    pluginPrefix instanceof RegExp
      ? [[pluginPrefix.exec(m.text), pluginPrefix]]
      : Array.isArray(pluginPrefix)
        ? pluginPrefix.map((p) => {
            let regex = p instanceof RegExp ? p : new RegExp(strRegex(p));
            return [regex.exec(m.text), regex];
          })
        : typeof pluginPrefix === "string"
          ? [
              [
                new RegExp(strRegex(pluginPrefix)).exec(m.text),
                new RegExp(strRegex(pluginPrefix)),
              ],
            ]
          : [[null, null]];
  let match = matchs.find((p) => p[0]);

  if (!match) {
    if (global.queueSaveDatabase) global.queueSaveDatabase();
    return;
  }

  ctx.match = match;
  ctx.customCmd = customCmd;
  return next();
}

export async function pluginInterceptorMiddleware(ctx, next) {
  const { client, m } = ctx;
  const hasActiveGames = gameEngine.activeSessions > 0;
  if (hasActiveGames) {
    console.log(
      chalk.yellow(
        `[🎮 GameEngine] Mensaje recibido en chat con juegos activos. Texto: "${m.text || ""}"`,
      ),
    );
  }
  let intercepted = false;
  for (const name in global.plugins) {
    const plugin = global.plugins[name];
    if (!plugin) continue;
    if (plugin.disabled) continue;
    if (typeof plugin.before === "function") {
      try {
        if (hasActiveGames) {
          console.log(
            chalk.gray(`  -> Evaluando interceptor 'before' de: ${name}`),
          );
        }
        const res = await plugin.before(client, m);
        if (hasActiveGames) {
          console.log(chalk.gray(`  <- Interceptor ${name} retornó: ${res}`));
        }
        if (res) {
          intercepted = true;
          break;
        }
      } catch (err) {
        console.error(
          chalk.red(`[❌ Error] Error en plugin.before -> ${name}:`),
          err,
        );
      }
    }
  }

  if (intercepted) return;
  return next();
}

export async function commandParserMiddleware(ctx, next) {
  const { m, match, settings } = ctx;

  let usedPrefix = (match[0] || [])[0] || "";
  const body = m.text.slice(usedPrefix.length).trim();
  let command;
  let text = "";
  let args = [];

  if (ctx.customCmd) {
    command = ctx.customCmd;
    text = body;
    args = body.split(/\s+/).filter(Boolean);
  } else {
    const firstSpaceIdx = body.search(/\s/);
    if (firstSpaceIdx === -1) {
      command = body
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      text = "";
      args = [];
    } else {
      command = body
        .slice(0, firstSpaceIdx)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      text = body.slice(firstSpaceIdx).trim();
      args = text.split(/\s+/).filter(Boolean);
    }
  }

  if (!command) return;

  const cmdData = registry.getCommand(command);
  if (!cmdData) {
    if (settings.prefix === true) return;
    return m.reply(
      `ꕤ El comando *${command}* no existe.\nUsa *${usedPrefix}help* para ver los comandos.`,
    );
  }

  ctx.usedPrefix = usedPrefix;
  ctx.args = args;
  ctx.command = command;
  ctx.text = text;
  ctx.cmdData = cmdData;

  return next();
}

export async function restrictionGuardsMiddleware(ctx, next) {
  const {
    client,
    m,
    command,
    usedPrefix,
    text,
    isOwners,
    isAdmins,
    isBotAdmins,
    chat,
    settings,
    user,
    cmdData,
  } = ctx;

  if (!isOwners && settings.self) return;

  if (m.chat && !m.chat.endsWith("g.us") && !isOwners) {
    if (!ALLOWED_IN_PRIVATE.has(command) && !cmdData?.isPrivate) return;
  }

  const isBotControlCmd = (command === "bot" || command === "boton" || command === "botoff");
  const isWakingBot = (text && ['on', 'enable', 'activar', 'encender'].some(act => text.toLowerCase().startsWith(act))) || command === "boton";
  if (chat?.isBanned && !(isBotControlCmd && (isAdmins || isOwners || isWakingBot)) && !isOwners) {
    return m.reply(
      `El bot *${settings.botname}* está desactivado en este grupo.\n\nUn *administrador* puede activarlo con:\n*${usedPrefix}bot on*`,
    );
  }

  if (m.text && user.banned && !isOwners) {
    return m.reply(
      `Estás baneado/a, no puedes usar comandos.\n\n● *Razón ›* ${user.bannedReason || "Sin especificar"}`,
    );
  }

  if (m.isGroup && chat.adminonly && !isAdmins && !isOwners) {
    return client.reply(
      m.chat,
      `⚠️ *MODO ADMIN ACTIVO*\nSolo administradores pueden usar comandos en este momento.`,
      m,
    );
  }

  if (cmdData.isOwner && !isOwners) {
    if (settings.prefix === true) return;
    return m.reply(
      `ꕤ El comando *${command}* no existe.\nUsa *${usedPrefix}help* para ver los comandos.`,
    );
  }
  if (cmdData.isAdmin && !isAdmins && !isOwners)
    return client.reply(m.chat, global.mess.admin, m);
  if (cmdData.botAdmin && !isBotAdmins)
    return client.reply(m.chat, global.mess.botAdmin, m);

  if (cmdData.economy) {
    const chatEco = global.db.data.chats[m.chat] || {};
    if (!chatEco.economy) {
      return m.reply(
        `Los comandos de *Economía* están desactivados en este grupo.\n\nUn *administrador* puede activarlos con:\n*${usedPrefix}economy on*`,
      );
    }
  }

  return next();
}

export async function antiSpamGuardMiddleware(ctx, next) {
  const { m, isOwners, sender } = ctx;
  const now = Date.now();
  let spam = spamCache.get(sender);
  if (!spam) {
    spam = { lastMessageTime: 0, warnedSpam: false };
    spamCache.set(sender, spam);
  }
  if (now - spam.lastMessageTime < 1500 && !isOwners) {
    if (!spam.warnedSpam) {
      spam.warnedSpam = true;
      spam.lastMessageTime = now + 3000;
      return m.reply(`*¡No hagas spam!* Espera un momento.`);
    }
    return;
  }
  spam.warnedSpam = false;
  spam.lastMessageTime = now;

  return next();
}

export async function cooldownGuardMiddleware(ctx, next) {
  const { m, isOwners, sender, command, cmdData, user } = ctx;
  const now = Date.now();
  const cmdCooldown = (cmdData.cooldown || 0) * 1000;
  if (cmdCooldown > 0 && !isOwners) {
    if (user.cooldownSkip) {
      user.cooldownSkip = false; // Consume the skip
    } else {
      const cdKey = `${sender}:${command}`;
      const expiresAt = cooldownCache.get(cdKey) || 0;
      if (now < expiresAt) {
        const warnedAt = cooldownWarnCache.get(cdKey) || 0;
        if (now > warnedAt) {
          const timeLeft = Math.ceil((expiresAt - now) / 1000);
          cooldownWarnCache.set(cdKey, now + 5000);
          return m.reply(
            `⏳ Cooldown: espera *${timeLeft}s* para usar *${command}* de nuevo.`,
          );
        }
        return;
      }
      cooldownCache.set(cdKey, now + cmdCooldown);
    }
  }

  return next();
}

export async function mediaQueueMiddleware(ctx, next) {
  const { client, m, cmdData } = ctx;
  if (!cmdData || !cmdData.heavy) return next();

  let queueMessage = null;
  const queuePromise = enqueueTask(m, (position) => {
    client
      .sendMessage(
        m.chat,
        {
          text: `⏳ *Cola de Procesamiento* ⏳\n\nEl servidor está procesando otras descargas o stickers.\nTu solicitud ha sido encolada en la posición *#${position}*. Por favor espera...`,
        },
        { quoted: m },
      )
      .then((msg) => {
        queueMessage = msg;
      })
      .catch(() => {});
  });

  const release = await queuePromise;

  if (queueMessage) {
    try {
      await client.sendMessage(m.chat, { delete: queueMessage.key });
    } catch {}
  }

  try {
    return await next();
  } finally {
    release();
  }
}

export async function executorMiddleware(ctx) {
  const {
    client,
    m,
    args,
    usedPrefix,
    command,
    text,
    cmdData,
    user,
    settings,
    users,
    pushname,
    groupName,
    sender,
    today,
  } = ctx;
  const now = Date.now();

  // Console logging
  if (m.message) {
    const ts = new Date().toLocaleString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "America/Bogota",
    });
    console.log(
      chalk.bold.blue(
        `╭──── CMD ────···\n` +
          `│ 📅 ${ts}\n` +
          `│ 👤 ${pushname} (${sender.split("@")[0]})\n` +
          `│ ${m.isGroup ? "👥 " + groupName : "💬 Privado"}\n` +
          `│ ⌨️ ${command}\n` +
          `╰────────────···`,
      ),
    );
  }

  try {
    await client.readMessages([m.key]);
    user.usedcommands = (user.usedcommands || 0) + 1;
    settings.commandsejecut = (settings.commandsejecut || 0) + 1;
    users.usedTime = new Date();
    users.lastCmd = Date.now();

    // XP gain
    let xpGain = Math.floor(Math.random() * 16) + 5;
    if (user.xpBoost && user.xpBoost.expiresAt > now) {
      xpGain = Math.floor(xpGain * user.xpBoost.multiplier);
    }
    if (user.fortuneBuff && user.fortuneBuff.expiresAt > now) {
      xpGain = Math.floor(xpGain * (1 + user.fortuneBuff.value));
    }
    user.exp = (user.exp || 0) + xpGain;
    user.name = m.pushName;
    users.stats[today].cmds++;

    await cmdData.run(client, m, args, usedPrefix, command, text);
  } catch (error) {
    Logger.error(`Error al ejecutar ${command}:`, error);
    await client.sendMessage(
      m.chat,
      { text: `❌ Error al ejecutar el comando\n[${error.message}]` },
      { quoted: m },
    ).catch(() => {});
  } finally {
    global.markPartitionDirty("users");
    global.markPartitionDirty("chats");
    global.markPartitionDirty("settings");
    if (global.queueSaveDatabase) global.queueSaveDatabase();
  }

  level(m);
}
