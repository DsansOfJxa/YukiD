// utils/ui.js

/**
 * UI Utilities for minimalist and standardized bot messages.
 */

export const UI = {
  symbols: {
    success: '✔️',
    error: '❌',
    warn: '⚠️',
    info: 'ℹ️',
    loading: '🕒',
    star: '⭐',
    sparkle: '✨',
    flower: 'ꕤ',
    bullet: '',
    separator: '────────────────'
  },

  /**
   * Generates a standard styled message.
   * @param {string} title - The title of the message.
   * @param {string} content - The main body of the message.
   * @param {string} footer - Optional footer text.
   * @returns {string} The formatted message.
   */
  box: (title, content, footer = '') => {
    let msg = ` *${title}*\n${UI.symbols.separator}\n\n${content}`;
    if (footer) {
      msg += `\n\n${footer}`;
    }
    return msg;
  },

  /**
   * Generates an error message.
   * @param {string} error - The error message to display.
   * @returns {string} The formatted error message.
   */
  error: (error) => {
    return `> ${UI.symbols.error} *Ha ocurrido un error*\n${error}`;
  },

  /**
   * Generates a success message.
   * @param {string} message - The success message to display.
   * @returns {string} The formatted success message.
   */
  success: (message) => {
    return `> ${UI.symbols.success} *Éxito*\n${message}`;
  }
};
