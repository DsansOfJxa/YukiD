/**
 * 🕸️ utils_network.js — Comandos de red, consulta del clima, códigos QR y análisis de enlaces.
 * Reúne: clima, qr, tinyurl, inspect
 */
import { getUrlFromDirectPath } from "@whiskeysockets/baileys";
import { getGroupMeta, getBotSettings } from '../../utils/tools.js';

const startCase = (str) => str.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

function formatDate(n, locale = "es", includeTime = true) {
  if (!n) return "Fecha no disponible";
  let timestamp = Number(n);
  if (timestamp > 1e12) {
    timestamp = Math.floor(timestamp);
  } else if (timestamp < 1e10) {
    timestamp = Math.floor(timestamp * 1000);
  }
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "Fecha no válida";
  const optionsDate = { day: '2-digit', month: '2-digit', year: 'numeric' };
  const formattedDate = date.toLocaleDateString(locale, optionsDate);
  if (!includeTime) return formattedDate;
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const period = hours < 12 ? 'AM' : 'PM';
  return `${formattedDate}, ${hours}:${minutes}:${seconds} ${period}`;
}

function newsletterKey(key) {
  return startCase(key.replace(/_/g, " "))
    .replace("Id", "🆔 Identificador")
    .replace("State", "📌 Estado")
    .replace("Creation Time", "📅 Fecha de creación")
    .replace("Name Time", "✏️ Fecha de modificación del nombre")
    .replace("Name", "🏷️ Nombre")
    .replace("Description Time", "📝 Fecha de modificación de la descripción")
    .replace("Description", "📜 Descripción")
    .replace("Invite", "📩 Invitación")
    .replace("Handle", "👤 Alias")
    .replace("Picture", "🖼️ Imagen")
    .replace("Preview", "👀 Vista previa")
    .replace("Reaction Codes", "😃 Reacciones")
    .replace("Subscribers", "👥 Suscriptores")
    .replace("Verification", "✅ Verificación")
    .replace("Viewer Metadata", "🔍 Datos avanzados");
}

function formatValue(key, value, preview) {
  switch (key) {
    case "subscribers":
      return value ? value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "0";
    case "creation_time":
    case "nameTime":
    case "descriptionTime":
      return formatDate(value);
    case "description": 
    case "name":
      return value || "No disponible";
    case "state":
      switch (value) {
        case "ACTIVE": return "Activo";
        case "GEOSUSPENDED": return "Suspendido regionalmente";
        case "SUSPENDED": return "Suspendido";
        default: return value || "Desconocido";
      }
    case "reaction_codes":
      switch (value) {
        case "ALL": return "Todas permitidas";
        case "BASIC": return "Básicas permitidas";
        case "NONE": return "Sin reacciones";
        default: return value || "Desconocido";
      }
    case "verification":
      switch (value) {
        case "VERIFIED": return "Verificado";
        case "UNVERIFIED": return "No verificado";
        default: return value || "Desconocido";
      }
    case "mute":
      switch (value) {
        case "ON": return "Silenciado";
        case "OFF": return "Activo";
        default: return value || "Sin definir";
      }
    case "view_role":
      switch (value) {
        case "ADMIN": return "Administrador";
        case "OWNER": return "Propietario";
        case "SUBSCRIBER": return "Suscriptor";
        case "GUEST": return "Invitado";
        default: return value || "Desconocido";
      }
    case "picture":
      if (preview) {
        return getUrlFromDirectPath(preview);
      } else {
        return "No disponible";
      }
    default:
      return value !== null && value !== undefined ? value.toString() : "No disponible";
  }
}

function processObject(obj, prefix = "", preview) {
  let caption = "";
  if (!obj || typeof obj !== "object") return caption;
  Object.keys(obj).forEach(key => {
    const value = obj[key];
    if (typeof value === "object" && value !== null) {
      if (Object.keys(value).length > 0) {
        const sectionName = newsletterKey(prefix + key);
        caption += `\n*\`${sectionName}\`*\n`;
        caption += processObject(value, `${prefix}${key}_`, preview);
      }
    } else {
      const shortKey = prefix ? prefix.split("_").pop() + "_" + key : key;
      const displayValue = formatValue(shortKey, value, preview);
      const translatedKey = newsletterKey(shortKey);
      caption += `- *${translatedKey}:*\n${displayValue}\n`;
    }
  });
  return caption;
}

// ── COMANDOS ──

