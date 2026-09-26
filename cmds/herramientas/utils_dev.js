/**
 * 🛠️ utils_dev.js — Utilidades web y capturas de pantalla de alta velocidad.
 * Comando: ss (ssweb, screenshot, captura)
 */

// Helper para validar si un buffer es una imagen válida (PNG, JPEG, WebP)
function isValidImageBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 2048) return false;
  // PNG: 89 50 4E 47 | JPEG: FF D8 FF | WebP: 52 49 46 46 ... 57 45 42 50
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
  const isJpg = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  const isWebp = buffer.slice(0, 4).toString() === 'RIFF' && buffer.slice(8, 12).toString() === 'WEBP';
  return isPng || isJpg || isWebp;
}

const cmdSsWeb = {
  command: ['ssweb', 'ss', 'screenshot', 'captura'],
  category: 'herramientas',
  desc: 'Captura de pantalla de cualquier sitio web.',
  usage: '.ss <url> [--mobile | --full]',
  run: async (client, m, args, usedPrefix, command) => {
    try {
      let rawText = args.join(' ').trim();
      if (!rawText && m.quoted) {
        rawText = (m.quoted.text || m.quoted.caption || m.quoted.body || '').trim();
      }

      if (!rawText) {
        return m.reply(
          `> 🌐 *Por favor, ingresa el enlace (URL) de una página web.*\n\n` +
          `*📌 Ejemplo:* \`${usedPrefix + command} https://google.com\`\n` +
          `*📱 Modo Móvil:* \`${usedPrefix + command} https://github.com --mobile\`\n` +
          `*📜 Página Completa:* \`${usedPrefix + command} https://wikipedia.org --full\``
        );
      }

      // Detectar flags de vista
      const isMobile = /--(?:mobile|phone|movil)|-m\b/i.test(rawText);
      const isFull = /--(?:full|completa|fullpage)|-f\b/i.test(rawText);
      const cleanInput = rawText.replace(/--(?:mobile|phone|movil|full|completa|fullpage)|-[mf]\b/gi, '').trim();

      // Extraer y normalizar URL
      let url = cleanInput.split(/\s+/)[0];
      if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
      }

      let parsedUrl;
      try {
        parsedUrl = new URL(url);
      } catch {
        return m.reply('> ❌ *URL inválida.* Verifica el enlace e intenta nuevamente.');
      }

      // Protección contra SSRF / IPs locales privadas
      const host = parsedUrl.hostname.toLowerCase();
      if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|0\.|::1|fe80:)/i.test(host) || host.endsWith('.local') || host.endsWith('.internal')) {
        return m.reply('> ❌ *No está permitido capturar direcciones de red local o privadas.*');
      }

      await m.react('🕒');
      const startTime = Date.now();
      const encUrl = encodeURIComponent(parsedUrl.href);

      // Dimensiones según el modo seleccionado
      const width = isMobile ? 412 : 1280;
      const height = isMobile ? 915 : 800;

      // Proveedores de captura ultrarrápidos con fallback
      const providers = [
        {
          name: 'WordPress mShots',
          url: `https://s0.wp.com/mshots/v1/${encUrl}?w=${width}&h=${height}`
        },
        {
          name: 'Microlink',
          url: `https://api.microlink.io?url=${encUrl}&screenshot=true&meta=false&embed=screenshot.url${isFull ? '&screenshot.fullPage=true' : ''}${isMobile ? '&viewport.width=412&viewport.height=915&viewport.isMobile=true' : ''}`
        },
        {
          name: 'Thum.io',
          url: isFull
            ? `https://image.thum.io/get/fullpage/noanimate/${parsedUrl.href}`
            : `https://image.thum.io/get/width/${width}/crop/${height}/noanimate/${parsedUrl.href}`
        }
      ];

      let imageBuffer = null;
      let usedProvider = '';

      for (const provider of providers) {
        try {
          const res = await fetch(provider.url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            signal: AbortSignal.timeout(12000)
          });

          if (res.ok) {
            const buf = Buffer.from(await res.arrayBuffer());
            if (isValidImageBuffer(buf)) {
              imageBuffer = buf;
              usedProvider = provider.name;
              break;
            }
          }
        } catch {
          // Continuar al siguiente proveedor de forma transparente
        }
      }

      if (!imageBuffer) {
        await m.react('❌');
        return m.reply('> ❌ *No se pudo generar la captura de pantalla.* El sitio web puede estar caído o bloqueando solicitudes.');
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const modeText = isFull ? 'Página Completa' : (isMobile ? 'Móvil (412x915)' : 'Escritorio (1280x800)');

      const caption =
        `📸 *CAPTURA DE PANTALLA WEB*\n\n` +
        `> 🌐 *Sitio:* \`${parsedUrl.hostname}\`\n` +
        `> 🔗 *URL:* ${parsedUrl.href}\n` +
        `> 📱 *Modo:* ${modeText}\n` +
        `> ⚡ *Tiempo:* ${elapsed}s\n` +
        `> ⚙️ *Servidor:* ${usedProvider}\n\n` +
        `_Captura generada con éxito_`;

      await client.sendMessage(m.chat, { image: imageBuffer, caption }, { quoted: m });
      await m.react('✔️');
    } catch (error) {
      await m.react('❌');
      return m.reply(`> ❌ *Ocurrió un error inesperado al capturar la página:*\n[${error.message}]`);
    }
  }
};

export default [cmdSsWeb];
