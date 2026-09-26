const FIELDS = {
  desc: {
    aliases: ['deldescription', 'deldesc'],
    key: 'description',
    label: 'descripción',
    empty: '',
  },
  genre: {
    aliases: ['delgenre', 'delgenero'],
    key: 'genre',
    label: 'género',
    empty: '',
  },
  hobby: {
    aliases: ['delpasatiempo', 'removehobby', 'delhobby'],
    key: 'pasatiempo',
    label: 'pasatiempo',
    empty: 'No definido',
  },
  birth: {
    aliases: ['delbirth', 'delcumpleaños'],
    key: 'birth',
    label: 'fecha de nacimiento',
    empty: '',
  },
};

const allCommands = Object.values(FIELDS).flatMap(f => f.aliases);

export default {
  command: allCommands,
  category: 'profile',
  desc: 'Elimina campos de tu perfil (descripción, género, pasatiempo, cumpleaños).',
  run: async (client, m, args, usedPrefix, command) => {
    const user = global.db.data.users[m.sender];
    const field = Object.values(FIELDS).find(f => f.aliases.includes(command));
    if (!field) return;

    if (!user) return;
    if (!user[field.key] || user[field.key] === field.empty) {
      return m.reply(`❌ No tienes un(a) ${field.label} establecido(a).`);
    }

    user[field.key] = field.empty;
    global.saveDatabaseAsync?.();
    return m.reply(`✅ Tu ${field.label} ha sido eliminado(a).`);
  },
};
