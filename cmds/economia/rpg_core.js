/**
 * 🪙 rpg_core.js — Funciones compartidas de economía y RPG.
 * Centraliza deducción de fondos, multiplicadores pasivos y cooldowns.
 */

/**
 * Deduce fondos de la cartera primero y luego del banco si es necesario.
 * @param {object} user - Objeto de usuario en la base de datos
 * @param {number} amount - Cantidad a deducir
 * @returns {number} Cantidad real deducida
 */
export function deductFunds(user, amount) {
  const coins = user.coins || 0;
  const bank = user.bank || 0;
  const total = coins + bank;
  if (total <= amount) {
    user.coins = 0;
    user.bank = 0;
    return Math.max(0, total);
  }
  if (coins >= amount) {
    user.coins -= amount;
  } else {
    user.coins = 0;
    user.bank -= (amount - coins);
  }
  return amount;
}

/**
 * Aplica multiplicadores pasivos por títulos o buffs temporales.
 * @param {object} user - Objeto de usuario
 * @param {number} baseAmount - Cantidad base
 * @param {string} type - Tipo de acción ('work', 'mine', 'fish', 'dungeon', 'streak', 'raid', etc.)
 * @returns {number} Cantidad ajustada
 */
export function applyMultipliers(user, baseAmount, type = '') {
  let finalAmount = baseAmount;
  const now = Date.now();

  // Multiplicadores según título equipado
  if (type === 'work' && user.title === 'title_legend') {
    finalAmount = Math.floor(finalAmount * 1.15);
  } else if (type === 'mine' && user.title === 'title_miner') {
    finalAmount = Math.floor(finalAmount * 1.20);
  } else if (type === 'fish' && user.title === 'title_fisher') {
    finalAmount = Math.floor(finalAmount * 1.20);
  } else if (type === 'dungeon' && user.title === 'title_fire') {
    finalAmount = Math.floor(finalAmount * 1.20);
  } else if (type === 'streak' && user.title === 'title_tycoon') {
    finalAmount = Math.floor(finalAmount * 1.20);
  } else if (type === 'raid' && user.title === 'title_fire') {
    finalAmount = Math.floor(finalAmount * 1.20);
  }

  // Buff temporal de fortuna
  if (user.fortuneBuff && user.fortuneBuff.expiresAt > now) {
    finalAmount = Math.floor(finalAmount * (1 + (user.fortuneBuff.value || 0.1)));
  }

  return finalAmount;
}

/**
 * Verifica si un comando está listo para ejecutarse según su cooldown.
 * @param {object} user - Objeto de usuario
 * @param {string} key - Clave del cooldown (ej. 'lastwork', 'lastmine')
 * @returns {{ ready: boolean, remaining: number }}
 */
export function checkCooldown(user, key) {
  const now = Date.now();
  const last = user[key] || 0;
  const remaining = last - now;
  return {
    ready: remaining <= 0,
    remaining: Math.max(0, remaining)
  };
}

/**
 * Establece el nuevo tiempo de cooldown para una clave.
 * @param {object} user - Objeto de usuario
 * @param {string} key - Clave del cooldown
 * @param {number} durationMs - Duración del cooldown en milisegundos
 */
export function setCooldown(user, key, durationMs) {
  user[key] = Date.now() + durationMs;
}