const cmdClima = {
  command: ['clima', 'weather', 'tiempo'],
  category: 'herramientas',
  desc: 'Consulta el estado meteorológico de cualquier ciudad.',
  usage: '.clima <ciudad>',
  run: async (client, m, args, usedPrefix, command) => {
    const ciudad = args.join(' ').trim();
    if (!ciudad) {
      return m.reply(`> 🌤️ *Por favor, ingresa el nombre de una ciudad.*\n\n*📌 Ejemplo:* \`${usedPrefix + command} Quito\` o \`${usedPrefix + command} Madrid\``);
    }

    try {
      await m.react('🌤️');
      const req = await fetch(`https://wttr.in/${encodeURIComponent(ciudad)}?format=j1`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(10000)
      });
      const res = await req.json();

      const current = res.current_condition?.[0];
      if (!current) throw new Error('No se encontraron datos meteorológicos');

      const name = res.nearest_area?.[0]?.areaName?.[0]?.value || ciudad;
      const country = res.nearest_area?.[0]?.country?.[0]?.value || '';
      const region = res.nearest_area?.[0]?.region?.[0]?.value || '';

      const temp = current.temp_C;
      const feelsLike = current.FeelsLikeC;
      const desc = current.lang_es ? current.lang_es[0].value : (current.weatherDesc?.[0]?.value || 'Despejado');
      const humidity = current.humidity;
      const wind = current.windspeedKmph;
      const uv = current.uvIndex || '0';

      const txt =
        `🌤️ *REPORTE DEL CLIMA*\n\n` +
        `> 📍 *Ubicación:* ${name}${region ? `, ${region}` : ''} (${country})\n` +
        `> 🌡️ *Temperatura:* ${temp}°C (Sensación: ${feelsLike}°C)\n` +
        `> ☁️ *Condición:* ${desc}\n` +
        `> 💧 *Humedad:* ${humidity}%\n` +
        `> 💨 *Viento:* ${wind} km/h\n` +
        `> ☀️ *Índice UV:* ${uv}`;

      await client.sendMessage(m.chat, { text: txt }, { quoted: m });
      await m.react('✔️');
    } catch (e) {
      await m.react('❌');
      return m.reply(`> ❌ *No se pudo obtener el clima de "${ciudad}".* Verifica que el nombre de la ciudad sea correcto.`);
    }
  }
};

const cmdQr = {
  command: ['qr', 'qrcode'],
  category: 'herramientas',
  desc: 'Genera un código QR a partir de texto o enlace.',
  usage: '.qr <texto o URL>',
  run: async (client, m, args, usedPrefix, command) => {
    let text = args.join(' ').trim();
    if (!text && m.quoted) {
      text = (m.quoted.text || m.quoted.caption || m.quoted.body || '').trim();
    }
    if (!text) {
      return m.reply(`> 📷 *Escribe un texto o URL para generar el Código QR.*\n\n*📌 Ejemplo:* \`${usedPrefix + command} https://google.com\``);
    }

    try {
      await m.react('🕒');
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=15&data=${encodeURIComponent(text)}`;
      const res = await fetch(qrUrl, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const qrBuffer = Buffer.from(await res.arrayBuffer());

      const caption =
        `📷 *CÓDIGO QR GENERADO*\n\n` +
        `> 📝 *Contenido:* \`${text.length > 80 ? text.substring(0, 77) + '...' : text}\``;

      await client.sendMessage(m.chat, { image: qrBuffer, caption }, { quoted: m });
      await m.react('✔️');
    } catch (e) {
      await m.react('❌');
      return m.reply(`> ❌ *Ocurrió un error al generar tu Código QR:*\n[${e.message}]`);
    }
  }
};

const cmdTinyUrl = {
  command: ['tiny', 'tinyurl', 'shorturl', 'acortar'],
  category: 'herramientas',
  desc: 'Acorta un enlace largo con servicios de URL acortada.',
  usage: '.tiny <enlace>',
  run: async (client, m, args, usedPrefix, command) => {
    let link = args[0];
    if (!link && m.quoted) {
      link = (m.quoted.text || m.quoted.caption || m.quoted.body || '').trim();
    }
    if (!link || !/^https?:\/\//i.test(link)) {
      return m.reply(`> 🔗 *Proporciona un enlace válido que comience con http:// o https://*\n\n*📌 Ejemplo:* \`${usedPrefix + command} https://ejemplo.com/pagina/muy/larga\``);
    }

    try {
      await m.react('🕒');
      let shortUrl = null;

      // Intento 1: TinyURL
      try {
        const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(link)}`, { signal: AbortSignal.timeout(6000) });
        const text = (await res.text()).trim();
        if (text && text.startsWith('http')) shortUrl = text;
      } catch {}

      // Intento 2: is.gd
      if (!shortUrl) {
        try {
          const res = await fetch(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(link)}`, { signal: AbortSignal.timeout(6000) });
          const text = (await res.text()).trim();
          if (text && text.startsWith('http')) shortUrl = text;
        } catch {}
      }

      // Intento 3: CleanURI
      if (!shortUrl) {
        try {
          const form = new URLSearchParams();
          form.append('url', link);
          const res = await fetch('https://cleanuri.com/api/v1/shorten', {
            method: 'POST',
            body: form,
            signal: AbortSignal.timeout(6000)
          });
          const json = await res.json();
          if (json.result_url) shortUrl = json.result_url;
        } catch {}
      }

      if (!shortUrl) throw new Error('Todos los servicios acortadores fallaron.');

      const caption =
        `🔗 *ENLACE ACORTADO CON ÉXITO*\n\n` +
        `> 🌐 *Original:* ${link}\n` +
        `> ✨ *Acortado:* ${shortUrl}`;

      await client.sendMessage(m.chat, { text: caption }, { quoted: m });
      await m.react('✔️');
    } catch (e) {
      await m.react('❌');
      return m.reply(`> ❌ *Error al acortar el enlace.* Verifica que la URL sea accesible.`);
    }
  }
};

