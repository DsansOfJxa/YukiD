/**
 * 🏁 juegos_tablero.js — Juegos clásicos de tablero por turnos para dos jugadores.
 * Reúne: tictactoe, connect4
 */
import { gameEngine } from "../../utils/gameEngine.js";
import { resolveLidToRealJid } from "../../core/utils.js";

// ── TICTACTOE HELPERS ──
const renderTttBoard = (board) => {
  const numEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
  const symbols = board.map((cell, idx) =>
    cell === "X" ? "❎" : cell === "O" ? "⭕" : numEmojis[idx]
  );
  return `${symbols.slice(0, 3).join("")}\n${symbols.slice(3, 6).join("")}\n${symbols.slice(6, 9).join("")}`;
};

const checkTttWinner = (board) => {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c])
      return board[a];
  }
  return null;
};

// ── CONNECT4 HELPERS ──
const ROWS = 6,
  COLS = 7;
const createC4Board = () =>
  Array.from({ length: ROWS }, () => Array(COLS).fill(null));
const renderC4Board = (board) => {
  let d = "1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣\n";
  for (const row of board)
    d +=
      row.map((c) => (c === "R" ? "🔴" : c === "Y" ? "🟡" : "⚪")).join("") +
      "\n";
  return d;
};
const dropPiece = (board, col, piece) => {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (!board[r][col]) {
      board[r][col] = piece;
      return r;
    }
  }
  return -1;
};
const checkC4Winner = (board, p) => {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c <= COLS - 4; c++)
      if (
        board[r][c] === p &&
        board[r][c + 1] === p &&
        board[r][c + 2] === p &&
        board[r][c + 3] === p
      )
        return true;
  for (let r = 0; r <= ROWS - 4; r++)
    for (let c = 0; c < COLS; c++)
      if (
        board[r][c] === p &&
        board[r + 1][c] === p &&
        board[r + 2][c] === p &&
        board[r + 3][c] === p
      )
        return true;
  for (let r = 0; r <= ROWS - 4; r++)
    for (let c = 0; c <= COLS - 4; c++)
      if (
        board[r][c] === p &&
        board[r + 1][c + 1] === p &&
        board[r + 2][c + 2] === p &&
        board[r + 3][c + 3] === p
      )
        return true;
  for (let r = 3; r < ROWS; r++)
    for (let c = 0; c <= COLS - 4; c++)
      if (
        board[r][c] === p &&
        board[r - 1][c + 1] === p &&
        board[r - 2][c + 2] === p &&
        board[r - 3][c + 3] === p
      )
        return true;
  return false;
};
const isBoardFull = (board) => board[0].every((c) => c !== null);

// ── COMANDOS ──

