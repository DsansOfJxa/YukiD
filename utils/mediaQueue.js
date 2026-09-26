// utils/mediaQueue.js
import Logger from './logger.js';

const queue = [];
let activeCount = 0;
const MAX_CONCURRENT = 2;
const TASK_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutos

export function getQueuePosition() {
  return queue.length;
}

/**
 * Encola una tarea pesada y devuelve una Promesa que se resuelve con la función de liberación `release`.
 * Debe llamarse a `release()` en un bloque finally al terminar la ejecución de la tarea.
 * 
 * @param {object} m - Objeto mensaje de WhatsApp
 * @param {function} onQueue - Callback opcional llamado si la tarea es encolada, recibe la posición.
 * @returns {Promise<function>} Función release a ejecutar en el finally
 */
export function enqueueTask(m, onQueue) {
  return new Promise((resolve) => {
    const task = {
      m,
      resolve: (releaseFn) => resolve(releaseFn),
      timestamp: Date.now()
    };

    queue.push(task);

    if (activeCount >= MAX_CONCURRENT) {
      const position = queue.length;
      if (typeof onQueue === 'function') {
        onQueue(position);
      }
    }

    processQueue();
  });
}

function processQueue() {
  if (activeCount >= MAX_CONCURRENT || queue.length === 0) return;

  const nextTask = queue.shift();
  activeCount++;

  let isReleased = false;
  let safetyTimeout = null;

  const release = () => {
    if (isReleased) return;
    isReleased = true;
    if (safetyTimeout) {
      clearTimeout(safetyTimeout);
    }
    activeCount--;
    processQueue();
  };

  safetyTimeout = setTimeout(() => {
    Logger.warn(`[Queue] La tarea excedió el límite de ${TASK_TIMEOUT_MS / 1000}s. Auto-liberando slot.`);
    release();
  }, TASK_TIMEOUT_MS);

  nextTask.resolve(release);
}