const cmdInspect = {
  command: ["inspect", "inspeccionar"],
  category: 'herramientas',
  desc: "Inspecciona enlaces de grupos, comunidades y canales de WhatsApp.",
  usage: '.inspect [enlace de grupo/canal]',
  run: async (client, m, args, usedPrefix, command, text) => {
    let rawInput = text || args.join(' ').trim();
    if (!rawInput && m.quoted) {
      rawInput = (m.quoted.text || m.quoted.caption || m.quoted.body || '').trim();
    }

    if (!rawInput) {
      return m.reply(`> 🔍 *Por favor, ingresa el enlace de un grupo o canal de WhatsApp.*\n\n*📌 Ejemplo:* \`${usedPrefix + command} https://chat.whatsapp.com/xxxx\``);
    }

    await m.react('🕒');

    // 1. Detectar si es enlace de canal
    const channelMatch = rawInput.match(/(?:https:\/\/)?(?:www\.)?(?:chat\.|wa\.)?whatsapp\.com\/channel\/([0-9A-Za-z]{20,26})/i);
    if (channelMatch) {
      try {
        const channelUrl = channelMatch[1];
        const newsletterInfo = await client.newsletterMetadata("invite", channelUrl).catch(() => null);
        if (!newsletterInfo) {
          await m.react('❌');
          return m.reply('> ❌ *No se encontró información del canal.* Verifica que el enlace sea correcto y público.');
        }

        const details = processObject(newsletterInfo, "", newsletterInfo?.preview);
        const caption = `📢 *INSPECTOR DE CANALES DE WHATSAPP*\n\n${details}`;
        await client.sendMessage(m.chat, { text: caption.trim() }, { quoted: m });
        await m.react('✔️');
        return;
      } catch (e) {
        await m.react('❌');
        return m.reply(`> ❌ *Error al inspeccionar el canal:*\n[${e.message}]`);
      }
    }

    // 2. Detectar si es enlace de invitación de grupo
    const inviteMatch = rawInput.match(/(?:https:\/\/)?(?:www\.)?(?:chat\.|wa\.)?whatsapp\.com\/(?:invite\/|joinchat\/)?([0-9A-Za-z]{20,26})/i);
    if (inviteMatch) {
      try {
        const inviteCode = inviteMatch[1];
        const groupData = await client.groupGetInviteInfo(inviteCode);
        if (!groupData) {
          await m.react('❌');
          return m.reply('> ❌ *No se encontró información del grupo.* El enlace puede estar revocado.');
        }

        const { id, subject, size, creation, owner, desc, restrict, announce, isCommunity, isCommunityAnnounce, joinApprovalMode } = groupData;
        const ownerJid = owner ? client.decodeJid(owner) : null;
        const mentions = ownerJid ? [ownerJid] : [];

        const caption =
          `👥 *INSPECTOR DE GRUPOS DE WHATSAPP*\n\n` +
          `> 🏷️ *Nombre:* ${subject || 'Sin nombre'}\n` +
          `> 🆔 *JID:* \`${id || 'Desconocido'}\`\n` +
          `> 👑 *Creado por:* ${ownerJid ? `@${ownerJid.split('@')[0]}` : 'Desconocido'} (${formatDate(creation)})\n` +
          `> 👥 *Participantes:* ${size || 'Desconocido'}\n` +
          `> 🔒 *Solo Admins Enviar:* ${announce ? '✅ Sí' : '❌ No'}\n` +
          `> ⚙️ *Modificar Info Restringido:* ${restrict ? '✅ Sí' : '❌ No'}\n` +
          `> 🏘️ *Es Comunidad:* ${isCommunity ? '✅ Sí' : '❌ No'}\n` +
          `> 🤝 *Aprobación de Miembros:* ${joinApprovalMode ? '✅ Sí' : '❌ No'}\n\n` +
          `📄 *Descripción:*\n${desc ? desc.trim() : 'Sin descripción'}`;

        await client.sendMessage(m.chat, { text: caption.trim(), mentions }, { quoted: m });
        await m.react('✔️');
        return;
      } catch (e) {
        await m.react('❌');
        return m.reply(`> ❌ *No se pudo inspeccionar el grupo:* El enlace puede ser inválido o estar caducado.`);
      }
    }

    await m.react('❌');
    return m.reply('> ⚠️ *Enlace no reconocido.* Asegúrate de enviar un enlace válido de grupo o canal de WhatsApp.');
  }
};

export default [cmdClima, cmdQr, cmdTinyUrl, cmdInspect];
