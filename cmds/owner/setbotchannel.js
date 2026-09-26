import { getBotSettings } from '../../utils/tools.js';

export default {
  command: ['setchannel', 'setbotchannel'],
  category: 'owner',
  desc: 'Configura el canal oficial del bot obteniendo su metadata.',
  isOwner: true,
  run: async (client, m, args) => {
    const config = getBotSettings(client);
    
    const value = args.join(' ').trim()
    if (!value) {
      return m.reply(`❀ Ingresa el enlace de un canal de WhatsApp.\n\nEjemplo:\n*${m.usedPrefix || '.'}setchannel* https://whatsapp.com/channel/XXXXXXXXXXXXXX`)
    }
    
    const channelUrl = value.match(/(?:https:\/\/)?(?:www\.)?(?:chat\.|wa\.)?whatsapp\.com\/channel\/([0-9A-Za-z]{22,24})/i)?.[1]
    if (!channelUrl) return m.reply('ꕥ El enlace proporcionado no es válido.')
    
    try {
      await m.reply('⏳ *Obteniendo información del canal...*');
      const info = await client.newsletterMetadata("invite", channelUrl)
      if (!info) return m.reply('ꕥ No se pudo obtener información del canal.')
      
      config.id = info.id;
      config.nameid = info.thread_metadata?.name?.text || "Canal sin nombre";
      config.link = value; // Guardar el link por si otros comandos lo necesitan

      global.saveDatabaseAsync?.();

      return m.reply(`❀ Se cambió el canal del Socket a *"${config.nameid}"* correctamente.`);
    } catch (e) {
      return m.reply(`❌ Error al procesar el canal.\n[Error: *${e.message}*]`)
    }
  },
};
