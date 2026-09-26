/**
 * 🎮 GameEngine — Motor centralizado de sesiones de juego.
 *
 * Gestiona todas las sesiones activas, timeouts, recompensas y estadísticas
 * de forma unificada para evitar duplicación de lógica en cada juego.
 *
 * Uso:
 *   import { gameEngine } from '../../utils/gameEngine.js';
 *   gameEngine.start(chatId, 'trivia', sender, { answer: 'x' }, 60000);
 *   gameEngine.get(chatId, 'trivia');
 *   gameEngine.end(chatId, 'trivia');
 *   gameEngine.reward(sender, { xp: 200, coins: 500 });
 */

class GameEngine {
  constructor() {
    /** @type {Map<string, object>} */
    this.sessions = new Map();
  }

  /**
   * Genera la key del juego. Para juegos per-player (blackjack),
   * incluye el sender en la key.
   */
  _key(chatId, type, sender = null) {
    return sender ? `${chatId}_${type}_${sender}` : `${chatId}_${type}`;
  }

  /**
   * Inicia una nueva sesión de juego.
   * @param {string} chatId - ID del chat
   * @param {string} type - Tipo de juego (trivia, blackjack, wordle, etc.)
   * @param {string} sender - JID del jugador que inicia
   * @param {object} data - Datos específicos del juego
   * @param {object} opts - Opciones
   * @param {number} opts.timeout - Timeout en ms (default 60000)
   * @param {boolean} opts.perPlayer - Si es per-player (como blackjack)
   * @param {function} opts.onTimeout - Callback cuando se agota el tiempo
   * @returns {object} La sesión creada
   */
  start(chatId, type, sender, data = {}, opts = {}) {
    const { timeout = 60000, perPlayer = false, onTimeout = null } = opts;
    const key = this._key(chatId, type, perPlayer ? sender : null);

    if (this.sessions.has(key)) return null; // Ya existe sesión

    const timeoutId = setTimeout(() => {
      if (this.sessions.has(key)) {
        this.sessions.delete(key);
        if (onTimeout) {
          try {
            onTimeout();
          } catch (err) {
            console.error(`Error in game timeout callback for ${key}:`, err);
          }
        }
      }
    }, timeout);

    const session = {
      type,
      sender,
      chatId,
      apuesta: data.apuesta || 0,
      startedAt: Date.now(),
      timeoutId,
      ...data,
    };

    this.sessions.set(key, session);
    return session;
  }

  /**
   * Obtiene una sesión activa.
   */
  get(chatId, type, sender = null) {
    // Intentar per-player primero, luego per-chat
    if (sender) {
      const perPlayer = this.sessions.get(this._key(chatId, type, sender));
      if (perPlayer) return perPlayer;
    }
    return this.sessions.get(this._key(chatId, type)) || null;
  }

  /**
   * Verifica si hay un juego activo.
   */
  has(chatId, type, sender = null) {
    if (sender && this.sessions.has(this._key(chatId, type, sender))) return true;
    return this.sessions.has(this._key(chatId, type));
  }

  /**
   * Finaliza una sesión, limpiando el timeout.
   */
  end(chatId, type, sender = null) {
    // Per-player primero
    let key = this._key(chatId, type, sender);
    let session = this.sessions.get(key);
    if (!session) {
      key = this._key(chatId, type);
      session = this.sessions.get(key);
    }
    if (session) {
      if (session.timeoutId) clearTimeout(session.timeoutId);
      this.sessions.delete(key);
      return session;
    }
    return null;
  }

  /**
   * Recompensa a un jugador con XP y/o coins.
   * También actualiza estadísticas de juegos y envía notificaciones de logros.
   * @param {string} sender - JID del jugador
   * @param {object} reward
   * @param {number} reward.xp - XP a otorgar
   * @param {number} reward.coins - Coins a otorgar
   * @param {boolean} reward.win - Si es una victoria (para stats)
   * @param {object} reward.client - Cliente de Baileys (para notificaciones)
   * @param {string} reward.chatId - Chat ID (para notificaciones)
   * @returns {Array} Logros recién desbloqueados
   */
  reward(sender, { xp = 0, coins = 0, win = true, client = null, chatId = null, multiplier = 1 } = {}) {
    const user = global.db.data.users[sender];
    if (!user) return [];
    
    const now = Date.now();

    if (xp > 0) {
      // Apply base title buff
      if (user.title === 'title_star') xp = Math.floor(xp * 1.15);
      
      // Apply custom multiplier (e.g. triviaBuff)
      xp = Math.floor(xp * multiplier);

      // Apply global xpBoost
      if (user.xpBoost && user.xpBoost.expiresAt > now) {
        xp = Math.floor(xp * user.xpBoost.multiplier);
      }

      // Apply global fortuneBuff (+10%)
      if (user.fortuneBuff && user.fortuneBuff.expiresAt > now) {
        xp = Math.floor(xp * (1 + user.fortuneBuff.value));
      }

      user.exp = (user.exp || 0) + xp;
    }

    if (coins > 0) {
      // Apply global fortuneBuff (+10%)
      if (user.fortuneBuff && user.fortuneBuff.expiresAt > now) {
        coins = Math.floor(coins * (1 + user.fortuneBuff.value));
      }
      user.coins = (user.coins || 0) + coins;
    }

    if (win) {
      user.gameWins = (user.gameWins || 0) + 1;
    } else {
      user.gameLosses = (user.gameLosses || 0) + 1;
    }
    // Verificar logros tras cada recompensa
    const unlocked = this._checkAchievements(sender);

    // Enviar notificación automática si hay client
    if (unlocked.length > 0 && client && chatId) {
      const name = user.name || sender.split('@')[0];
      for (const ach of unlocked) {
        const rewardParts = [];
        if (ach.xp > 0) rewardParts.push(`+${ach.xp} XP`);
        if (ach.coins > 0) rewardParts.push(`+${ach.coins} coins`);
        const rewardStr = rewardParts.length ? ` (${rewardParts.join(', ')})` : '';
        client.sendMessage(chatId, {
          text: `🏆 *¡LOGRO DESBLOQUEADO!*\n\n*${name}* ha obtenido:\n${ach.label}${rewardStr}`,
          mentions: [sender]
        }).catch(() => {});
      }
    }

    return unlocked;
  }