const cmdTicTacToe = {
  command: ["tictactoe", "ttt", "xo"],
  category: "juegos",
  desc: "Juega TicTacToe contra otro usuario o crea una sala pública.",
  usage: "[@usuario] [apuesta]",
  cooldown: 3,
  run: async (client, m, args, usedPrefix, command) => {
    const activeGame = gameEngine.get(m.chat, "tictactoe");

    if (activeGame) {
      if (activeGame.state === "WAITING") {
        if (activeGame.players.X === m.sender) {
          return m.reply("⚠️ Ya creaste una sala. Esperando a que otro jugador se una escribiendo `.ttt`.");
        }
        let apuesta = activeGame.apuesta;
        const bet2 = gameEngine.validateBet(m.sender, apuesta);
        if (bet2 === false) {
          return m.reply(`❌ No tienes suficiente XP (${apuesta} XP) para unirte a esta partida.`);
        }
        activeGame.players.O = m.sender;
        activeGame.state = "PLAYING";

        const text = `🎮 *¡TicTacToe Iniciado!*\n\n` +
          `Turno de @${activeGame.players.X.split("@")[0]} (❎)\n\n` +
          `${renderTttBoard(activeGame.board)}\n\n` +
          `❎ *Jugador 1:* @${activeGame.players.X.split("@")[0]}\n` +
          `⭕ *Jugador 2:* @${activeGame.players.O.split("@")[0]}\n` +
          `💰 *Apuesta:* ${apuesta} XP cada uno\n\n` +
          `• Escribe un número (1-9) para colocar tu símbolo\n` +
          `• Escribe *rendirme* para retirarte`;

        return client.sendMessage(m.chat, {
          text,
          mentions: [activeGame.players.X, activeGame.players.O],
        });
      } else {
        return m.reply("🎮 Ya hay una partida activa de TicTacToe en este chat. Escribe *rendirme* si deseas abandonar la partida.");
      }
    }

    let opponent = null;
    let apuesta = 200;

    if (m.mentionedJid && m.mentionedJid[0]) {
      opponent = client.decodeJid(
        await resolveLidToRealJid(m.mentionedJid[0], client, m.chat)
      );
      if (args[1] && !isNaN(args[1])) apuesta = Math.max(10, parseInt(args[1]));
    } else if (args[0] && !isNaN(args[0])) {
      apuesta = Math.max(10, parseInt(args[0]));
    }

    if (opponent && opponent === m.sender) {
      return m.reply(" No puedes jugar contra ti mismo.");
    }

    const bet1 = gameEngine.validateBet(m.sender, apuesta);
    if (bet1 === false) {
      return m.reply(`❌ No tienes suficiente XP para esa apuesta.`);
    }

    if (opponent) {
      const bet2 = gameEngine.validateBet(opponent, apuesta);
      if (bet2 === false) {
        gameEngine.refundBet(m.sender, apuesta);
        return m.reply("❌ Tu oponente no tiene suficiente XP para cubrir la apuesta.");
      }
    }

    gameEngine.start(
      m.chat,
      "tictactoe",
      m.sender,
      {
        board: Array(9).fill(null),
        turn: "X",
        players: { X: m.sender, O: opponent },
        apuesta,
        state: opponent ? "PLAYING" : "WAITING",
      },
      {
        timeout: 300000,
        onTimeout: () => {
          const game = gameEngine.get(m.chat, "tictactoe");
          if (game) {
            gameEngine.refundBet(game.players.X, game.apuesta);
            if (game.players.O) gameEngine.refundBet(game.players.O, game.apuesta);
            client.sendMessage(m.chat, {
              text: `⏰ Tiempo agotado. Se devolvieron las apuestas del TicTacToe.`,
            });
          }
        },
      }
    );

    if (opponent) {
      await client.sendMessage(m.chat, {
        text: `🎮 *¡TicTacToe Iniciado!*\n\n` +
          `Turno de @${m.sender.split("@")[0]} (❎)\n\n` +
          `${renderTttBoard(Array(9).fill(null))}\n\n` +
          `❎ *Jugador 1:* @${m.sender.split("@")[0]}\n` +
          `⭕ *Jugador 2:* @${opponent.split("@")[0]}\n` +
          `💰 *Apuesta:* ${apuesta} XP\n\n` +
          `• Escribe un número (1-9) para colocar tu símbolo\n` +
          `• Escribe *rendirme* para rendirte`,
        mentions: [m.sender, opponent],
      });
    } else {
      await client.sendMessage(m.chat, {
        text: `⏳ *Esperando Oponente para TicTacToe*\n\n` +
          `@${m.sender.split("@")[0]} creó una sala (Apuesta: ${apuesta} XP).\n\n` +
          `👉 ¡Cualquier miembro del grupo puede escribir *${usedPrefix + command}* para unirse!`,
        mentions: [m.sender],
      });
    }
  },
};

const cmdConnect4 = {
  command: ["connect4", "c4", "conecta4"],
  category: "juegos",
  desc: "Juega Conecta 4 contra otro usuario.",
  usage: ".connect4 @usuario [apuesta]",
  cooldown: 5,
  run: async (client, m, args, usedPrefix, command) => {
    if (gameEngine.has(m.chat, "connect4"))
      return m.reply(" Ya hay una partida de Conecta 4 activa.");
    if (!args[0])
      return m.reply(`Uso: ${usedPrefix + command} @usuario [apuesta]`);

    let opponent =
      (m.mentionedJid && m.mentionedJid[0]) ||
      args[0].replace(/[^0-9]/g, "") + "@s.whatsapp.net";
    opponent = client.decodeJid(
      await resolveLidToRealJid(opponent, client, m.chat),
    );
    if (opponent === m.sender)
      return m.reply(" No puedes jugar contra ti mismo.");

    let apuesta = 250;
    if (args[1] && !isNaN(args[1])) {
      apuesta = parseInt(args[1]);
      if (apuesta < 10) return m.reply("❌ La apuesta mínima es de 10 XP.");
    }
    const bet1 = gameEngine.validateBet(m.sender, apuesta);
    if (bet1 === false)
      return m.reply(`❌ No tienes suficiente XP para esa apuesta.`);
    const bet2 = gameEngine.validateBet(opponent, apuesta);
    if (bet2 === false) {
      gameEngine.refundBet(m.sender, apuesta);
      return m.reply("❌ Tu oponente no tiene suficiente XP.");
    }

    const board = createC4Board();
    gameEngine.start(
      m.chat,
      "connect4",
      m.sender,
      {
        board,
        turn: "R",
        players: { R: m.sender, Y: opponent },
        apuesta,
      },
      {
        timeout: 600000,
        onTimeout: () => {
          gameEngine.refundBet(m.sender, apuesta);
          gameEngine.refundBet(opponent, apuesta);
          client.sendMessage(m.chat, {
            text: `⏰ Tiempo agotado. Se devolvieron las apuestas.`,
          });
        },
      },
    );

    await client.sendMessage(m.chat, {
      text: `🔴🟡 *C O N E C T A  4* 🟡🔴\n\n@${m.sender.split("@")[0]} 🔴 vs @${opponent.split("@")[0]} 🟡\n💰 *Apuesta:* ${apuesta} XP por jugador\n\n${renderC4Board(board)}\nTurno de @${m.sender.split("@")[0]} 🔴\n• *Escribe un número del 1 al 7* para soltar tu ficha.\n• Escribe *rendirme* para abandonar.`,
      mentions: [m.sender, opponent],
    });
  },
};

