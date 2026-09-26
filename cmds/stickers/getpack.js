import fs from 'fs';

export default {
  command: ['getpack', 'pack', 'stickerpack'],
  category: 'stickers',
  run: async (client, m, args, usedPrefix, command) => {
    try {
      if (!args.length) {
        return m.reply('Especifica el nombre del paquete de stickers.')
      }
      const inputStr = args.join(' ').trim()
      const db = global.db.data
      if (!db.stickerspack) db.stickerspack = {}

      let pack = null
      let packOwner = m.sender

      if (inputStr.match(/^https?:\/\//)) {
        try {
          await m.reply('Descargando stickers del enlace, por favor espera...')
          const axios = (await import('axios')).default
          
          let packName = 'Sticker Pack'
          let imageUrls = []

          if (inputStr.includes('t.me/addstickers/')) {
            try {
               const res = await axios.get(`https://api.ryzendesu.vip/api/downloader/telesticker?url=${encodeURIComponent(inputStr)}`)
               if (res.data?.data) {
                  imageUrls = res.data.data.map(i => i.url || i)
               } else {
                  const res2 = await axios.get(`https://api.agatz.xyz/api/telesticker?url=${encodeURIComponent(inputStr)}`)
                  if (res2.data?.data) imageUrls = res2.data.data.map(i => i.url || i)
               }
               packName = inputStr.split('/').pop().replace(/_/g, ' ')
            } catch (err) {
               console.error("Telesticker Error:", err)
            }
          } else {
            const { data: html } = await axios.get(inputStr, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
              }
            })
            
            const titleMatch = html.match(/<title>([^<]+)<\/title>/i) || html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
            if (titleMatch) packName = titleMatch[1].trim().replace(/\s+/g, ' ')

            const imageRegexes = [
              /data-src-large="([^"]+)"/g,
              /src="([^"]+\.(?:webp|png)[^"]*)"/gi,
              /"(https?:\/\/[^"]+\.(?:webp|png)[^"]*)"/gi
            ]
            
            for (const regex of imageRegexes) {
              let match
              while ((match = regex.exec(html)) !== null) {
                let imgUrl = match[1]
                if (imgUrl.length > 500) continue
                if (!imgUrl.startsWith('http')) {
                  if (imgUrl.startsWith('//')) imgUrl = 'https:' + imgUrl
                  else if (imgUrl.startsWith('/')) {
                    try {
                      const urlObj = new URL(inputStr)
                      imgUrl = urlObj.origin + imgUrl
                    } catch { continue }
                  } else {
                    continue
                  }
                }
                if (!imageUrls.includes(imgUrl) && (imgUrl.includes('sticker') || imgUrl.match(/\.(webp|png)/i))) {
                  imageUrls.push(imgUrl)
                }
              }
            }
          }

          if (imageUrls.length === 0) {
            return m.reply('No se encontraron stickers en el enlace proporcionado.')
          }
          
          const selectedUrls = imageUrls.slice(0, 50)
          const validStickerBufs = []
          
          // Process in chunks of 5 to avoid overwhelming network but drastically speed up download
          const chunkArray = (arr, size) => arr.length > 0 ? [arr.slice(0, size), ...chunkArray(arr.slice(size), size)] : [];
          const urlChunks = chunkArray(selectedUrls, 5);
          
          for (const chunk of urlChunks) {
            const chunkPromises = chunk.map(async (url) => {
              try {
                const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 5000 });
                let buf = Buffer.from(res.data);
                if (!url.toLowerCase().endsWith('.webp')) {
                  try {
                    const { default: exif } = await import('../../core/exif.js');
                    buf = await exif.imageToWebp(buf);
                  } catch (e) {}
                }
                return buf;
              } catch (e) {
                return null;
              }
            });
            
            const results = await Promise.all(chunkPromises);
            validStickerBufs.push(...results.filter(Boolean));
          }
          
          if (validStickerBufs.length === 0) {
            return m.reply('No se pudieron descargar los stickers del enlace.')
          }

          pack = {
            name: packName,
            desc: `Descargado de ${new URL(inputStr).hostname}`,
            author: 'YukiBot',
            stickers: validStickerBufs
          }
        } catch (e) {
          return m.reply('Hubo un error al procesar el enlace. ' + e.message)
        }
      } else {
        const packName = inputStr.toLowerCase()
        const myPacks = db.stickerspack[m.sender]?.packs || []
        pack = myPacks.find(p => p.name.toLowerCase() === packName)

        if (!pack) {
          for (const [userId, userData] of Object.entries(db.stickerspack)) {
            const userPacks = userData.packs || []
            const publicPack = userPacks.find(p => p.name.toLowerCase() === packName && p.spackpublic === 1)
            if (publicPack) {
              pack = publicPack
              packOwner = userId
              break
            }
          }
        }
      }

      if (!pack) {
        return m.reply('No se encontró un paquete con ese nombre.')
      }
      if (!Array.isArray(pack.stickers) || pack.stickers.length < 4) {
        return m.reply(`El paquete \`${pack.name}\` no tiene suficientes stickers.`)
      }
      const validStickers = pack.stickers.map(s => {
        if (Buffer.isBuffer(s)) return s;
        try {
          return Buffer.from(s, 'base64')
        } catch {
          return null
        }
      }).filter(s => s && Buffer.isBuffer(s) && s.length > 0)

      if (validStickers.length < 4) {
        return m.reply('Algunos stickers están corruptos.')
      }

      const MAX_STICKERS = 50
      const selected = validStickers.slice(0, MAX_STICKERS)
      const cover = selected[0]

      const packOwnerUser = db.users[packOwner] || {};
      const pushName = (packOwner === m.sender && m.pushName?.trim()) || packOwnerUser.name || packOwner.split('@')[0];
      const ownerMeta1 = packOwnerUser?.metadatos ? String(packOwnerUser.metadatos).trim() : '';
      const ownerMeta2 = packOwnerUser?.metadatos2 ? String(packOwnerUser.metadatos2).trim() : '';
      const stickerPackname = ownerMeta1 ? ownerMeta1 : pack.name;
      const stickerAuthor = ownerMeta1 ? (ownerMeta2 ? ownerMeta2 : '') : (pushName.startsWith('@') ? pushName : `@${pushName}`);

      const webp = await import('node-webpmux')
      const stickerResults = await Promise.all(selected.map(async (buffer) => {
        try {
          const img = new webp.default.Image()
          await img.load(buffer)
          const json = { 'sticker-pack-id': 'https://github.com/iamDestroy/YukiBot-MD', 'sticker-pack-name': stickerPackname, 'sticker-pack-publisher': stickerAuthor, emojis: ['🎭'] }
          const exifAttr = Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00])
          const jsonBuff = Buffer.from(JSON.stringify(json), 'utf-8')
          const exif = Buffer.concat([exifAttr, jsonBuff])
          exif.writeUIntLE(jsonBuff.length, 14, 4)
          img.exif = exif
          const tmpOut = `./tmp/pack-sticker-${Date.now()}-${Math.random().toString(36).slice(2)}.webp`
          await img.save(tmpOut)
          const stickerBuf = fs.readFileSync(tmpOut)
          fs.unlinkSync(tmpOut)
          return { sticker: stickerBuf, isAnimated: false, isLottie: false, emojis: ['🎭'] }
        } catch {
          return { sticker: buffer, isAnimated: false, isLottie: false, emojis: ['🎭'] }
        }
      }))

      await client.sendMessage(m.chat, { stickerPack: { name: pack.name, publisher: `${pack.author} (${pushName})`, description: pack.desc, cover, stickers: stickerResults } }, { quoted: m })
      await m.react('✔️')
    } catch (e) {
      await m.react('✖️')
      m.reply(`> Error al ejecutar el comando.\n[Error: *${e.message}*]`)
    }
  }
}
