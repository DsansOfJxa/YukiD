<div align="center">

# ✦ BOT — High-Performance WhatsApp Bot ✦

**Framework de Bot de WhatsApp de Alta Velocidad · Motor SQLite WAL · Baileys Multi-Device · Pure ESM**

[![Termux Ready](https://img.shields.io/badge/Optimized_for-Termux-7e57c2?style=for-the-badge&logo=android)](https://termux.com/)
[![Baileys](https://img.shields.io/badge/Powered_by-Baileys_MD-25D366?style=for-the-badge&logo=whatsapp)](https://github.com/WhiskeySockets/Baileys)
[![NodeJS](https://img.shields.io/badge/Node.js-%3E%3D22.5.0-43853D?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/Database-SQLite_WAL-003B57?style=for-the-badge&logo=sqlite)](https://www.sqlite.org/)
[![Quotly](https://img.shields.io/badge/Stickers-Telegram_Quotly-0088cc?style=for-the-badge&logo=telegram)](https://telegram.org/)
[![Status](https://img.shields.io/badge/Build-Passing-brightgreen?style=for-the-badge)](https://github.com/)

*BOT es una plataforma modular de WhatsApp optimizada para máximo rendimiento en Termux (Android) y servidores Linux/VPS de bajos recursos. Integra base de datos transaccional SQLite con modo WAL, auto-recuperación de llaves criptográficas Signal, motor híbrido de reacciones con soporte dinámico de PushName, suite completa de minijuegos interactivos, economía RPG persistente, herramientas académicas asistidas por IA y moderación grupal de alto nivel.*

</div>

---

## ⚡ Arquitectura del Proyecto

```
BOT-main/
├── index.js              # Arranque del bot, Baileys socket, sincronización SQLite y auto-reconexión
├── main.js               # Enrutador principal, contexto DbSession y pipeline de middlewares
├── config.js             # Parámetros globales, credenciales de APIs, tokens y propietarios
├── package.json          # Manifiesto de dependencias, scripts de ejecución y configuración ESM
├── core/
│   ├── message.js        # Serializador smsg, decorador de socket, decodificación JID y utilidades
│   ├── utils.js          # Resolución bidireccional y almacenamiento en caché de LIDs a números reales
│   ├── exif.js           # Conversor multimedia con FFmpeg y generador de metadatos EXIF WebP
│   └── system/
│       ├── commandLoader.js   # Registro dinámico, carga diferida y recarga en caliente de plugins
│       ├── database.js        # Driver nativo node:sqlite con Unit of Work, WAL y auto-migración
│       ├── initDB.js          # Definiciones y esquemas por defecto para usuarios, chats y ajustes
│       ├── middleware.js      # Cadena de ejecución: permisos, antispam, cooldowns y cola multimedia
│       ├── antilink.js        # Detección y moderación reactiva contra enlaces no autorizados
│       ├── antistatus.js      # Bloqueo y protección ante spam por menciones masivas de estado
│       └── events.js          # Manejador de eventos de grupo (bienvenidas, despedidas y ascensos)
├── cmds/
│   ├── academia/         # Herramientas de estudio, análisis visual con IA, citas APA y Biblia
│   ├── downloads/        # Descarga de medios (YouTube, TikTok, Instagram, Facebook, Pinterest, X)
│   ├── economia/         # Sistema RPG, banco, bolsa de trabajo, tienda, títulos e inventario
│   ├── group/            # Moderación, banners de grupo, sanciones, bienvenida y administración
│   ├── herramientas/     # Utilidades: IA, ViewOnce (.read), OCR, Remini HD, Shazam, Voice Changer y traductores
│   ├── juegos/           # Minijuegos interactivos (Ahorcado 2.0, TicTacToe, Conecta 4, Blackjack, Wordle)
│   ├── main/             # Menú (.menu), monitor del sistema (.botstats), ping y reportes
│   ├── owner/            # Comandos de mantenimiento, reinicio, actualización y ejecución
│   ├── profile/          # Perfiles de usuario, Player Card (.card), fotos HD (.getpic), matrimonio y nivelación
│   ├── reactions/        # Motor de 60+ reacciones animadas con detección de PushName y género
│   └── stickers/         # Creación de stickers, Telegram Quotly (.q / .qr), Brat y EmojiMix
└── utils/
    ├── ai.js             # Cliente multi-proveedor de IA con cadena de respaldo automático
    ├── gameEngine.js     # Gestor en memoria de partidas multijugador concurrentes
    ├── levelHook.js      # Cálculo defensivo de experiencia y subida automática de rango
    ├── logger.js         # Logger con colores ANSI y escritura segura a disco protegida contra caídas
    ├── mediaQueue.js     # Cola secuencial para balancear operaciones pesadas de conversión
    └── tools.js          # Formateadores numéricos, temporales, extractores y caché local de grupos
```

---

## 🔧 Optimizaciones y Tecnologías Core

| Tecnología | Descripción e Impacto |
|:---|:---|
| **Base de Datos SQLite (WAL)** | Persistencia ultrarrápida impulsada por el módulo nativo `node:sqlite` configurado en `PRAGMA journal_mode = WAL`. Todas las operaciones de lectura y escritura se gestionan mediante sesiones transaccionales (`DbSession`) sin bloquear el hilo principal de Node.js. |
| **Signal Keystore Auto-Repair** | Envoltorio bidireccional sobre `makeCacheableSignalKeyStore` que rehidrata estructuras JSON a objetos `Buffer` nativos en tiempo de ejecución, eliminando fallos criptográficos (`Expected Buffer instead of: Object`). |
| **Purga Inteligente de Sesión** | Rutina de saneamiento en arranque (`purgeSenderKeys`) para reiniciar llaves de difusión obsoletas sin comprometer la identidad de la sesión (`creds.json`), mitigando errores de descifrado en grupos concurridos. |
| **Carga Idempotente de Comandos** | Registro diferido con caché de promesas en `main.js` y `commandLoader.js`, evitando lecturas repetidas de disco y eliminando la doble carga de módulos al iniciar. |
| **Descargas Pre-bufferizadas** | Descarga y validación en memoria (`Buffer`) antes del envío a WhatsApp para prevenir caídas de stream y bloqueos de CDN (`.play`, `.play2`, `.ig`, `.tt`, `.fb`, `.pin`, `.x`). |
| **Recuperador ViewOnce (.read)** | Descifrado de mensajes de vista única conectando la petición con el almacén circular acotado (`msgStore`) para recuperar la `mediaKey` original sin almacenar archivos pesados permanentemente. |
| **Gestión Automática de Temporales** | Limpieza periódica en segundo plano que elimina archivos expirados de `./tmp` con más de 10 minutos de antigüedad y libera espacio de sincronización de forma segura. |

---

## ✨ Módulos y Funcionalidades Destacadas

### 📥 Descargas Multimedia
- **YouTube (`.play` / `.play2` / `.mp3` / `.mp4`)**: Búsqueda interactiva y descarga de audio y video en alta calidad con multi-proveedor y fallback automático.
- **TikTok sin Marca de Agua (`.tt` / `.tiktok`)**: Extracción de videos limpios en formato MP4.
- **Instagram (`.ig` / `.reels`)**: Descarga directa de Reels, publicaciones individuales y galerías tipo carrusel.
- **Facebook (`.fb` / `.fbsearch`)**: Descarga de videos y Reels de Facebook, junto con búsqueda de contenido público.
- **Pinterest (`.pin`)**: Obtención de imágenes en alta resolución y videos de pines.
- **Twitter / X (`.twitter` / `.x`)**: Descarga de clips y videos de tweets.
- **Google Images (`.img`)**: Búsqueda y envío instantáneo de imágenes.

### 🎨 Stickers & Citas Personalizadas
- **Stickers Básicos (`.s`)**: Conversión de imágenes, videos y GIFs a stickers WebP con metadatos EXIF personalizados que reconocen el `pushName` del creador.
- **Citas Telegram (`.q` / `.qr`)**: Generación de stickers de citas estilo Telegram con dimensionamiento inteligente de texto y soporte para modo respuesta (`.q reply` / `.qr`).
- **Citas Múltiples (`.q2` a `.q10`)**: Conversión de conversaciones continuas citando hasta 10 mensajes.
- **Stickers Brat (`.brat` / `.bratv`)**: Estilo visual Brat en versiones estática y animada.
- **EmojiMix (`.emojimix` / `.mix`)**: Fusión de dos emojis en un único sticker estilizado.
- **Burbuja de Chat (`.qc`)**: Generación de burbujas de diálogo personalizadas.
- **Descarga de Packs (`.getpack`)**: Importación de packs completos de stickers desde enlaces de WhatsApp.

### 🛠️ Herramientas & Multimedia
- **Asistente Inteligente (`.ia`)**: Conversación y consultas impulsadas por modelos de lenguaje (ChatGPT/Gemini).
- **Desbloqueador ViewOnce (`.read` / `.vv`)**: Recuperación de fotos, videos y notas de voz de visualización única.
- **OCR (`.ocr`)**: Extracción de texto a partir de imágenes enviadas o citadas.
- **Mejora Visual HD (`.hd`)**: Aumento de definición y escalado de imágenes.
- **Conversión a Imagen (`.toimg`)**: Transforma cualquier sticker en imagen PNG/JPG.
- **Subida a la Nube (`.tourl`)**: Sube imágenes y archivos para generar un enlace web directo.
- **Reconocimiento Musical (`.music` / `.shazam`)**: Identificación de canciones desde notas de voz o videos con ACRCloud.
- **Modulador de Voz / Voice Changer (`.vc` / `.voicechanger`)**: Modula la voz de audios y notas de voz con más de 10 filtros nativos (`.bass`, `.nightcore`, `.robot`, `.ardilla`, `.deep`, `.lento`, `.rapido`, `.reverse`, `.distorsion`, `.bajoagua`, `.eco`, `.vibra`).
- **Utilidades de Red**: Clima en tiempo real (`.clima`), acortador de enlaces (`.tiny`), traducción multilingüe (`.tr`), generador de códigos QR (`.qr`), recordatorios (`.rec`) e inspección de grupos (`.inspect`).

### 🎓 Academia Asistida por IA & Biblia
- **Generación Visual (`.imagine` / `.dibujar`)**: Creación de imágenes artísticas a partir de texto con IA.
- **Análisis de Ejercicios (`.vis`)**: Explicación y resolución de problemas a partir de capturas de fotos o apuntes.
- **Lector de PDFs (`.pdf`)**: Extracción y análisis de documentos PDF.
- **Resolución Matemática (`.solve`)**: Desarrollo paso a paso de operaciones y ecuaciones.
- **Optimización de Texto**: Resumen (`.res`), corrección gramatical (`.corr`), humanización y paráfrasis (`.hum` / `.parf`).
- **Citas APA 7ma (`.apa`)**: Formateo automático de referencias bibliográficas.
- **Consultas Académicas**: Wikipedia (`.wiki`), Diccionario RAE (`.def`), frases motivacionales (`.frase`) y sorteos (`.ruleta`).
- **Detectores**: Detección de texto sintético (`.detia`) y escaneo de plagio (`.plagio`).
- **Biblia Automática (`.bible`)**: Detección automática en el chat de referencias como `Juan 3:16` o `Salmos 23` con versiones fieles en español (NBLA y LBLA).

### 👥 Administración Grupal & Moderación
- **Información del Grupo (`.gp`)**: Ficha detallada de miembros, ajustes y enlaces.
- **Control de Actividad**: Pausa del bot (`.bot`), apertura y cierre de chat (`.open` / `.close`), modo exclusivo para administradores (`.adminonly`).
- **Gestión de Miembros**: Promoción (`.promote`), degradación (`.demote`) y expulsión (`.kick`).
- **Sistema de Advertencias (`.warn` / `.delwarn` / `.warns` / `.setwarnlimit`)**: Sanciones progresivas con auto-expulsión al alcanzar el límite.
- **Filtros de Seguridad**: Anti-Link (bloqueo automático de enlaces) y Anti-Status (protección contra spam de estados).
- **Personalización Grupal**: Modificación de nombre (`.setgpname`), descripción (`.setgpdesc`), foto de perfil (`.setgpbanner`), y avisos automáticos configurables de bienvenida y despedida (`.welcome` / `.goodbye`).

### 👤 Perfil, Nivelación y Parejas
- **Ficha de Perfil (`.profile`)**: Muestra nivel, experiencia, monedas, títulos, pasatiempo, biografía y estado civil.
- **Tarjeta Gamer de Jugador (`.card` / `.tarjeta` / `.playercard`)**: Genera una tarjeta visual personalizada con Jimp mostrando avatar circular con aura, barra dinámica de salud (HP), barra de experiencia (XP), puesto en el ranking global, fortuna acumulada y récord de minijuegos.
- **Foto de Perfil HD (`.getpic`)**: Descarga la foto de perfil en máxima resolución de cualquier usuario o grupo.
- **Personalización**: Ajuste de descripción (`.setdesc`), género (`.setgenre`), pasatiempo (`.sethobby`), fecha de cumpleaños (`.setbirth`) y eliminación selectiva (`.deldesc`, `.delgenre`, etc.).
- **Sistema de Matrimonio**: Propuesta de casamiento (`.marry`), divorcio (`.divorce`) y acciones de pareja (`.cita`, `.mimos`, `.regalo`).
- **Nivel y Rangos (`.level` / `.lboard`)**: Sistema progresivo de experiencia con tabla de clasificación global.

### 💰 Economía RPG & Aventuras
- **Ingresos y Empleos**: Recompensas periódicas (`.daily`, `.weekly`, `.monthly`), trabajos activos (`.work`, `.mine`, `.hunt`, `.fish`) y retos matemáticos pagados (`.math`).
- **Banca y Finanzas**: Consulta de saldo (`.balance`), depósitos (`.deposit`), retiros (`.withdraw`), transferencias seguras (`.givecoins`) y tabla de líderes millonarios (`.economyboard`).
- **Casino y Apuestas**: Tragamonedas (`.slots`), ruleta (`.roulette`), casino clásico (`.casino`) y cara o cruz (`.cf`).
- **Acciones de Riesgo**: Robo a otros usuarios (`.steal`), crímenes (`.crime`) y prostitución ficticia (`.slut`).
- **Tienda y RPG**: Compra de ítems (`.shop` / `.buy`), uso y curación (`.use` / `.heal`), inventario (`.inventory`), trueque de objetos (`.trade`) y títulos con buffs pasivos (`.settitle`).
- **Mazmorras y Jefes**: Expediciones de aventura (`.adventure`), exploración de mazmorras (`.dungeon`), incursiones cooperativas contra jefes (`.raid`), rituales espirituales (`.ritual`) y medallas de logros (`.logros`).

### 🎮 Entretenimiento & Minijuegos
- **Ahorcado Visual 2.0 (`.ahorcado` / `.guess`)**: Ahorcado gráfico con vocabulario en español y seguimiento de letras utilizadas.
- **Tres en Raya HD (`.tictactoe` / `.ttt`)**: Tablero interactivo para 2 jugadores con coordenadas numeradas.
- **Conecta 4 (`.connect4` / `.c4`)**: Partidas estratégicas en cuadrícula de 7x6 columnas.
- **Blackjack 21 (`.blackjack` / `.bj`)**: Juego de cartas contra la banca con sistema de apuestas y cobro automático.
- **Wordle (`.wordle`)**: Adivina la palabra de 5 letras con pistas de color.
- **Juegos Rápidos**: Trivia de preguntas (`.trivia`), piedra, papel o tijeras (`.ppt`), adivinanzas con pistas (`.adivinanza`) y lanzamiento de dados (`.dado`).
- **Gestión de Partidas**: Ranking de jugadores (`.gameboard`), estadísticas (`.gamestats`) y cancelación de juegos activos (`.delgame`).

### 🎭 Reacciones Animadas
- **60+ Interacciones con Video/GIF**: Integración híbrida de Giphy y Stellar para enviar reacciones dinámicas citando a otros usuarios (`.abrazar`, `.besar`, `.golpear`, `.llorar`, `.bailar`, `.pat`, `.enojado`, `.dormir`, etc.), reconociendo automáticamente el género y nombre visible (`pushName`) de ambos participantes.

---

## 🚀 Instalación y Despliegue

### Requisitos Previos
- **Node.js >= 22.5.0** (Indispensable para el soporte nativo de `node:sqlite`).
- **FFmpeg** instalado en el sistema operativo.

### Instalación en Termux (Android)
```bash
# 1. Actualizar paquetes y conceder permisos de almacenamiento
termux-setup-storage
apt update && apt upgrade -y
pkg install -y git nodejs ffmpeg

# 2. Clonar o descomprimir el repositorio
git clone https://github.com/ocrespof/BOT.git
cd BOT

# 3. Instalar dependencias
npm install

# 4. Iniciar el bot (vincular mediante código de 8 dígitos o QR)
npm start
```

### Despliegue 24/7 en VPS / Servidores (PM2)
```bash
# 1. Instalar PM2 de forma global
npm i -g pm2

# 2. Ejecutar con reinicio automático y límite de memoria seguro
pm2 start index.js --name "BOT" --max-memory-restart 400M

# 3. Guardar la configuración para reinicios del servidor
pm2 save
```

### Comandos Útiles de Mantenimiento
```bash
pm2 logs BOT      # Inspeccionar logs en vivo
pm2 restart BOT   # Reiniciar el proceso
pm2 stop BOT      # Detener el bot
```

---

<div align="center">

*BOT — Desarrollado para ofrecer máxima estabilidad, velocidad de respuesta y modularidad en WhatsApp.*

</div>