// ── HANDLERS INTERCEPTORES ──

async function handleTtt(client, m) {
  const game = gameEngine.get(m.chat, "tictactoe");
  if (!game) return false;

  const text = m.text.trim().toLowerCase();
  const senderJid = client.decodeJid(m.sender);

  // Rendirse
  const isSurrender = /^(surrender|rendirme|rendirse|me rindo|salir|abandonar)$/i.test(text);
  if (isSurrender) {
    if (senderJid !== game.players.X && senderJid !== game.players.O) return false;

    const winnerId = senderJid === game.players.X ? game.players.O : game.players.X;
    gameEngine.end(m.chat, "tictactoe");

    if (winnerId) {
      const ganancia = game.apuesta * 2;
      gameEngine.reward(winnerId, { xp: ganancia, win: true });
      gameEngine.loss(senderJid);
      await client.sendMessage(m.chat, {
        text: `🏳️ *@${senderJid.split("@")[0]}* se ha rendido.\n🏆 ¡@${winnerId.split("@")[0]} gana la partida y se lleva *${ganancia} XP*!`,
        mentions: [senderJid, winnerId],
      });
    } else {
      gameEngine.refundBet(senderJid, game.apuesta);
      await client.sendMessage(m.chat, {
        text: `🏳️ *@${senderJid.split("@")[0]}* canceló la sala de juego.`,
        mentions: [senderJid],
      });
    }
    return true;
  }

  if (game.state === "WAITING") return false;
  if (!/^[1-9]$/.test(text)) return false;

  const currentPlayer = client.decodeJid(game.players[game.turn]);
  if (senderJid !== currentPlayer) {
    if (senderJid === game.players.X || senderJid === game.players.O) {
      await client.sendMessage(
        m.chat,
        { text: `❌ ¡No es tu turno! Turno de @${currentPlayer.split("@")[0]} (${game.turn === 'X' ? '❎' : '⭕'}).`, mentions: [currentPlayer] },
        { quoted: m }
      );
      return true;
    }
    return false;
  }

  const pos = parseInt(text) - 1;
  if (game.board[pos]) {
    await client.sendMessage(
      m.chat,
      { text: `⚠️ Esa casilla ya está ocupada. Elige otro número del 1 al 9.` },
      { quoted: m }
    );
    return true;
  }

  game.board[pos] = game.turn;
  const winner = checkTttWinner(game.board);

  if (winner) {
    gameEngine.end(m.chat, "tictactoe");
    const winnerId = game.players[winner];
    const loserId = game.players[winner === "X" ? "O" : "X"];
    const ganancia = game.apuesta * 2;
    gameEngine.reward(winnerId, { xp: ganancia, win: true });
    gameEngine.loss(loserId);
    await client.sendMessage(m.chat, {
      text: `🏆 *¡@${winnerId.split("@")[0]} gana el TicTacToe!* 🎉\n💰 Ganaste *${ganancia} XP*\n\n${renderTttBoard(game.board)}`,
      mentions: [game.players.X, game.players.O],
    });
    return true;
  }

  if (!game.board.includes(null)) {
    gameEngine.end(m.chat, "tictactoe");
    gameEngine.refundBet(game.players.X, game.apuesta);
    gameEngine.refundBet(game.players.O, game.apuesta);
    await client.sendMessage(m.chat, {
      text: `🤝 *¡Empate!*\nAmbos recuperan sus apuestas.\n\n${renderTttBoard(game.board)}`,
      mentions: [game.players.X, game.players.O],
    });
    return true;
  }

  game.turn = game.turn === "X" ? "O" : "X";
  const nextPlayer = game.players[game.turn];
  await client.sendMessage(m.chat, {
    text: `🎮 Turno de @${nextPlayer.split("@")[0]} (${game.turn === 'X' ? '❎' : '⭕'})\n\n${renderTttBoard(game.board)}`,
    mentions: [nextPlayer],
  });
  return true;
}

