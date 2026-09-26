/**
 * 📊 group_analytics.js — Comandos de estadísticas, conteo de mensajes e inactividad en grupos.
 * Reúne: count, topcount, topinactive
 */
import { resolveLidToRealJid } from "../../core/utils.js";

const cmdCount = {
  command: ['count', 'mensajes', 'messages', 'msgcount'],
  category: 'grupo', desc: 'Ver conteo de mensajes de un usuario.',
  run: async (client, m, args, usedPrefix, command) => {
    if (!m.isGroup) return m.reply("Este comando solo funciona en grupos.");
    const db = global.db.data;
    const chatId = m.chat;
    const chatData = db.chats[chatId];
    const mentioned = m.mentionedJid;
    const who2 = mentioned.length > 0 ? mentioned[0] : (m.quoted ? m.quoted.sender : m.sender);
    const who = await resolveLidToRealJid(who2, client, m.chat);
    if (!chatData.users?.[who])
      return m.reply(`「」 El usuario mencionado no está registrado en el bot.`);
    const userStats = chatData.users[who].stats || {};
    const now = new Date();
    const daysArg = parseInt(args[0]) || 30;
    const cutoff = new Date(now.getTime() - daysArg * 24 * 60 * 60 * 1000);
    const days = Object.entries(userStats).filter(([date]) => new Date(date) >= cutoff).sort((a, b) => new Date(b[0]) - new Date(a[0]));
    const totalMsgs = days.reduce((acc, [, d]) => acc + (d.msgs || 0), 0);
    const totalCmds = days.reduce((acc, [, d]) => acc + (d.cmds || 0), 0);
    let report = `Contador de mensajes de @${who.split('@')[0]}\n`;
    report += `> Total en los últimos *${daysArg}* días: \`${totalMsgs}\` mensajes\n\n`;
    for (const [date, d] of days) {
      const fecha = new Date(date).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' });
      report += `*❏ ${fecha}*\n`;
      report += `\tMensajes: \`${d.msgs || 0}\`, Comandos: \`${d.cmds || 0}\`\n`;
    }
    await client.reply(chatId, report, m, { mentions: [who] });
  }
};

const cmdTopCount = {
  command: ['topcount', 'topmensajes', 'topmsgcount', 'topmessages'],
  category: 'grupo', desc: 'Ranking de mensajes del grupo.',
  run: async (client, m, args, usedPrefix, command) => {
    if (!m.isGroup) return m.reply("Este comando solo funciona en grupos.");
    const db = global.db.data;
    const chatId = m.chat;
    const chatData = db.chats[chatId];
    const now = new Date();
    const daysArg = args[0] ? parseInt(args[0]) : 1;
    if (daysArg < 1) return m.reply(`「」 El número de días debe ser mayor a 0.`);
    const cutoff = new Date(now.getTime() - daysArg * 24 * 60 * 60 * 1000);
    const ranking = Object.entries(chatData.users || {})
      .map(([jid, user]) => {
        const stats = user.stats || {};
        const days = Object.entries(stats).filter(([date]) => new Date(date) >= cutoff);
        const totalMsgs = days.reduce((acc, [, d]) => acc + (d.msgs || 0), 0);
        const totalCmds = days.reduce((acc, [, d]) => acc + (d.cmds || 0), 0);
        return { jid, totalMsgs, totalCmds };
      })
      .filter(u => u.totalMsgs > 0)
      .sort((a, b) => b.totalMsgs - a.totalMsgs);
    if (ranking.length === 0) return m.reply(`「」 No hay actividad registrada en los últimos ${daysArg} días.`);
    const page = parseInt(args[1]) || 1;
    const perPage = 10;
    const totalPages = Math.ceil(ranking.length / perPage);
    if (page < 1 || page > totalPages) return m.reply(`「」 Página inválida. Solo hay ${totalPages} páginas disponibles.`);
    const start = (page - 1) * perPage;
    const end = start + perPage;
    const pageRanking = ranking.slice(start, end);
    let report = `Top de mensajes en los últimos *${daysArg}* día${daysArg > 1 ? 's' : ''}\n\n`;
    pageRanking.forEach((u, i) => {
      const name = db.users[u.jid]?.name || u.jid.split('@')[0];
      report += `*${start + i + 1}.* ${name}\n`;
      report += `   Mensajes: \`${u.totalMsgs}\`, Comandos: \`${u.totalCmds}\`\n`;
    });
    if (page < totalPages) {
      report += `\nPara ver la siguiente página › *${usedPrefix + command} ${daysArg} ${page + 1}*`;
    }
    await client.reply(chatId, report, m);
  }
};

const cmdTopInactive = {
  command: ['topinactive', 'topinactivos', 'topinactiveusers'],
  category: 'grupo', desc: 'Ranking de inactividad del grupo.',
  run: async (client, m, args, usedPrefix, command) => {
    if (!m.isGroup) return m.reply("Este comando solo funciona en grupos.");
    const db = global.db.data;
    const chatId = m.chat;
    const chatData = db.chats[chatId];
    const now = new Date();

    let daysArg = args[0] ? parseInt(args[0]) : 30;
    if (daysArg < 1) daysArg = 30;
    const cutoff = new Date(now.getTime() - daysArg * 24 * 60 * 60 * 1000);

    const ranking = Object.entries(chatData.users || {})
      .map(([jid, user]) => {
        const stats = user.stats || {};
        const days = Object.entries(stats).filter(([date]) => new Date(date) >= cutoff);
        const totalMsgs = days.reduce((acc, [, d]) => acc + (d.msgs || 0), 0);
        return { jid, totalMsgs };
      })
      .sort((a, b) => a.totalMsgs - b.totalMsgs);

    if (ranking.length === 0) return m.reply(`「」 No hay actividad registrada en los últimos ${daysArg} días.`);

    const page = parseInt(args[1]) || 1;
    const perPage = 10;
    const totalPages = Math.ceil(ranking.length / perPage);
    if (page < 1 || page > totalPages) return m.reply(`「」 Página inválida. Solo hay ${totalPages} páginas disponibles.`);

    const start = (page - 1) * perPage;
    const end = start + perPage;
    const pageRanking = ranking.slice(start, end);

    let report = `Top de usuarios inactivos \n`;
    report += `> Días: \`${daysArg}\`\n`;
    report += `> Página: \`${page}\` de \`${totalPages}\`\n\n`;

    const mentions = [];
    pageRanking.forEach((u, i) => {
      const name = db.users[u.jid]?.name || '@' + u.jid.split('@')[0];
      report += `*${start + i + 1}.* ${name}\n`;
      report += `   Mensajes: \`${u.totalMsgs}\`\n`;
      mentions.push(u.jid);
    });

    if (page < totalPages) {
      report += `\nPara ver la siguiente página › *${usedPrefix + command} ${daysArg} ${page + 1}*`;
    }

    await client.reply(chatId, report, m, { mentions });
  }
};

export default [cmdCount, cmdTopCount, cmdTopInactive];
