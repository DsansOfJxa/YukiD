/**
 * 🎰 juegos_azar.js — Juegos rápidos de mesa y azar (Blackjack, dados).
 * Reúne: blackjack, dado
 */
import { gameEngine } from '../../utils/gameEngine.js';

// ── BLACKJACK HELPERS ──
const SUITS = ['♠️', '♥️', '♦️', '♣️'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const createDeck = () => {
  const deck = [];
  for (const suit of SUITS) for (const value of VALUES) deck.push({ suit, value });
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  return deck;
};
const cardValue = (card) => ['J', 'Q', 'K'].includes(card.value) ? 10 : card.value === 'A' ? 11 : parseInt(card.value);
const handTotal = (hand) => { let t = hand.reduce((s, c) => s + cardValue(c), 0), a = hand.filter(c => c.value === 'A').length; while (t > 21 && a > 0) { t -= 10; a--; } return t; };
const renderHand = (hand, label, hide = false) => {
  if (hide && hand.length >= 2) return `${label}: ${hand[0].value}${hand[0].suit} 🂠  (${cardValue(hand[0])} + ?)`;
  return `${label}: ${hand.map(c => `${c.value}${c.suit}`).join(' ')}  (*${handTotal(hand)}*)`;
};
const resolveDealer = (game) => { while (handTotal(game.dealerHand) < 17) game.dealerHand.push(game.deck.pop()); };

// ── COMANDOS ──

const cmdBlackjack = {
  command: ['blackjack', 'bj', '21'],
  category: 'juegos', desc: 'Juega al Blackjack (21) contra el bot.', usage: '.blackjack [apuesta]', cooldown: 5,
  run: async (client, m, args) => {
    if (gameEngine.has(m.chat, 'blackjack', m.sender)) {
      return m.reply(' Ya tienes una partida de Blackjack activa. Escribe *hit* o *stand*.');
    }

    let apuesta = 300;
    if (args[0] && !isNaN(args[0])) {
      apuesta = parseInt(args[0]);
      if (apuesta < 10) return m.reply('❌ La apuesta mínima es de 10 XP.');
    }
    const bet = gameEngine.validateBet(m.sender, apuesta);
    if (bet === false) return m.reply(`❌ No tienes suficiente XP para esa apuesta. Tienes *${global.db.data.users[m.sender]?.exp || 0} XP*.`);

    const deck = createDeck();
    const playerHand = [deck.pop(), deck.pop()];
    const dealerHand = [deck.pop(), deck.pop()];

    if (handTotal(playerHand) === 21) {
      const ganancia = Math.floor(bet * 2.5);
      gameEngine.reward(m.sender, { xp: ganancia, win: true });
      return client.sendMessage(m.chat, { text: `🃏 *B L A C K J A C K* 🃏\n\n${renderHand(playerHand, '🧑 Tú')}\n${renderHand(dealerHand, '🤖 Dealer')}\n\n🎰 *¡BLACKJACK NATURAL!* 🎉\n💰 Ganaste *${ganancia} XP* (x2.5)` }, { quoted: m });
    }

    gameEngine.start(m.chat, 'blackjack', m.sender, {
      deck, playerHand, dealerHand, apuesta: bet, jugador: m.sender,
    }, {
      timeout: 120000,
      perPlayer: true,
      onTimeout: () => client.sendMessage(m.chat, { text: `⏰ Tiempo agotado. Perdiste tu apuesta de ${bet} XP.` }),
    });

    await client.sendMessage(m.chat, { text: `🃏 *B L A C K J A C K* 🃏\n\n${renderHand(playerHand, '🧑 Tú')}\n${renderHand(dealerHand, '🤖 Dealer', true)}\n\n💰 *Apuesta:* ${bet} XP\n\nEscribe *pedir* (o *hit*) para otra carta, o *plantar* (o *stand*) para quedarte.` });
  }
};

const cmdDado = {
  command: ['dado', 'dados', 'roll', 'dice'],
  category: 'juegos', desc: 'Tira un dado del 1 al 6.', cooldown: 2,
  run: async (client, m) => {
    const DICE_EMOJIS = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    const diceLinks = [
      'https://tinyurl.com/gdd01',
      'https://tinyurl.com/gdd02',
      'https://tinyurl.com/gdd003',
      'https://tinyurl.com/gdd004',
      'https://tinyurl.com/gdd05',
      'https://tinyurl.com/gdd006'
    ];

    const idx = Math.floor(Math.random() * 6);
    const roll = idx + 1;
    const stickerUrl = diceLinks[idx];
    const diceEmoji = DICE_EMOJIS[idx];

    try {
      await client.sendMessage(m.chat, {
        sticker: { url: stickerUrl }
      }, { quoted: m });
    } catch (e) {
      await client.sendMessage(m.chat, {
        text: `🎲 *¡DADO LANZADO!* 🎲\n\nResultado: *[ ${diceEmoji} ] — ¡Número ${roll}!*`
      }, { quoted: m });
    }
  }
};

// ── HANDLERS INTERCEPTORES ──

export const before = async (client, m) => {
  if (!m.text) return false;
  const game = gameEngine.get(m.chat, 'blackjack', m.sender);
  if (!game || game.jugador !== m.sender) return false;

  const action = m.text.trim().toLowerCase();
  const validActions = ['hit', 'stand', 'h', 's', 'pedir', 'plantar', 'plantarse', 'carta', 'pasar'];
  if (!validActions.includes(action)) return false;
  const isHit = ['hit', 'h', 'pedir', 'carta'].includes(action);

  if (isHit) {
    game.playerHand.push(game.deck.pop());
    const pt = handTotal(game.playerHand);

    if (pt > 21) {
      gameEngine.end(m.chat, 'blackjack', m.sender);
      gameEngine.loss(m.sender);
      await client.sendMessage(m.chat, { text: `🃏 *B L A C K J A C K* 🃏\n\n${renderHand(game.playerHand, '🧑 Tú')}\n${renderHand(game.dealerHand, '🤖 Dealer')}\n\n💥 *¡TE PASASTE!* (${pt}) Perdiste ${game.apuesta} XP.` }, { quoted: m });
      return true;
    }

    if (pt === 21) {
      resolveDealer(game);
      gameEngine.end(m.chat, 'blackjack', m.sender);
      const dt = handTotal(game.dealerHand);
      let resultado;
      if (dt > 21 || pt > dt) { const g = game.apuesta * 2; gameEngine.reward(m.sender, { xp: g, win: true }); resultado = `🎉 *¡GANASTE!* +${g} XP`; }
      else if (pt === dt) { gameEngine.refundBet(m.sender, game.apuesta); resultado = `🤝 *EMPATE.* Recuperas tu apuesta.`; }
      else { gameEngine.loss(m.sender); resultado = `😢 *PERDISTE.* -${game.apuesta} XP`; }
      await client.sendMessage(m.chat, { text: `🃏 *B L A C K J A C K* 🃏\n\n${renderHand(game.playerHand, '🧑 Tú')}\n${renderHand(game.dealerHand, '🤖 Dealer')}\n\n${resultado}` }, { quoted: m });
      return true;
    }

    await client.sendMessage(m.chat, { text: `🃏 *B L A C K J A C K* 🃏\n\n${renderHand(game.playerHand, '🧑 Tú')}\n${renderHand(game.dealerHand, '🤖 Dealer', true)}\n\nEscribe *pedir* (o *hit*) o *plantar* (o *stand*).` });
    return true;
  }

  // STAND / PLANTARSE
  resolveDealer(game);
  gameEngine.end(m.chat, 'blackjack', m.sender);
  const pt = handTotal(game.playerHand), dt = handTotal(game.dealerHand);
  let resultado;
  if (dt > 21 || pt > dt) { const g = game.apuesta * 2; gameEngine.reward(m.sender, { xp: g, win: true }); resultado = `🎉 *¡GANASTE!* +${g} XP`; }
  else if (pt === dt) { gameEngine.refundBet(m.sender, game.apuesta); resultado = `🤝 *EMPATE.* Recuperas tu apuesta.`; }
  else { gameEngine.loss(m.sender); resultado = `😢 *PERDISTE.* -${game.apuesta} XP`; }
  await client.sendMessage(m.chat, { text: `🃏 *B L A C K J A C K* 🃏\n\n${renderHand(game.playerHand, '🧑 Tú')}\n${renderHand(game.dealerHand, '🤖 Dealer')}\n\n${resultado}` }, { quoted: m });
  return true;
};

export default [cmdBlackjack, cmdDado];
