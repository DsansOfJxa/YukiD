/**
 * ⚙️ group_config.js — Comandos de configuración, información y enlaces del grupo.
 * Reúne: setgpname, setgpdesc, setgpbanner, open, closet, gp, link, revoke
 */
import { getGroupMeta, getBotSettings, msParser, clockStringHuman } from '../../utils/tools.js';
import path from 'path';
import fs from 'fs';

const cmdSetGpName = {
  command: ['setgpname'],
  category: 'grupo',
  desc: 'Configurar el nombre del grupo.',
  isAdmin: true,
  botAdmin: true,
  run: async (client, m, args) => {
    const newName = args.join(' ').trim();
    if (!newName) return m.reply('> ✏️ *Por favor, ingresa el nuevo nombre para el grupo.*');
    try {
      await client.groupUpdateSubject(m.chat, newName);
      return m.reply(`> ✅ *El nombre del grupo se actualizó correctamente a:* \`${newName}\``);
    } catch (e) {
      return m.reply(`> ❌ *Error al actualizar el nombre del grupo:*\n[${e.message}]`);
    }
  }
};

const cmdSetGpDesc = {
  command: ['setgpdesc'],
  category: 'grupo',
  desc: 'Cambiar la descripción del grupo.',
  isAdmin: true,
  botAdmin: true,
  run: async (client, m, args) => {
    const newDesc = args.join(' ').trim();
    if (!newDesc) return m.reply('> 📝 *Por favor, ingresa la nueva descripción para el grupo.*');
    try {
      await client.groupUpdateDescription(m.chat, newDesc);
      return m.reply('> ✅ *La descripción del grupo se modificó correctamente.*');
    } catch (e) {
      return m.reply(`> ❌ *Error al actualizar la descripción del grupo:*\n[${e.message}]`);
    }
  }
};

const cmdSetGpBanner = {
  command: ['setgpbanner', 'setgpp', 'setgppic', 'setgpfoto', 'grouppp', 'setgrouppic', 'gpicture', 'grouppicture'],
  category: 'grupo',
  desc: 'Cambiar la foto de perfil del grupo respondiendo a una imagen o sticker.',
  isAdmin: true,
  botAdmin: true,
  run: async (client, m) => {
    const q = m.quoted ? m.quoted : m;
    const mime = (q.msg || q).mimetype || q.mediaType || '';
    const isImage = /image/.test(mime) || q.type === 'imageMessage';
    const isSticker = /webp/.test(mime) || q.type === 'stickerMessage';

    if (!isImage && !isSticker) {
      return m.reply('> 🖼️ *Por favor, responde a una imagen o sticker que quieras usar como foto del grupo.*');
    }

    await m.react('🕒');

    let imgBuffer = null;
    try {
      if (typeof q.download === 'function') {
        imgBuffer = await q.download();
      }
    } catch (e) {
      console.error('[setgpbanner download error]', e);
    }

    if (!imgBuffer || !imgBuffer.length) {
      await m.react('❌');
      return m.reply('> ❌ *No se pudo descargar la imagen o sticker seleccionado.*');
    }

    // Intento 1: Actualización directa por Buffer
    try {
      await client.updateProfilePicture(m.chat, imgBuffer);
      await m.react('✔️');
      return m.reply('> ✅ *¡La foto de perfil del grupo se actualizó con éxito!*');
    } catch (e1) {
      // Intento 2: Fallback guardando archivo temporal
      try {
        const tmpDir = path.join(process.cwd(), 'tmp');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
        const imgPath = path.join(tmpDir, `gpp_${Date.now()}.jpg`);
        fs.writeFileSync(imgPath, imgBuffer);

        await client.updateProfilePicture(m.chat, { url: imgPath });
        try { fs.unlinkSync(imgPath); } catch {}

        await m.react('✔️');
        return m.reply('> ✅ *¡La foto de perfil del grupo se actualizó con éxito!*');
      } catch (e2) {
        await m.react('❌');
        const errMsg = e2?.message || e1?.message || String(e2 || e1 || '');
        if (errMsg.includes('not-authorized')) {
          return m.reply('> ❌ *El bot no tiene permisos suficientes de administrador para cambiar la foto del grupo.*');
        }
        return m.reply(`> ❌ *Error al cambiar la foto del grupo:*\n[${errMsg}]`);
      }
    }
  }
};