  /**
   * Registra una pérdida sin otorgar recompensas.
   */
  loss(sender) {
    const user = global.db.data.users[sender];
    if (!user) return;
    user.gameLosses = (user.gameLosses || 0) + 1;
  }

  /**
   * Valida y resta una apuesta de XP.
   * @returns {number|false} La apuesta validada, o false si no se puede
   */
  validateBet(sender, amount, minBet = 10) {
    const user = global.db.data.users[sender];
    if (!user) return false;
    if (amount < minBet) return false;
    if ((user.exp || 0) < amount) return false;
    user.exp -= amount;
    return amount;
  }

  /**
   * Devuelve una apuesta al jugador.
   */
  refundBet(sender, amount) {
    const user = global.db.data.users[sender];
    if (!user || !amount) return;
    user.exp = (user.exp || 0) + amount;
  }

  /**
   * Obtiene estadísticas de juegos de un jugador.
   */
  getStats(sender) {
    const user = global.db.data.users[sender] || {};
    return {
      wins: user.gameWins || 0,
      losses: user.gameLosses || 0,
      total: (user.gameWins || 0) + (user.gameLosses || 0),
      winRate: (user.gameWins || 0) + (user.gameLosses || 0) > 0
        ? Math.round(((user.gameWins || 0) / ((user.gameWins || 0) + (user.gameLosses || 0))) * 100)
        : 0,
      achievements: user.achievements || [],
    };
  }

  /**
   * Cuenta sesiones activas (diagnóstico).
   */
  get activeSessions() {
    return this.sessions.size;
  }

  /**
   * Verifica logros automáticamente después de cada recompensa.
   * Retorna array de logros recién desbloqueados (para notificaciones).
   * @param {string} sender
   * @returns {Array<{id: string, label: string, xp: number, coins: number}>} Nuevos logros
   */
  _checkAchievements(sender) {
    const user = global.db.data.users[sender];
    if (!user) return [];
    if (!user.achievements) user.achievements = [];

    const ACHIEVEMENT_DEFS = [
      { id: 'first_win', label: '🏅 Primera Victoria', check: () => (user.gameWins || 0) >= 1, xp: 100, coins: 500 },
      { id: 'ten_wins', label: '⭐ Guerrero (10 victorias)', check: () => (user.gameWins || 0) >= 10, xp: 500, coins: 2000 },
      { id: 'fifty_wins', label: '🔥 Leyenda (50 victorias)', check: () => (user.gameWins || 0) >= 50, xp: 2000, coins: 8000 },
      { id: 'hundred_wins', label: '💎 Centurión (100 victorias)', check: () => (user.gameWins || 0) >= 100, xp: 5000, coins: 20000 },
      { id: 'millionaire', label: '💰 Millonario', check: () => ((user.coins || 0) + (user.bank || 0)) >= 1000000, xp: 3000, coins: 0 },
      { id: 'xp_master', label: '🧠 Maestro XP (50k XP)', check: () => (user.exp || 0) >= 50000, xp: 0, coins: 5000 },
      { id: 'veteran', label: '🎖️ Veterano (500 comandos)', check: () => (user.usedcommands || 0) >= 500, xp: 1000, coins: 3000 },
      { id: 'marathon', label: '🏃 Maratonista (1000 comandos)', check: () => (user.usedcommands || 0) >= 1000, xp: 3000, coins: 10000 },
      { id: 'high_roller', label: '🎲 Apostador (100k coins)', check: () => ((user.coins || 0) + (user.bank || 0)) >= 100000, xp: 500, coins: 0 },
      { id: 'streak_5', label: '🔥 Racha de 5 victorias', check: () => (user.gameWins || 0) >= 5, xp: 200, coins: 1000 },
    ];

    const newlyUnlocked = [];
    for (const { id, label, check, xp, coins } of ACHIEVEMENT_DEFS) {
      if (!user.achievements.includes(id) && check()) {
        user.achievements.push(id);
        // Otorgar recompensa del logro (sin recursión — directo)
        if (xp > 0) user.exp = (user.exp || 0) + xp;
        if (coins > 0) user.coins = (user.coins || 0) + coins;
        newlyUnlocked.push({ id, label, xp, coins });
      }
    }
    return newlyUnlocked;
  }
}

// Singleton exportado
export const gameEngine = new GameEngine();
