import { gameEngine } from '../../utils/gameEngine.js';
import { getBotCurrency } from '../../utils/tools.js';

export default [
  {
    command: ['gameboard', 'glb', 'topjuegos'],
    category: 'juegos',
    desc: 'Muestra el ranking de los mejores jugadores.',
    cooldown: 10,
    run: async (client, m, args, usedPrefix) => {
      const currency = getBotCurrency(client);
      const users = global.db.data.users || {};
      const mode = (args[0] || 'wins').toLowerCase();

      // Filtrar usuarios que han jugado al menos 1 partida
      const players = Object.entries(users)
        .filter(([, u]) => (u.gameWins || 0) + (u.gameLosses || 0) > 0)
        .map(([jid, u]) => {
          const wins = u.gameWins || 0;
          const losses = u.gameLosses || 0;
          const total = wins + losses;
          return {
            jid,
            name: u.name || jid.split('@')[0],
            wins,
            losses,
            total,
            winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
            achievements: (u.achievements || []).length,
            coins: (u.coins || 0) + (u.bank || 0),
          };
        });

      if (players.length === 0) {
        return m.reply('Todavía no hay jugadores con partidas registradas.');
      }

      // Ordenar según el modo
      const sortModes = {
        wins: (a, b) => b.wins - a.wins,
        rate: (a, b) => b.winRate - a.winRate || b.total - a.total,
        logros: (a, b) => b.achievements - a.achievements,
      };

      const sortFn = sortModes[mode] || sortModes.wins;
      const sorted = players.sort(sortFn).slice(0, 15);

      const modeLabels = { wins: 'Victorias', rate: 'Win Rate', logros: 'Logros' };
      const modeLabel = modeLabels[mode] || 'Victorias';
      const medals = ['🥇', '🥈', '🥉'];

      let txt = `╭┈──̇─̇─̇────̇─̇─̇──◯◝\n`;
      txt += `┊ 🏆 *GAME LEADERBOARD*\n`;
      txt += `┊ _Ordenado por: ${modeLabel}_\n`;
      txt += `┊︶︶︶︶︶︶︶︶︶︶︶\n`;

      sorted.forEach((p, i) => {
        const medal = medals[i] || `*${i + 1}.*`;
        const statsLine = mode === 'rate'
          ? `${p.winRate}% (${p.wins}W/${p.losses}L)`
          : mode === 'logros'
          ? `${p.achievements} 🏅 | ${p.wins}W`
          : `${p.wins}W / ${p.losses}L (${p.winRate}%)`;
        txt += `┊ ${medal} @${p.jid.split('@')[0]}\n`;
        txt += `┊    ➤ ${statsLine}\n`;
      });

      txt += `┊ ︿︿︿︿︿︿︿︿︿︿︿\n`;
      txt += `╰─────────────────╯\n\n`;
      txt += `> _Modos: ${usedPrefix}gameboard [wins|rate|logros]_`;

      const mentions = sorted.map(p => p.jid);
      await client.sendMessage(m.chat, { text: txt, mentions }, { quoted: m });
    }
  },
  {
    command: ['gamestats', 'gs', 'estadisticas'],
    category: 'juegos',
    desc: 'Muestra tus estadísticas de juegos.',
    cooldown: 5,
    run: async (client, m, args, usedPrefix, command) => {
      const stats = gameEngine.getStats(m.sender);
      const user = global.db.data.users[m.sender];
      const name = user?.name || m.sender.split('@')[0];

      let msg = `🎮 *Estadísticas de ${name}* 🎮\n\n`;
      msg += `✅ Victorias › *${stats.wins}*\n`;
      msg += `❌ Derrotas › *${stats.losses}*\n`;
      msg += `🎯 Total partidas › *${stats.total}*\n`;
      msg += `📊 Win Rate › *${stats.winRate}%*\n\n`;

      // Logros
      const achievements = stats.achievements;
      if (achievements.length > 0) {
        msg += `🏅 Logros desbloqueados › *${achievements.length}*\n`;
        msg += `_Usa \`${usedPrefix}logros\` para ver el detalle._\n\n`;
      }

      // Sesiones activas (debug info)
      msg += `⚡ Sesiones activas globales › *${gameEngine.activeSessions}*`;

      await client.sendMessage(m.chat, { text: msg }, { quoted: m });
    }
  },
  {
    command: ['delgame', 'endgame', 'cancelar', 'rendirse'],
    category: 'juegos',
    desc: 'Cancela un juego activo en el chat (Si eres el creador, jugador o Administrador)',
    run: async (client, m, args, usedPrefix, command) => {
      // Variable para verificar si se canceló algo
      let canceledCount = 0;
      
      let isAdmins = false;
      if (m.isGroup) {
        const groupMetadata = await client.groupMetadata(m.chat).catch(() => null);
        if (groupMetadata) {
          const groupAdmins = groupMetadata.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');
          isAdmins = groupAdmins.some(p => p.id === m.sender || p.jid === m.sender);
        }
      }
      const isOwners = global.config?.owner?.includes(m.sender.split('@')[0]) || false;

      // Buscar sesiones activas en este chat
      for (const [key, session] of gameEngine.sessions.entries()) {
        if (key.startsWith(m.chat)) {
          // Verificar si el usuario tiene permisos para cancelar este juego
          let canCancel = false;
          
          // 1. Es Admin o Owner
          if (isAdmins || isOwners) canCancel = true;
          
          // 2. Es el creador/iniciador del juego
          if (session.sender === m.sender || session.iniciadoPor === m.sender) canCancel = true;
          
          // 3. Es un jugador activo (Ej. TicTacToe players, Connect4 players, Blackjack jugador)
          if (session.players) {
            if (session.players.X === m.sender || session.players.O === m.sender) canCancel = true;
            if (session.players.R === m.sender || session.players.Y === m.sender) canCancel = true;
          }
          if (session.jugador === m.sender) canCancel = true;

          if (canCancel) {
            // Reembolsar apuestas según el tipo de juego
            if (session.apuesta > 0) {
              if (session.players) {
                if (session.players.X) gameEngine.refundBet(session.players.X, session.apuesta);
                if (session.players.O) gameEngine.refundBet(session.players.O, session.apuesta);
                if (session.players.R) gameEngine.refundBet(session.players.R, session.apuesta);
                if (session.players.Y) gameEngine.refundBet(session.players.Y, session.apuesta);
              } else {
                const target = session.jugador || session.sender || session.iniciadoPor;
                if (target) gameEngine.refundBet(target, session.apuesta);
              }
            }

            // Limpiar timeout y borrar
            if (session.timeoutId) clearTimeout(session.timeoutId);
            gameEngine.sessions.delete(key);
            canceledCount++;
          }
        }
      }

      if (canceledCount > 0) {
        await m.reply(`✅ Se han cancelado **${canceledCount}** juego(s) activo(s) en este chat. Las apuestas (si había) han sido reembolsadas.`);
      } else {
        await m.reply(`❌ No tienes ningún juego activo que puedas cancelar en este momento.\n\n_(Solo los Administradores o los creadores del juego pueden cancelarlo)_`);
      }
    }
  }
];