const cmdOpen = {
  command: ['open', 'abrir'],
  category: 'grupo',
  desc: 'Abrir el grupo para que todos los miembros puedan enviar mensajes.',
  isAdmin: true,
  botAdmin: true,
  run: async (client, m, args) => {
    try {
      const timeout = args[0] ? msParser(args[0]) : 0;
      if (args[0] && !timeout) {
        return client.reply(m.chat, 'Formato de tiempo inválido. Usa por ejemplo: 10s, 5m, 2h, 1d', m);
      }
      const groupMetadata = await getGroupMeta(client, m.chat);
      if (groupMetadata.announce === false) {
        return m.reply(`> ⚠️ *El grupo ya se encuentra abierto.*`);
      }
      const applyAction = async () => {
        await client.groupSettingUpdate(m.chat, 'not_announcement');
        return m.reply(`> 🔓 *El grupo ha sido abierto para todos los miembros.*`);
      };
      if (timeout > 0) {
        await m.reply(`> ⏳ *El grupo se abrirá automáticamente en ${clockStringHuman(timeout)}.*`);
        setTimeout(async () => {
          try {
            const md = await getGroupMeta(client, m.chat);
            if (md.announce === false) return;
            await applyAction();
          } catch {}
        }, timeout);
      } else {
        await applyAction();
      }
    } catch (e) {
      return m.reply(`> ❌ *Error al abrir el grupo:*\n[${e.message}]`);
    }
  }
};

const cmdCloset = {
  command: ['closet', 'close', 'cerrar'],
  category: 'grupo',
  desc: 'Cerrar el grupo para que solo los administradores envíen mensajes.',
  isAdmin: true,
  botAdmin: true,
  run: async (client, m, args) => {
    try {
      const timeout = args[0] ? msParser(args[0]) : 0;
      if (args[0] && !timeout) {
        return client.reply(m.chat, 'Formato de tiempo inválido. Usa por ejemplo: 10s, 5m, 2h, 1d', m);
      }
      const groupMetadata = await getGroupMeta(client, m.chat);
      if (groupMetadata.announce === true) {
        return m.reply(`> ⚠️ *El grupo ya se encuentra cerrado.*`);
      }
      const applyAction = async () => {
        await client.groupSettingUpdate(m.chat, 'announcement');
        return m.reply(`> 🔒 *El grupo ha sido cerrado (Solo Administradores).*`);
      };
      if (timeout > 0) {
        await m.reply(`> ⏳ *El grupo se cerrará automáticamente en ${clockStringHuman(timeout)}.*`);
        setTimeout(async () => {
          try {
            const md = await getGroupMeta(client, m.chat);
            if (md.announce === true) return;
            await applyAction();
          } catch {}
        }, timeout);
      } else {
        await applyAction();
      }
    } catch (e) {
      return m.reply(`> ❌ *Error al cerrar el grupo:*\n[${e.message}]`);
    }
  }
};

