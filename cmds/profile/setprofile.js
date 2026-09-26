import moment from 'moment-timezone';
moment.locale('es');

const FIELDS = {
  desc: {
    aliases: ['setdescription', 'setdesc'],
    key: 'description',
    label: 'descripción',
    validate: (input) => input.length <= 200 ? null : 'La descripción no puede superar los 200 caracteres.',
    example: 'Hola, uso WhatsApp!',
    success: (val, prefix) => `Se ha establecido tu descripción, puedes revisarla con ${prefix}profile ฅ^•ﻌ•^ฅ`,
  },
  genre: {
    aliases: ['setgenre', 'setgenero'],
    key: 'genre',
    label: 'género',
    validate: (input) => {
      const genresList = ['Hombre', 'Mujer', 'Femboy', 'Transgénero', 'Gay', 'Lesbiana', 'No Binario', 'Pansexual', 'Bisexual', 'Asexual'];
      const match = genresList.find(g => g.toLowerCase() === input.toLowerCase());
      if (!match && !isNaN(input)) {
        const idx = parseInt(input) - 1;
        if (idx >= 0 && idx < genresList.length) return null;
        return `Número inválido. Elige del 1 al ${genresList.length}.`;
      }
      if (!match) return `Género no reconocido. Opciones:\n${genresList.map((g, i) => `${i + 1}. ${g}`).join('\n')}`;
      return null;
    },
    transform: (input) => {
      const genresList = ['Hombre', 'Mujer', 'Femboy', 'Transgénero', 'Gay', 'Lesbiana', 'No Binario', 'Pansexual', 'Bisexual', 'Asexual'];
      if (!isNaN(input)) return genresList[parseInt(input) - 1];
      return genresList.find(g => g.toLowerCase() === input.toLowerCase()) || input;
    },
    example: 'hombre',
    success: (val) => `Tu género ha sido establecido como: *${val}*.`,
  },
  hobby: {
    aliases: ['setpasatiempo', 'sethobby'],
    key: 'pasatiempo',
    label: 'pasatiempo',
    validate: (input) => {
      const pasatiemposDisponibles = [
        '📚 Leer', '✍️ Escribir', '🎤 Cantar', '💃 Bailar', '🎮 Jugar',
        '🎨 Dibujar', '🍳 Cocinar', '✈️ Viajar', '🏊 Nadar', '📸 Fotografía',
        '🎧 Escuchar música', '🏀 Deportes', '🎬 Ver películas', '🌿 Jardinería',
        '🧩 Puzzles', '🎸 Tocar instrumento', '📖 Estudiar', '🧘 Meditar',
        '🛠️ Programar', '🕹️ Videojuegos'
      ];
      const match = pasatiemposDisponibles.find(p => p.toLowerCase().includes(input.toLowerCase()));
      if (!match && !isNaN(input)) {
        const idx = parseInt(input) - 1;
        if (idx >= 0 && idx < pasatiemposDisponibles.length) return null;
        return `Número inválido. Elige del 1 al ${pasatiemposDisponibles.length}.`;
      }
      if (!match) return `Pasatiempo no reconocido. Opciones:\n${pasatiemposDisponibles.map((p, i) => `${i + 1}. ${p}`).join('\n')}`;
      return null;
    },
    transform: (input) => {
      const pasatiemposDisponibles = [
        '📚 Leer', '✍️ Escribir', '🎤 Cantar', '💃 Bailar', '🎮 Jugar',
        '🎨 Dibujar', '🍳 Cocinar', '✈️ Viajar', '🏊 Nadar', '📸 Fotografía',
        '🎧 Escuchar música', '🏀 Deportes', '🎬 Ver películas', '🌿 Jardinería',
        '🧩 Puzzles', '🎸 Tocar instrumento', '📖 Estudiar', '🧘 Meditar',
        '🛠️ Programar', '🕹️ Videojuegos'
      ];
      if (!isNaN(input)) return pasatiemposDisponibles[parseInt(input) - 1];
      return pasatiemposDisponibles.find(p => p.toLowerCase().includes(input.toLowerCase())) || input;
    },
    example: '1',
    success: (val) => `Tu pasatiempo ha sido establecido: *${val}*.`,
  },
  birth: {
    aliases: ['setbirth', 'setcumpleaños'],
    key: 'birth',
    label: 'fecha de nacimiento',
    validate: (input) => {
      const formats = ['DD/MM/YYYY', 'DD-MM-YYYY', 'YYYY-MM-DD'];
      const parsed = moment(input, formats, true);
      if (!parsed.isValid()) return 'Formato inválido. Usa DD/MM/YYYY, DD-MM-YYYY o YYYY-MM-DD.';
      const currentYear = new Date().getFullYear();
      const year = parsed.year();
      if (year < 1900 || year > currentYear) return `El año debe estar entre 1900 y ${currentYear}.`;
      return null;
    },
    transform: (input) => {
      const formats = ['DD/MM/YYYY', 'DD-MM-YYYY', 'YYYY-MM-DD'];
      return moment(input, formats, true).format('DD/MM/YYYY');
    },
    example: '25/12/2000',
    success: (val) => `Tu fecha de nacimiento ha sido establecida: *${val}*.`,
  },
};

// Generar lista plana de todos los aliases
const allCommands = Object.values(FIELDS).flatMap(f => f.aliases);

export default {
  command: allCommands,
  category: 'profile',
  desc: 'Configura campos de tu perfil (descripción, género, pasatiempo, cumpleaños).',
  run: async (client, m, args, usedPrefix, command) => {
    if (!global.db.data.users[m.sender]) global.db.data.users[m.sender] = {};
    const user = global.db.data.users[m.sender];
    const field = Object.values(FIELDS).find(f => f.aliases.includes(command));
    if (!field) return;

    const input = args.join(' ').trim();
    if (!input) {
      return m.reply(`❌ Debes especificar un valor.\n*Ejemplo:* ${usedPrefix + command} ${field.example}`);
    }

    const error = field.validate(input);
    if (error) return m.reply(`❌ ${error}`);

    const value = field.transform ? field.transform(input) : input;
    user[field.key] = value;
    global.saveDatabaseAsync?.();

    return m.reply(field.success(value, usedPrefix));
  },
};