async function handleC4(client, m) {
  const game = gameEngine.get(m.chat, "connect4");
  if (!game) return false;

  const text = m.text.trim().toLowerCase();
  const senderJid = client.decodeJid(m.sender);

  // Rendirse en Conecta 4
  const isSurrender = /^(surrender|rendirme|rendirse|me rindo|salir|abandonar)$/i.test(text);
  if (isSurrender) {
    if (senderJid !== game.players.R && senderJid !== game.players.Y) return false;

    const winnerId = senderJid === game.players.R ? game.players.Y : game.players.R;
    gameEngine.end(m.chat, "connect4");

    const ganancia = game.apuesta * 2;
    gameEngine.reward(winnerId, { xp: ganancia, win: true });
    gameEngine.loss(senderJid);
    await client.sendMessage(m.chat, {
      text: `🏳️ *@${senderJid.split("@")[0]}* se ha rendido en Conecta 4.\n🏆 ¡@${winnerId.split("@")[0]} gana la partida y se lleva *${ganancia} XP*!`,
      mentions: [senderJid, winnerId],
    });
    return true;
  }

  if (!/^[1-7]$/.test(text)) return false;

  const currentPlayer = client.decodeJid(game.players[game.turn]);
  if (senderJid !== currentPlayer) {
    if (senderJid === game.players.R || senderJid === game.players.Y) {
      const turnEmoji = game.turn === "R" ? "🔴" : "🟡";
      await client.sendMessage(
        m.chat,
        { text: `❌ ¡No es tu turno! Turno de @${currentPlayer.split("@")[0]} ${turnEmoji}.`, mentions: [currentPlayer] },
        { quoted: m }
      );
      return true;
    }
    return false;
  }

  const col = parseInt(text) - 1;
  const row = dropPiece(game.board, col, game.turn);
  if (row === -1) {
    await client.sendMessage(
      m.chat,
      { text: `⚠️ La columna ${col + 1} está llena. Elige otra columna (1-7).` },
      { quoted: m },
    );
    return true;
  }

  if (checkC4Winner(game.board, game.turn)) {
    gameEngine.end(m.chat, "connect4");
    const winnerId = currentPlayer,
      loserId = game.players[game.turn === "R" ? "Y" : "R"];
    const ganancia = game.apuesta * 2;
    gameEngine.reward(winnerId, { xp: ganancia, win: true });
    gameEngine.loss(loserId);
    const emoji = game.turn === "R" ? "🔴" : "🟡";
    await client.sendMessage(
      m.chat,
      {
        text: `🔴🟡 *C O N E C T A  4* 🟡🔴\n\n${renderC4Board(game.board)}\n🏆 *¡@${winnerId.split("@")[0]} ${emoji} gana!* 🎉\n💰 Ganaste *${ganancia} XP*`,
        mentions: [winnerId, loserId],
      },
      { quoted: m },
    );
    return true;
  }

  if (isBoardFull(game.board)) {
    gameEngine.end(m.chat, "connect4");
    gameEngine.refundBet(game.players.R, game.apuesta);
    gameEngine.refundBet(game.players.Y, game.apuesta);
    await client.sendMessage(m.chat, {
      text: `🔴🟡 *C O N E C T A  4* 🟡🔴\n\n${renderC4Board(game.board)}\n🤝 *¡Empate!* Se devolvieron las apuestas.`,
    });
    return true;
  }

  game.turn = game.turn === "R" ? "Y" : "R";
  const nextPlayer = game.players[game.turn],
    nextEmoji = game.turn === "R" ? "🔴" : "🟡";
  await client.sendMessage(m.chat, {
    text: `🔴🟡 *C O N E C T A  4* 🟡🔴\n\n${renderC4Board(game.board)}\nTurno de @${nextPlayer.split("@")[0]} ${nextEmoji}\n• Escribe (1-7) o *rendirme*`,
    mentions: [nextPlayer],
  });
  return true;
}

export const before = async (client, m) => {
  if (!m.text) return false;

  if (gameEngine.has(m.chat, "tictactoe")) {
    return await handleTtt(client, m);
  }
  if (gameEngine.has(m.chat, "connect4")) {
    return await handleC4(client, m);
  }

  return false;
};

export default [cmdTicTacToe, cmdConnect4];