const cmdGp = {
  command: ['gp', 'groupinfo', 'infogrupo'],
  category: 'grupo',
  desc: 'Muestra la información y ajustes del grupo.',
  run: async (client, m) => {
    if (!m.isGroup) return m.reply('> ❌ Este comando solo se puede usar en grupos.');
    try {
      const groupMetadata = await getGroupMeta(client, m.chat) || {};
      const groupName = groupMetadata.subject || 'Grupo';
      const groupCreator = groupMetadata.owner ? '@' + client.decodeJid(groupMetadata.owner).split('@')[0] : 'Desconocido';
      const participants = groupMetadata.participants || [];
      const groupAdmins = participants.filter(p => (p.admin === 'admin' || p.admin === 'superadmin'));
      const totalParticipants = participants.length;

      const chat = global.db.data?.chats?.[m.chat] || {};
      const botname = getBotSettings(client)?.botname || 'Bot';

      const settings = {
        bot: chat.isBanned ? '🔴 Desactivado' : '🟢 Activado',
        antilinks: chat.antilinks ? '🟢 Activado' : '🔴 Desactivado',
        alerts: chat.alerts ? '🟢 Activado' : '🔴 Desactivado',
        adminonly: chat.adminonly ? '🟢 Activado' : '🔴 Desactivado',
        welcome: chat.welcome ? '🟢 Activado' : '🔴 Desactivado',
        economy: chat.economy ? '🟢 Activado' : '🔴 Desactivado'
      };

      const message =
        `👥 *INFORMACIÓN DEL GRUPO*\n\n` +
        `> 🏷️ *Nombre:* ${groupName}\n` +
        `> 🆔 *JID:* \`${m.chat}\`\n` +
        `> 👑 *Creador:* ${groupCreator}\n` +
        `> 🛡️ *Administradores:* ${groupAdmins.length}\n` +
        `> 👥 *Miembros:* ${totalParticipants}\n\n` +
        `⚙️ *CONFIGURACIÓN DEL BOT*\n` +
        `> • ${botname}: ${settings.bot}\n` +
        `> • AntiLinks: ${settings.antilinks}\n` +
        `> • Bienvenida: ${settings.welcome}\n` +
        `> • Economía RPG: ${settings.economy}\n` +
        `> • Modo Solo Admins: ${settings.adminonly}\n` +
        `> • Alertas: ${settings.alerts}`;

      const mentions = groupMetadata.owner ? [client.decodeJid(groupMetadata.owner)] : [];
      await client.sendMessage(m.chat, { text: message.trim(), mentions }, { quoted: m });
    } catch (e) {
      return m.reply(`> ❌ *Error al obtener información del grupo:*\n[${e.message}]`);
    }
  }
};

const cmdLink = {
  command: ['link', 'enlace'],
  category: 'grupo',
  desc: 'Obtiene el enlace de invitación del grupo.',
  botAdmin: true,
  run: async (client, m) => {
    try {
      const code = await client.groupInviteCode(m.chat);
      const link = `https://chat.whatsapp.com/${code}`;
      const teks =
        `🔗 *ENLACE DEL GRUPO*\n\n` +
        `> 🌐 *Link:* ${link}\n` +
        `> 👤 *Solicitado por:* @${m.sender.split('@')[0]}`;
      await client.sendMessage(m.chat, { text: teks, mentions: [m.sender] }, { quoted: m });
    } catch (e) {
      return m.reply(`> ❌ *Error al obtener enlace del grupo:*\n[${e.message}]`);
    }
  }
};

const cmdRevoke = {
  command: ['revoke', 'restablecer', 'resetlink'],
  category: 'grupo',
  desc: 'Restablece y revoca el enlace de invitación actual del grupo.',
  botAdmin: true,
  isAdmin: true,
  run: async (client, m) => {
    try {
      await m.react('🕒');
      await client.groupRevokeInvite(m.chat);
      const code = await client.groupInviteCode(m.chat);
      const link = `https://chat.whatsapp.com/${code}`;
      const teks =
        `🔄 *ENLACE DE GRUPO RESTABLECIDO*\n\n` +
        `> 🔗 *Nuevo Link:* ${link}\n` +
        `> 👤 *Restablecido por:* @${m.sender.split('@')[0]}`;
      await client.sendMessage(m.chat, { text: teks, mentions: [m.sender] }, { quoted: m });
      await m.react('✔️');
    } catch (e) {
      await m.react('❌');
      return m.reply(`> ❌ *Error al restablecer enlace:*\n[${e.message}]`);
    }
  }
};

export default [cmdSetGpName, cmdSetGpDesc, cmdSetGpBanner, cmdOpen, cmdCloset, cmdGp, cmdLink, cmdRevoke];
