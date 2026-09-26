export default {
  command: ['clear', 'purgar'],
  category: 'owner',
  desc: 'Elimina registros de usuarios inactivos en el grupo para liberar memoria y espacio.',
  usage: '[días (default: 30)]',
  isOwner: true,
  run: async (client, m, args) => {
    const start = Date.now();
    const chat = global.db?.data?.chats?.[m.chat];
    if (!chat?.users || typeof chat.users !== 'object') {
      return m.reply('❌ No se encontraron registros de usuarios en este grupo.');
    }

    const inputDays = args[0] && !isNaN(args[0]) ? parseInt(args[0]) : 30;
    const LIMITE = Math.max(7, inputDays) * 24 * 60 * 60 * 1000;
    const now = Date.now();

    let userList = [];
    let mentions = [];
    let eliminados = 0;

    for (const jid of Object.keys(chat.users)) {
      if (isPrivileged(jid, m.sender)) continue;
      const u = chat.users[jid];
      if (!u || typeof u !== 'object') continue;

      const lastActivity = u.lastCmd || u.lastMsg || 0;
      const delta = now - lastActivity;

      // Si no tiene actividad registrada o supera el límite de días
      if (lastActivity <= 0 || delta > LIMITE) {
        delete chat.users[jid];
        eliminados++;
        const tiempo = lastActivity > 0 ? formatTime(delta) : 'Sin actividad';
        userList.push(`• @${jid.split('@')[0]} — _inactivo por ${tiempo}_`);
        mentions.push(jid);
      }
    }

    if (!eliminados) {
      return m.reply(`✅ No se encontraron usuarios inactivos en este chat.\n(Filtro de inactividad: >${Math.max(7, inputDays)} días)`);
    }

    // Persistir cambios atómicamente en SQLite
    global.saveDatabaseAsync?.();

    const report = [
      `🧹 *LIMPIEZA DE USUARIOS INACTIVOS* 🧹\n`,
      `> 👥 *Registros depurados:* ${eliminados}`,
      `> ⏳ *Filtro:* Inactividad >${Math.max(7, inputDays)} días`,
      `> ⏱️ *Tiempo de ejecución:* ${Date.now() - start}ms\n`,
      ...userList.slice(0, 30),
      userList.length > 30 ? `\n_...y ${userList.length - 30} usuarios más_` : '',
    ].join('\n');

    await client.sendMessage(m.chat, { text: report, mentions: mentions.slice(0, 30) }, { quoted: m });
  },
};

const formatTime = (ms) => {
  const sec = Math.floor(ms / 1000);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`].filter(Boolean).join(' ') || 'pocos segundos';
};

const normalizeNumber = (jid) => String(jid).replace(/\D/g, '');

const isPrivileged = (jid, sender) => {
  const n = normalizeNumber(jid);
  if (n === normalizeNumber(sender)) return true;
  for (const list of [global.owner, global.mods]) {
    if (!list) continue;
    for (const o of list) {
      const id = typeof o === 'string' ? o : Array.isArray(o) ? o[0] : o?.jid;
      if (normalizeNumber(id) === n) return true;
    }
  }
  return false;
};