/**
 * 📝 juegos_palabras.js — Juegos interactivos basados en palabras, ingenio y adivinanzas.
 * Reúne: ahorcado, adivinanza, trivia, wordle
 */
import { gameEngine } from "../../utils/gameEngine.js";

// ── UTILIDADES DE NORMALIZACIÓN ──

const normalize = (str) => {
  if (!str || typeof str !== "string") return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
};

const normalizeChar = (c) => {
  if (!c) return "";
  return c
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

// Elimina artículos iniciales (el, la, los, las, un, una...) para comparar respuestas
const cleanAnswer = (str) => {
  const norm = normalize(str).replace(/^[¿?¡!.,;:"'()\s]+|[¿?¡!.,;:"'()\s]+$/g, "");
  return norm.replace(/^(el|la|los|las|un|una|unos|unas)\s+/i, "").trim();
};

// ── AHORCADO: ARTE ASCII VISUAL Y BANCO DE PALABRAS ──

const GALLOWS_STAGES = [
  // 0 fallos
  `┌─────────┐\n│         │\n│\n│\n│\n└────────────`,
  // 1 fallo (cabeza)
  `┌─────────┐\n│         │\n│         😐\n│\n│\n└────────────`,
  // 2 fallos (cuerpo)
  `┌─────────┐\n│         │\n│         😐\n│         │\n│\n└────────────`,
  // 3 fallos (un brazo)
  `┌─────────┐\n│         │\n│         😟\n│        /│\n│\n└────────────`,
  // 4 fallos (dos brazos)
  `┌─────────┐\n│         │\n│         😨\n│        /│\\\n│\n└────────────`,
  // 5 fallos (una pierna)
  `┌─────────┐\n│         │\n│         😱\n│        /│\\\n│        /\n└────────────`,
  // 6 fallos (muerto)
  `┌─────────┐\n│         │\n│         💀\n│        /│\\\n│        / \\\n└────────────`
];

const renderGallows = (errors) => {
  const idx = Math.min(Math.max(0, errors), GALLOWS_STAGES.length - 1);
  return GALLOWS_STAGES[idx];
};

// Banco de palabras de dificultad intermedia en español (6 a 11 letras, sustantivos/conceptos no triviales ni absurdos)
const PALABRAS_AHORCADO = [
  "ACERTIJO", "ALQUIMISTA", "ANATOMIA", "ANTARTIDA", "ARCHIPIELAGO", "ARQUITECTO",
  "ASTEROIDE", "ASTRONAUTA", "AVENTURA", "BALLENA", "BARRICADA", "BIBLIOTECA",
  "BRUJERIA", "BRUJULA", "CABALLERO", "CALEIDOSCOPIO", "CAMALEON", "CARABELA",
  "CARAVANA", "CASCADA", "CATACUMBAS", "CENTINELA", "CICATRIZ", "CIUDADELA",
  "CONSTELACION", "CONTINENTE", "CORALINO", "CRONOMETRO", "DESIERTO", "DIAMANTE",
  "DINOSAURIO", "ECLIPSE", "ECOSISTEMA", "ELEFANTE", "EMPERADOR", "ESCARABAJO",
  "ESCENARIO", "ESCLAVITUD", "ESCUDERO", "ESFINGE", "ESMERALDA", "ESPECTRO",
  "ESTALACTITA", "FANTASMA", "FARAON", "FILOSOFIA", "FORTALEZA", "FOSFORO",
  "GALAXIA", "GEISER", "GLACIAR", "GLADIADOR", "GRAVEDAD", "HEMISFERIO",
  "HIMALAYA", "HORIZONTE", "HURACAN", "ILUSION", "IMPERIO", "INCOGNITA",
  "INVERNADERO", "JARDINERO", "JEROGLIFICO", "JURASICO", "LABERINTO", "LABORATORIO",
  "LANGOSTA", "LEOPARDO", "LOCOMOTORA", "MAGNITUD", "MANANTIAL", "MARIPOSA",
  "MAUSOLEO", "METEORITO", "MICROSCOPIO", "MINOTAURO", "MISTERIO", "MONASTERIO",
  "MONUMENTO", "MURCIELAGO", "NAUFRAGIO", "NEBULOSA", "NOSTALGIA", "OBSERVATORIO",
  "ORACULO", "ORGANISMO", "ORQUESTA", "PALEONTOLOGO", "PANTANO", "PARACAIDAS",
  "PARADIGMA", "PERGAMINO", "PETROLEO", "PIRAMIDE", "PISTOLERO", "PLANISFERIO",
  "PRESAGIO", "PROFECIA", "QUIMICA", "RASCACIELOS", "REFUGIO", "REINO",
  "RELAMPAGO", "RELIQUIA", "RELOJERO", "RINOCERONTE", "ROQUEDAL", "SABIDURIA",
  "SABOTAJE", "SANTUARIO", "SARCOFAGO", "SATELITE", "SECUNDARIO", "SEDIMENTO",
  "SILUETA", "SIMBIOSIS", "SUBMARINO", "SUPERNOVA", "TELEPATIA", "TEMPESTAD",
  "TERREMOTO", "TESORO", "TORMENTA", "TORNADO", "TRIPULACION", "TROVADOR",
  "TSUNAMI", "UNIVERSO", "VAMPIRO", "VENTISCA", "VOLCAN", "YACIMIENTO", "ZAFIRO"
];

function obtenerPalabraAhorcado() {
  return PALABRAS_AHORCADO[Math.floor(Math.random() * PALABRAS_AHORCADO.length)];
}

// ── ADIVINANZAS Y ACERTIJOS NATIVOS EN ESPAÑOL (Dificultad Intermedia) ──

const BANCO_ADIVINANZAS = [
  {
    q: "Vuelo de noche, duermo de día y nunca verás plumas en el ala mía. ¿Qué soy?",
    a: "El murciélago",
    alts: ["murcielago", "murciélago"]
  },
  {
    q: "Tengo ciudades pero no casas, bosques pero no árboles, ríos pero no agua. ¿Qué soy?",
    a: "El mapa",
    alts: ["mapa", "el mapa", "mapamundi"]
  },
  {
    q: "Se rompe en cuanto pronuncias su nombre. ¿Qué es?",
    a: "El silencio",
    alts: ["silencio", "el silencio"]
  },
  {
    q: "Cuanto más caliente estoy, más fresco me consideran. ¿Qué soy?",
    a: "El pan",
    alts: ["pan", "el pan"]
  },
  {
    q: "Pasa por el agua y no se moja, pasa por el fuego y no se quema. ¿Qué es?",
    a: "La sombra",
    alts: ["sombra", "la sombra"]
  },
  {
    q: "Cuanto más le quitas, más grande se hace. ¿Qué es?",
    a: "El agujero",
    alts: ["agujero", "el agujero", "hoyo", "el hoyo"]
  },
  {
    q: "Tengo dientes y no muerdo, guardo secretos y abro misterios. ¿Qué soy?",
    a: "La llave",
    alts: ["llave", "la llave"]
  },
  {
    q: "Sube llena y baja vacía, y si no se da prisa, la sopa se enfría. ¿Qué es?",
    a: "La cuchara",
    alts: ["cuchara", "la cuchara"]
  },
  {
    q: "Cae de una torre alta y no se mata, pero cae al agua y se desbarata. ¿Qué es?",
    a: "El papel",
    alts: ["papel", "el papel", "hoja de papel"]
  },
  {
    q: "Aunque tengo cuatro patas, nunca puedo correr; tengo la comida encima y nunca la puedo comer. ¿Qué soy?",
    a: "La mesa",
    alts: ["mesa", "la mesa"]
  },
  {
    q: "No tengo ojos, orejas ni voz, pero te respondo si me llamas y viajo con el viento. ¿Qué soy?",
    a: "El eco",
    alts: ["eco", "el eco"]
  },
  {
    q: "Me ves en el agua pero nunca me mojo. Si me miras fijamente, te miro a los ojos. ¿Qué soy?",
    a: "El reflejo",
    alts: ["reflejo", "el reflejo", "espejo"]
  },
  {
    q: "Nazco grande y muero chica, paso mi vida llorando fuego y alumbro a quien me rica. ¿Qué soy?",
    a: "La vela",
    alts: ["vela", "la vela", "cirio", "candela"]
  },
  {
    q: "Pasa a través de un cristal sin romperlo y entra a una habitación sin abrir la puerta. ¿Qué es?",
    a: "La luz",
    alts: ["luz", "la luz", "rayo de sol"]
  },
  {
    q: "Siempre va delante de ti, pero nunca lo puedes ver ni tocar. ¿Qué es?",
    a: "El futuro",
    alts: ["futuro", "el futuro", "el destino"]
  },
  {
    q: "Si me tienes, quieres compartirme; si me compartes, ya no me tienes. ¿Qué soy?",
    a: "El secreto",
    alts: ["secreto", "el secreto"]
  },
  {
    q: "Tiene cuello pero no cabeza, tiene cuerpo pero no brazos, tiene boca pero no habla. ¿Qué es?",
    a: "La botella",
    alts: ["botella", "la botella"]
  },
  {
    q: "Viene una vez en un minuto, dos veces en un momento, pero nunca en mil años. ¿Qué es?",
    a: "La letra M",
    alts: ["letra m", "m", "la m"]
  },
  {
    q: "Viste de verde en primavera, de oro en otoño y se desnuda en invierno. ¿Qué es?",
    a: "El árbol",
    alts: ["arbol", "árbol", "el arbol", "el árbol"]
  },
  {
    q: "Sube pero nunca baja, aunque los años pasen sin pausa. ¿Qué es?",
    a: "La edad",
    alts: ["edad", "la edad", "los años"]
  },
  {
    q: "Doy vueltas sin moverme de mi lugar, paso la vida en la pared marcando el paso sin descansar. ¿Qué soy?",
    a: "El reloj",
    alts: ["reloj", "el reloj"]
  },
  {
    q: "Si me alimentas vivo, pero si me das de beber, muero al instante. ¿Qué soy?",
    a: "El fuego",
    alts: ["fuego", "el fuego", "la llama"]
  },
  {
    q: "Tengo hojas pero no soy árbol, tengo lomo pero no soy animal, hablo sin voz y enseño sin hablar. ¿Qué soy?",
    a: "El libro",
    alts: ["libro", "el libro"]
  },
  {
    q: "Una caja redonda como un pandero, que si la tocas te dice el norte certero. ¿Qué es?",
    a: "La brújula",
    alts: ["brujula", "brújula", "la brujula", "la brújula"]
  },
  {
    q: "Blanca como la nieve, negra como el carbón, hablo sin tener boca y camino sin tener pies. ¿Qué es?",
    a: "La carta",
    alts: ["carta", "la carta"]
  },
  {
    q: "Cinco hermanos muy unidos que no se pueden mirar; cuando riñen no se pueden separar. ¿Qué son?",
    a: "Los dedos",
    alts: ["dedos", "los dedos"]
  },
  {
    q: "Chiquito como un ratón, guarda la casa como un león. ¿Qué es?",
    a: "El candado",
    alts: ["candado", "el candado"]
  },
  {
    q: "Te acompaña a todas partes bajo el sol, pero te abandona en la oscuridad total. ¿Qué es?",
    a: "La sombra",
    alts: ["sombra", "la sombra"]
  },
  {
    q: "Entre dos muros blancos hay una flor amarilla que al calor del fuego brilla. ¿Qué es?",
    a: "El huevo",
    alts: ["huevo", "el huevo"]
  },
  {
    q: "Soy redondo como el mundo, sin principio y sin final; me colocan en el dedo como prenda de lealtad. ¿Qué soy?",
    a: "El anillo",
    alts: ["anillo", "el anillo", "alianza"]
  },
  {
    q: "Tiene ojos y no puede ver, tiene escamas y no puede coser, nada en el agua sin perecer. ¿Qué es?",
    a: "El pez",
    alts: ["pez", "el pez", "pescado"]
  },
  {
    q: "Duerme en una cama que jamás se deshace, corre todo el tiempo y nunca tiene pies. ¿Qué es?",
    a: "El río",
    alts: ["rio", "río", "el rio", "el río"]
  },
  {
    q: "Tengo copa y no soy sombrero, tengo tronco y no soy madera, doy frutos sin ser huerta. ¿Qué soy?",
    a: "El árbol",
    alts: ["arbol", "árbol", "el arbol", "el árbol"]
  },
  {
    q: "Pasa por el bosque y no toca las ramas, pasa por el río y no bebe agua. ¿Qué es?",
    a: "El viento",
    alts: ["viento", "el viento", "el aire"]
  },
  {
    q: "Todos me pisan a mí, pero yo no piso a nadie; todos preguntan por mí, yo no pregunto por nadie. ¿Qué soy?",
    a: "El camino",
    alts: ["camino", "el camino", "la calle", "el sendero"]
  },
  {
    q: "Sin alas vuelo, sin ojos lloro; dondequiera que voy, oscuridad provoco. ¿Qué soy?",
    a: "La nube",
    alts: ["nube", "la nube", "la lluvia"]
  },
  {
    q: "Mil damas en un corral, todas mean a la par. ¿Qué es?",
    a: "Las tejas",
    alts: ["tejas", "las tejas", "el tejado"]
  },
  {
    q: "Tiene agujas pero no cose, no tiene ojos pero señala con rigor. ¿Qué es?",
    a: "El reloj",
    alts: ["reloj", "el reloj"]
  },
  {
    q: "Dos compañeras van al compás, con los pies delante y los ojos detrás. ¿Qué son?",
    a: "Las tijeras",
    alts: ["tijeras", "las tijeras"]
  },
  {
    q: "Oro parece, plata no es; quien no lo adivine bien tonto es.",
    a: "El plátano",
    alts: ["platano", "plátano", "el platano", "banana"]
  },
  {
    q: "Te lo digo y no me entiendes, te lo repito y no me comprendes. ¿Qué es?",
    a: "La tela",
    alts: ["tela", "la tela"]
  },
  {
    q: "Una cajita que se abre y se cierra, y dentro tiene un guardián que canta o yerra. ¿Qué es?",
    a: "La boca",
    alts: ["boca", "la boca"]
  },
  {
    q: "Larga como un camino, verde como el prado, se arrastra por el suelo sin tener cuidado. ¿Qué es?",
    a: "La serpiente",
    alts: ["serpiente", "la serpiente", "culebra"]
  },
  {
    q: "Tiene corona y no es rey, tiene escamas y no es pez, dulce como la miel al morder. ¿Qué es?",
    a: "La piña",
    alts: ["piña", "la piña", "ananá", "anana"]
  }
];

// ── TRIVIA: PREGUNTAS EN ESPAÑOL DE CULTURA GENERAL ──

const BANCO_TRIVIA = [
  { p: "¿En qué año llegó el ser humano a la Luna por primera vez?", r: "1969", alts: ["1969"] },
  { p: "¿Cuál es el río más largo y caudaloso del mundo?", r: "Amazonas", alts: ["amazonas", "el amazonas", "rio amazonas"] },
  { p: "¿Qué órgano del cuerpo humano consume más energía y oxígeno?", r: "El cerebro", alts: ["cerebro", "el cerebro"] },
  { p: "¿Quién pintó la famosa obra renacentista 'La Gioconda' (Mona Lisa)?", r: "Leonardo da Vinci", alts: ["da vinci", "leonardo da vinci", "leonardo"] },
  { p: "¿Cuál es el metal más ligero y menos denso de la tabla periódica?", r: "Litio", alts: ["litio", "el litio"] },
  { p: "¿Cuál es el planeta más grande del sistema solar?", r: "Júpiter", alts: ["jupiter", "júpiter"] },
  { p: "¿Qué elemento químico tiene el símbolo 'Au'?", r: "Oro", alts: ["oro", "el oro"] },
  { p: "¿En qué país se encuentran las ruinas milenarias de Machu Picchu?", r: "Perú", alts: ["peru", "perú"] },
  { p: "¿Quién escribió la célebre novela 'Cien años de soledad'?", r: "Gabriel García Márquez", alts: ["garcia marquez", "gabriel garcia marquez", "gabo"] },
  { p: "¿Cuál es el hueso más largo del cuerpo humano?", r: "El fémur", alts: ["femur", "fémur", "el femur"] },
  { p: "¿Qué gas es el más abundante en la atmósfera terrestre?", r: "Nitrógeno", alts: ["nitrogeno", "nitrógeno", "el nitrogeno"] },
  { p: "¿Cuál es el océano más grande y profundo de la Tierra?", r: "El Pacífico", alts: ["pacifico", "pacífico", "el pacifico", "oceano pacifico"] },
  { p: "¿Qué científico formuló la teoría de la relatividad general?", r: "Albert Einstein", alts: ["einstein", "albert einstein"] },
  { p: "¿Cuál es la capital oficial de Canadá?", r: "Ottawa", alts: ["ottawa"] },
  { p: "¿Qué instrumento musical tiene 88 teclas entre blancas y negras?", r: "El piano", alts: ["piano", "el piano"] },
  { p: "¿Cuál es el animal terrestre más veloz del planeta?", r: "El guepardo", alts: ["guepardo", "el guepardo", "chita"] },
  { p: "¿Qué continente tiene la mayor cantidad de países reconocidos?", r: "África", alts: ["africa", "áfrica"] },
  { p: "¿Qué inventó Johannes Gutenberg en el siglo XV que transformó la cultura?", r: "La imprenta", alts: ["imprenta", "la imprenta"] },
  { p: "¿Qué gas respiran principalmente las plantas durante la fotosíntesis?", r: "Dióxido de carbono", alts: ["dioxido de carbono", "co2", "carbono"] },
  { p: "¿Cuál es la velocidad aproximada de la luz en el vacío en km/s?", r: "300000", alts: ["300000", "300.000", "300,000"] },
  { p: "¿Qué civilización antigua construyó las pirámides de Guiza?", r: "Egipto", alts: ["egipcios", "egipto", "egipcia"] },
  { p: "¿Quién escribió la tragedia 'Romeo y Julieta'?", r: "William Shakespeare", alts: ["shakespeare", "william shakespeare"] },
  { p: "¿Cuál es la capital de Australia?", r: "Canberra", alts: ["canberra"] },
  { p: "¿Qué órgano produce la insulina en el cuerpo humano?", r: "El páncreas", alts: ["pancreas", "páncreas", "el pancreas"] },
  { p: "¿Cómo se llama el proceso biológico por el cual las orugas se convierten en mariposas?", r: "Metamorfosis", alts: ["metamorfosis", "la metamorfosis"] },
  { p: "¿Cuál es la montaña más alta del mundo sobre el nivel del mar?", r: "El Everest", alts: ["everest", "monte everest", "el everest"] },
  { p: "¿Qué país tiene forma de bota en el mapa de Europa?", r: "Italia", alts: ["italia"] },
  { p: "¿Cuál es el idioma nativo con mayor número de hablantes del mundo?", r: "Mandarín", alts: ["mandarin", "mandarín", "chino", "chino mandarin"] },
  { p: "¿En qué año cayó el Muro de Berlín?", r: "1989", alts: ["1989"] },
  { p: "¿Qué estrecho separa a España de Marruecos?", r: "Gibraltar", alts: ["gibraltar", "estrecho de gibraltar"] }
];

// ── WORDLE: DICCIONARIO EXPANDIDO DE 5 LETRAS EN ESPAÑOL ──

const PALABRAS_WORDLE = [
  "perro", "gatos", "tigre", "leona", "monte", "playa", "arena", "verde", "negro", "blusa",
  "libro", "cielo", "noche", "luces", "pared", "suelo", "banca", "largo", "corto", "antes",
  "campo", "plaza", "llama", "punto", "reloj", "media", "barco", "avion", "juego", "radio",
  "danza", "rueda", "feria", "nuevo", "viejo", "dulce", "claro", "marca", "tinta", "fondo",
  "silla", "linea", "disco", "carro", "metro", "clase", "curva", "final", "bruja", "trago",
  "siglo", "dolor", "cruel", "digno", "fuego", "globo", "hueso", "jaula", "karma", "limon",
  "mundo", "nieve", "opera", "piano", "queso", "rugby", "salsa", "temor", "unico", "valle",
  "yunke", "zonas", "abrir", "beber", "coser", "decir", "errar", "fugaz", "guiar", "helar",
  "islas", "joven", "koala", "lunar", "mango", "noble", "orden", "peces", "razon", "sanar",
  "aguas", "almas", "altar", "ambar", "amigo", "ancho", "angel", "apodo", "arbol", "aroma",
  "astro", "atomo", "audaz", "avion", "bahia", "bello", "besar", "bicho", "bravo", "brisa",
  "cable", "calle", "calor", "canal", "canto", "capaz", "cebra", "censo", "cerca", "cerro",
  "chico", "cifra", "cinta", "cisne", "clavo", "clima", "cobra", "cofre", "color", "coral",
  "crema", "cueva", "culpa", "dardo", "datos", "deuda", "dieta", "diosa", "droga", "ducha",
  "duelo", "dueto", "ebano", "epoca", "error", "espia", "exito", "extra", "firme", "flecha",
  "flora", "freno", "fruta", "furia", "gallo", "gemas", "genio", "golpe", "gorra", "grano",
  "grasa", "grifo", "grito", "grupo", "guapo", "gusto", "hacha", "hecho", "heroe", "hielo",
  "himno", "hogar", "hongo", "horno", "hotel", "humor", "hurto", "icono", "impar", "indio",
  "jabon", "jarra", "jefes", "joyas", "judio", "junta", "labio", "lapiz", "lente", "letra",
  "lienzo", "limite", "linea", "llave", "lluvia", "lucha", "magia", "maleta", "manto", "mapas",
  "marzo", "metal", "miedo", "milla", "mitad", "molde", "moral", "mosca", "motor", "mural",
  "museo", "nacer", "nadar", "nariz", "natal", "navio", "negar", "nicho", "nieve", "norte",
  "oasis", "ocaso", "odiar", "oeste", "olivo", "oruga", "oveja", "oxido", "padre", "palma",
  "papel", "parca", "parto", "pasar", "paseo", "pasta", "patio", "pausa", "pecho", "pelea",
  "pelos", "pensar", "perla", "pesca", "peste", "pieza", "pinar", "pinta", "pinza", "pluma"
].map((w) => normalize(w).slice(0, 5)).filter((w) => w.length === 5);

const renderWordle = (intentos) =>
  intentos.map((i) => i.map((l) => l.emoji).join("")).join("\n");

const evaluarIntento = (guess, target) => {
  const result = [],
    targetArr = target.split(""),
    guessArr = guess.split(""),
    used = Array(5).fill(false);

  for (let i = 0; i < 5; i++) {
    if (guessArr[i] === targetArr[i]) {
      result[i] = { letter: guessArr[i], emoji: "🟩", status: "correct" };
      used[i] = true;
    }
  }
  for (let i = 0; i < 5; i++) {
    if (result[i]) continue;
    const idx = targetArr.findIndex((c, j) => c === guessArr[i] && !used[j]);
    if (idx !== -1) {
      result[i] = { letter: guessArr[i], emoji: "🟨", status: "misplaced" };
      used[idx] = true;
    } else {
      result[i] = { letter: guessArr[i], emoji: "⬛", status: "absent" };
    }
  }
  return result;
};

// ── COMANDOS DE JUEGO ──

const cmdAhorcado = {
  command: ["ahorcado", "hangman", "ahorca"],
  category: "juegos",
  desc: "Juega al ahorcado visual adivinando una palabra secreta en español.",
  usage: "[apuesta]",
  cooldown: 3,
  run: async (client, m, args, usedPrefix) => {
    if (gameEngine.has(m.chat, "ahorcado")) {
      return m.reply(
        "🎮 Ya hay un juego de ahorcado activo en este chat.\n• Envía una letra directamente o usa `.guess <letra>`.\n• También puedes enviar la palabra completa."
      );
    }

    let apuesta = 150;
    if (args[0] && !isNaN(args[0])) {
      apuesta = Math.max(10, parseInt(args[0]));
    }
    const bet = gameEngine.validateBet(m.sender, apuesta);
    if (bet === false) {
      return m.reply(
        `❌ No tienes suficiente XP para esa apuesta. Tienes *${global.db.data.users[m.sender]?.exp || 0} XP*.`
      );
    }

    const palabraSecreta = obtenerPalabraAhorcado();
    const progreso = Array(palabraSecreta.length).fill("_");

    const visualGallows = renderGallows(0);

    const caption =
      `🎮 *¡EL AHORCADO INICIADO!* 🎮\n\n` +
      `\`\`\`\n${visualGallows}\n\`\`\`\n\n` +
      `📌 *Palabra:* \`${progreso.join(" ")}\` (${palabraSecreta.length} letras)\n` +
      `❤️ *Fallos:* 0/6\n` +
      `💰 *Apuesta:* ${bet} XP\n\n` +
      `👉 *¿Cómo jugar?*\n` +
      `• Escribe una letra en el chat (o usa \`${usedPrefix}guess <letra>\`)\n` +
      `• ¡O envía la palabra completa si ya la sabes (gana x3)!`;

    await client.sendMessage(m.chat, { text: caption }, { quoted: m });

    gameEngine.start(
      m.chat,
      "ahorcado",
      m.sender,
      {
        palabra: palabraSecreta,
        progreso,
        intentos: 0,
        letrasUsadas: [],
        maxIntentos: 6,
        apuesta: bet,
        jugador: m.sender,
      },
      {
        timeout: 240000,
        onTimeout: () => {
          const game = gameEngine.get(m.chat, "ahorcado");
          if (game) {
            gameEngine.loss(game.jugador);
            client
              .sendMessage(m.chat, {
                text: `⏰ *TIEMPO AGOTADO*\nEl juego de ahorcado finalizó.\nLa palabra secreta era: *${palabraSecreta}*`,
              })
              .catch(() => {});
          }
        },
      }
    );
  },
};

const cmdGuess = {
  command: ["guess", "g", "adivinar", "hm"],
  category: "juegos",
  desc: "Adivina una letra o la palabra completa en el Ahorcado activo.",
  usage: "<letra o palabra>",
  run: async (client, m, args) => {
    if (!gameEngine.has(m.chat, "ahorcado")) {
      return m.reply("❌ No hay ningún juego de ahorcado activo en este chat. Inicia uno con `.ahorcado`.");
    }
    if (!args[0]) {
      return m.reply("⚠️ Ingresa una letra o la palabra completa para adivinar. Ejemplo: `.guess A` o `.guess laberinto`.");
    }
    m.text = args.join(" ");
    await handleAhorcado(client, m);
  },
};

const cmdAdivinanza = {
  command: ["adivinanza", "acertijo"],
  category: "juegos",
  desc: "Resuelve un acertijo o adivinanza clásica de dificultad intermedia.",
  cooldown: 4,
  run: async (client, m) => {
    if (gameEngine.has(m.chat, "adivinanza")) {
      return m.reply("🧠 Ya hay una adivinanza activa en este chat. ¡Resuélvela primero!");
    }

    const item = BANCO_ADIVINANZAS[Math.floor(Math.random() * BANCO_ADIVINANZAS.length)];
    const recompensa = 350;

    const coreWord = cleanAnswer(item.a).split(/\s+/)[0] || item.a;
    const hintLetter = coreWord[0]?.toUpperCase() || "";
    const hintLen = coreWord.length;

    const caption =
      `🧠 *ACERTIJO & ADIVINANZA* 🧠\n\n` +
      `"${item.q}"\n\n` +
      `💡 *Pista:* Respuesta de ${hintLen} letras, empieza con "*${hintLetter}*"\n` +
      `⏳ *Tiempo:* 90 segundos\n` +
      `💰 *Premio:* ${recompensa} XP\n\n` +
      `_Escribe tu respuesta directamente en el chat._`;

    await client.sendMessage(m.chat, { text: caption }, { quoted: m });

    gameEngine.start(
      m.chat,
      "adivinanza",
      m.sender,
      {
        respuesta: item.a,
        alts: item.alts || [item.a],
        recompensa,
      },
      {
        timeout: 90000,
        onTimeout: () => {
          client
            .sendMessage(m.chat, {
              text: `⏰ *TIEMPO AGOTADO*\nNadie resolvió la adivinanza.\nLa respuesta correcta era: *${item.a}* 😅`,
            })
            .catch(() => {});
        },
      }
    );
  },
};

const cmdTrivia = {
  command: ["trivia", "triviatic"],
  category: "juegos",
  desc: "Trivia cultural y científica en español de respuesta libre.",
  cooldown: 4,
  run: async (client, m, args) => {
    if (gameEngine.has(m.chat, "trivia")) {
      return m.reply("🧠 Ya hay una trivia activa en este chat. ¡Responde la pregunta actual!");
    }

    let apuesta = 200;
    if (args[0] && !isNaN(args[0])) {
      apuesta = Math.max(10, parseInt(args[0]));
    }
    const bet = gameEngine.validateBet(m.sender, apuesta);
    if (bet === false) {
      return m.reply(
        `❌ No tienes suficiente XP para esa apuesta. Tienes *${global.db.data.users[m.sender]?.exp || 0} XP*.`
      );
    }

    const item = BANCO_TRIVIA[Math.floor(Math.random() * BANCO_TRIVIA.length)];
    const pText = item.p;
    const rText = item.r;
    const alts = item.alts || [item.r];

    const cleanR = cleanAnswer(rText);
    const hint =
      cleanR.length > 2
        ? `💡 Pista: Empieza por "*${cleanR[0].toUpperCase()}*" y tiene ${cleanR.replace(/\s/g, "").length} letras.`
        : "";

    const text =
      `┌───「 🧠 *TRIVIA GENERAL* 🧠 」───┐\n` +
      `│ *Pregunta:* ${pText}\n` +
      `│\n` +
      (hint ? `│ ${hint}\n` : "") +
      `│ 💰 *Apuesta:* ${bet} XP\n` +
      `│ ⏳ Tienes *45 segundos* para responder.\n` +
      `└────────────────────────┘`;

    await client.sendMessage(m.chat, { text }, { quoted: m });

    gameEngine.start(
      m.chat,
      "trivia",
      m.sender,
      {
        answer: rText,
        alts,
        apuesta: bet,
      },
      {
        timeout: 45000,
        onTimeout: () => {
          client
            .sendMessage(m.chat, {
              text: `┌───「 ⏳ *TIEMPO AGOTADO* ⏳ 」───┐\n│ Nadie respondió a tiempo.\n│ La respuesta correcta era: *${rText}*\n└──────────────────────────┘`,
            })
            .catch(() => {});
        },
      }
    );
  },
};

const cmdWordle = {
  command: ["wordle"],
  category: "juegos",
  desc: "Juega al Wordle: adivina la palabra de 5 letras en 6 intentos.",
  usage: "[apuesta]",
  cooldown: 4,
  run: async (client, m, args) => {
    if (gameEngine.has(m.chat, "wordle")) {
      return m.reply("🎮 Ya hay un Wordle activo en este chat. ¡Envía tu palabra de 5 letras!");
    }

    let apuesta = 250;
    if (args[0] && !isNaN(args[0])) {
      apuesta = Math.max(10, parseInt(args[0]));
    }
    const bet = gameEngine.validateBet(m.sender, apuesta);
    if (bet === false) {
      return m.reply(
        `❌ No tienes suficiente XP. Tienes *${global.db.data.users[m.sender]?.exp || 0} XP*.`
      );
    }

    const palabra = PALABRAS_WORDLE[Math.floor(Math.random() * PALABRAS_WORDLE.length)].toUpperCase();

    const text =
      `🟩🟨⬛ *W O R D L E* ⬛🟨🟩\n\n` +
      `Adivina la palabra de *5 letras* en *6 intentos*.\n\n` +
      `🟩 = Letra correcta en su posición\n` +
      `🟨 = Letra en la palabra pero en otra posición\n` +
      `⬛ = Letra ausente\n\n` +
      `💰 *Apuesta:* ${bet} XP\n` +
      `⏳ Tienes *5 minutos*.\n\n` +
      `*Escribe una palabra de 5 letras para comenzar.*`;

    await client.sendMessage(m.chat, { text }, { quoted: m });

    gameEngine.start(
      m.chat,
      "wordle",
      m.sender,
      {
        palabra,
        intentos: [],
        maxIntentos: 6,
        apuesta: bet,
        jugador: m.sender,
      },
      {
        timeout: 300000,
        onTimeout: () =>
          client
            .sendMessage(m.chat, {
              text: `⏰ *TIEMPO AGOTADO*\nEl Wordle terminó. La palabra era: *${palabra}*`,
            })
            .catch(() => {}),
      }
    );
  },
};

// ── HANDLERS INTERCEPTORES ──

async function handleAhorcado(client, m) {
  const game = gameEngine.get(m.chat, "ahorcado");
  if (!game) return false;

  const raw = m.text.trim();
  const text = normalize(raw).toUpperCase();
  if (!text || !/^[A-ZÑ]+$/.test(text)) return false;

  // Intento de adivinar palabra completa
  if (text.length > 1) {
    const targetNorm = normalize(game.palabra).toUpperCase();
    if (text === targetNorm) {
      gameEngine.end(m.chat, "ahorcado");
      const ganancia = game.apuesta * 3;
      gameEngine.reward(m.sender, { xp: ganancia, win: true });
      await client.sendMessage(
        m.chat,
        {
          text:
            `🎉 *¡INCREÍBLE ACIERTO!* 🎉\n\n` +
            `@${m.sender.split("@")[0]} adivinó la palabra completa de golpe:\n` +
            `👉 *${game.palabra}*\n\n` +
            `🎁 ¡Ganaste el bono supremo de *${ganancia} XP* (x3)!`,
          mentions: [m.sender],
        },
        { quoted: m }
      );
      return true;
    } else {
      game.intentos++;
      const gallows = renderGallows(game.intentos);
      if (game.intentos >= game.maxIntentos) {
        gameEngine.end(m.chat, "ahorcado");
        gameEngine.loss(m.sender);
        await client.sendMessage(
          m.chat,
          {
            text:
              `💀 *¡ESTÁS AHORCADO!* 💀\n\n` +
              `\`\`\`\n${gallows}\n\`\`\`\n\n` +
              `Perdiste tu apuesta. La palabra secreta era: *${game.palabra}*`,
          },
          { quoted: m }
        );
        return true;
      }
      await client.sendMessage(
        m.chat,
        {
          text:
            `❌ *${raw.toUpperCase()}* no es la palabra secreta. (+1 fallo)\n\n` +
            `\`\`\`\n${gallows}\n\`\`\`\n` +
            `❤️ Fallos: ${game.intentos}/${game.maxIntentos}`,
        },
        { quoted: m }
      );
      return true;
    }
  }

  // Intento de una sola letra
  const letra = text;
  if (game.letrasUsadas.includes(letra)) {
    await client.sendMessage(
      m.chat,
      { text: `⚠️ Ya intentaste la letra *${letra}*. Prueba con otra.` },
      { quoted: m }
    );
    return true;
  }

  game.letrasUsadas.push(letra);
  let acierto = false;

  // Compara letra normalizada para acertar vocales con y sin tilde
  for (let i = 0; i < game.palabra.length; i++) {
    if (normalizeChar(game.palabra[i]) === letra) {
      game.progreso[i] = game.palabra[i];
      acierto = true;
    }
  }

  if (!acierto) {
    game.intentos++;
  }

  const gallows = renderGallows(game.intentos);

  // Derrota
  if (game.intentos >= game.maxIntentos) {
    gameEngine.end(m.chat, "ahorcado");
    gameEngine.loss(m.sender);
    await client.sendMessage(
      m.chat,
      {
        text:
          `💀 *¡ESTÁS AHORCADO!* 💀\n\n` +
          `\`\`\`\n${gallows}\n\`\`\`\n\n` +
          `Palabra completa: *${game.palabra}*\n` +
          `❌ Has perdido tu apuesta de ${game.apuesta} XP.`,
      },
      { quoted: m }
    );
    return true;
  }

  // Victoria
  if (!game.progreso.includes("_")) {
    gameEngine.end(m.chat, "ahorcado");
    const ganancia = game.apuesta * 2;
    gameEngine.reward(m.sender, { xp: ganancia, win: true });
    await client.sendMessage(
      m.chat,
      {
        text:
          `🎉 *¡F E L I C I D A D E S!* 🎉\n\n` +
          `@${m.sender.split("@")[0]} completó la palabra con éxito:\n` +
          `👉 *${game.palabra}*\n\n` +
          `💰 Ganaste *+${ganancia} XP*`,
        mentions: [m.sender],
      },
      { quoted: m }
    );
    return true;
  }

  // Progreso continuo
  const msg =
    `🎮 *EL AHORCADO* 🎮\n\n` +
    `\`\`\`\n${gallows}\n\`\`\`\n\n` +
    `📌 *Progreso:* \`${game.progreso.join(" ")}\`\n` +
    `🔤 *Letras usadas:* ${game.letrasUsadas.join(", ")}\n` +
    `❤️ *Fallos:* ${game.intentos}/${game.maxIntentos}`;

  await client.sendMessage(m.chat, { text: msg }, { quoted: m });
  return true;
}

async function handleAdivinanza(client, m) {
  const game = gameEngine.get(m.chat, "adivinanza");
  if (!game) return false;

  const userClean = cleanAnswer(m.text);
  const correctClean = cleanAnswer(game.respuesta);

  let acierto = false;

  // Comparación directa exacta sin artículos
  if (userClean === correctClean) {
    acierto = true;
  } else if (game.alts && Array.isArray(game.alts)) {
    // Comprueba sinónimos o alternativas registradas
    acierto = game.alts.some((alt) => {
      const altClean = cleanAnswer(alt);
      return userClean === altClean || (userClean.length >= 4 && altClean.includes(userClean));
    });
  }

  if (acierto) {
    gameEngine.end(m.chat, "adivinanza");
    const premio = game.recompensa || 350;
    gameEngine.reward(m.sender, { xp: premio, win: true });

    await client.sendMessage(
      m.chat,
      {
        text:
          `🎉 *¡ACERTASTE!* 🎉\n\n` +
          `¡Enhorabuena @${m.sender.split("@")[0]}!\n` +
          `La respuesta correcta era: *${game.respuesta}*\n` +
          `💰 Has ganado *+${premio} XP*`,
        mentions: [m.sender],
      },
      { quoted: m }
    );
    return true;
  }

  return false;
}

async function handleTrivia(client, m) {
  const juego = gameEngine.get(m.chat, "trivia");
  if (!juego) return false;

  const userClean = cleanAnswer(m.text);
  const answerClean = cleanAnswer(juego.answer);

  let acierto = userClean === answerClean;

  if (!acierto && juego.alts && Array.isArray(juego.alts)) {
    acierto = juego.alts.some((alt) => {
      const altClean = cleanAnswer(alt);
      return (
        userClean === altClean ||
        (altClean.length >= 4 && userClean.includes(altClean)) ||
        (userClean.length >= 4 && altClean.includes(userClean))
      );
    });
  }

  if (acierto) {
    gameEngine.end(m.chat, "trivia");
    const ganancia = juego.apuesta * 2;

    if (m.sender !== juego.sender) {
      gameEngine.refundBet(juego.sender, juego.apuesta);
    }

    let multiplier = 1;
    const user = global.db.data.users[m.sender];
    if (user?.triviaBuff && user.triviaBuff.expiresAt > Date.now()) {
      multiplier += user.triviaBuff.value;
    }

    gameEngine.reward(m.sender, { xp: ganancia, win: true, multiplier });

    await client.sendMessage(
      m.chat,
      {
        text:
          `┌───「 🎉 *¡CORRECTO!* 🎉 」───┐\n` +
          `│ ¡Felicidades @${m.sender.split("@")[0]}!\n` +
          `│ Respuesta: *${juego.answer}*\n` +
          `│ 💰 Ganaste *${ganancia} XP*\n` +
          `└───────────────────────┘`,
        mentions: [m.sender],
      },
      { quoted: m }
    );
    return true;
  }
  return false;
}

async function handleWordle(client, m) {
  const game = gameEngine.get(m.chat, "wordle");
  if (!game) return false;

  const text = normalize(m.text).toUpperCase();
  if (!/^[A-ZÑ]{5}$/.test(text)) return false;

  const resultado = evaluarIntento(text, game.palabra);
  game.intentos.push(resultado);

  if (text === game.palabra) {
    gameEngine.end(m.chat, "wordle");
    const mult = Math.max(1, 7 - game.intentos.length);
    const ganancia = game.apuesta * mult;
    gameEngine.reward(m.sender, { xp: ganancia, win: true });
    await client.sendMessage(
      m.chat,
      {
        text:
          `🟩🟩🟩🟩🟩 *¡CORRECTO!* 🎉\n\n` +
          `${renderWordle(game.intentos)}\n\n` +
          `Palabra secreta: *${game.palabra}*\n` +
          `Intentos: ${game.intentos.length}/6\n` +
          `💰 Ganaste *${ganancia} XP* (x${mult})`,
      },
      { quoted: m }
    );
    return true;
  }

  if (game.intentos.length >= game.maxIntentos) {
    gameEngine.end(m.chat, "wordle");
    gameEngine.loss(m.sender);
    await client.sendMessage(
      m.chat,
      {
        text:
          `💀 *¡GAME OVER!* 💀\n\n` +
          `${renderWordle(game.intentos)}\n\n` +
          `La palabra secreta era: *${game.palabra}*\n` +
          `Intentos agotados: 6/6`,
      },
      { quoted: m }
    );
    return true;
  }

  await client.sendMessage(
    m.chat,
    {
      text:
        `🟩🟨⬛ *W O R D L E* ⬛🟨🟩\n\n` +
        `${renderWordle(game.intentos)}\n\n` +
        `Intentos: ${game.intentos.length}/${game.maxIntentos}`,
    },
    { quoted: m }
  );
  return true;
}

export const before = async (client, m) => {
  if (!m.text) return false;

  if (gameEngine.has(m.chat, "ahorcado")) {
    return await handleAhorcado(client, m);
  }
  if (gameEngine.has(m.chat, "adivinanza")) {
    return await handleAdivinanza(client, m);
  }
  if (gameEngine.has(m.chat, "trivia")) {
    return await handleTrivia(client, m);
  }
  if (gameEngine.has(m.chat, "wordle")) {
    return await handleWordle(client, m);
  }

  return false;
};

export default [cmdAhorcado, cmdGuess, cmdAdivinanza, cmdTrivia, cmdWordle];
