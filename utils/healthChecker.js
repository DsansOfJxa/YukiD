// utils/healthChecker.js
// Neutralizado para evitar que las pruebas de ping raíz desactiven APIs funcionales

export function isApiOnline(name) {
  return true;
}

export function setApiOffline(name) {
  // No-op: no desactivar APIs globalmente para permitir fallbacks dinámicos en tiempo real
}

export function setApiOnline(name) {
  // No-op
}

export async function runHealthCheck() {
  // No-op
}

export function resetAllApis() {
  // No-op
}
