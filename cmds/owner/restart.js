export default {
  command: ['restart', 'reiniciar'],
  category: 'owner',
  desc: 'Guarda la base de datos atómica y reinicia el proceso del bot.',
  isOwner: true,
  run: async (client, m) => {
    await m.reply(`🔄 *Reiniciando el Bot...*\nGuardando datos en SQLite y cerrando sesiones...`);
    try {
      if (typeof global.saveDatabaseAsync === 'function') {
        await global.saveDatabaseAsync();
      }
    } catch (e) {
      console.error('[Restart flush error]:', e);
    }

    setTimeout(() => {
      if (process.send) {
        process.send('restart');
      } else {
        process.exit(0);
      }
    }, 1500);
  },
};
