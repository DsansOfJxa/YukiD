import fs from 'fs';
import { tmpdir } from 'os';
import Crypto from 'crypto';
import ff from 'fluent-ffmpeg';
import webp from 'node-webpmux';
import path from 'path';

async function imageToWebp(media) {
  const tmpFileOut = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`);
  const tmpFileIn = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.jpg`);
  fs.writeFileSync(tmpFileIn, media);
  try {
    await new Promise((resolve, reject) => {
      ff(tmpFileIn)
        .on('error', reject)
        .on('end', () => resolve(true))
        .addOutputOptions([
          '-vcodec', 'libwebp',
          '-vf', "scale='min(320,iw)':'min(320,ih)':force_original_aspect_ratio=decrease,fps=15, pad=320:320:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse"
        ])
        .toFormat('webp')
        .save(tmpFileOut);
    });
    return fs.readFileSync(tmpFileOut);
  } finally {
    if (fs.existsSync(tmpFileOut)) try { fs.unlinkSync(tmpFileOut); } catch {}
    if (fs.existsSync(tmpFileIn)) try { fs.unlinkSync(tmpFileIn); } catch {}
  }
}

async function videoToWebp(media) {
  const tmpFileOut = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`);
  const tmpFileIn = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.mp4`);
  fs.writeFileSync(tmpFileIn, media);
  try {
    await new Promise((resolve, reject) => {
      ff(tmpFileIn)
        .on('error', reject)
        .on('end', () => resolve(true))
        .addOutputOptions([
          '-vcodec', 'libwebp',
          '-vf', "scale='min(320,iw)':'min(320,ih)':force_original_aspect_ratio=decrease,fps=15, pad=320:320:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse",
          '-loop', '0', '-ss', '00:00:00', '-t', '00:00:05', '-preset', 'default', '-an', '-vsync', '0'
        ])
        .toFormat('webp')
        .save(tmpFileOut);
    });
    return fs.readFileSync(tmpFileOut);
  } finally {
    if (fs.existsSync(tmpFileOut)) try { fs.unlinkSync(tmpFileOut); } catch {}
    if (fs.existsSync(tmpFileIn)) try { fs.unlinkSync(tmpFileIn); } catch {}
  }
}

async function writeExifImg(media, metadata = {}) {
  let wMedia = await imageToWebp(media);
  if (!metadata || (!metadata.packname && !metadata.author)) return wMedia;
  const tmpFileIn = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`);
  const tmpFileOut = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`);
  try {
    fs.writeFileSync(tmpFileIn, wMedia);
    const img = new webp.Image();
    const json = {
      'sticker-pack-id': 'https://github.com/iamDestroy/YukiBot-MD',
      'sticker-pack-name': metadata.packname || '',
      'sticker-pack-publisher': metadata.author || '',
      emojis: metadata.categories ? metadata.categories : ['']
    };
    const exifAttr = Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]);
    const jsonBuff = Buffer.from(JSON.stringify(json), 'utf-8');
    const exif = Buffer.concat([exifAttr, jsonBuff]);
    exif.writeUIntLE(jsonBuff.length, 14, 4);
    await img.load(tmpFileIn);
    img.exif = exif;
    await img.save(tmpFileOut);
    return fs.readFileSync(tmpFileOut);
  } finally {
    if (fs.existsSync(tmpFileIn)) try { fs.unlinkSync(tmpFileIn); } catch {}
    if (fs.existsSync(tmpFileOut)) try { fs.unlinkSync(tmpFileOut); } catch {}
  }
}

async function writeExifVid(media, metadata = {}) {
  let wMedia = await videoToWebp(media);
  if (!metadata || (!metadata.packname && !metadata.author)) return wMedia;
  const tmpFileIn = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`);
  const tmpFileOut = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`);
  try {
    fs.writeFileSync(tmpFileIn, wMedia);
    const img = new webp.Image();
    const json = {
      'sticker-pack-id': 'https://github.com/iamDestroy/YukiBot-MD',
      'sticker-pack-name': metadata.packname || '',
      'sticker-pack-publisher': metadata.author || '',
      emojis: metadata.categories ? metadata.categories : ['']
    };
    const exifAttr = Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]);
    const jsonBuff = Buffer.from(JSON.stringify(json), 'utf-8');
    const exif = Buffer.concat([exifAttr, jsonBuff]);
    exif.writeUIntLE(jsonBuff.length, 14, 4);
    await img.load(tmpFileIn);
    img.exif = exif;
    await img.save(tmpFileOut);
    return fs.readFileSync(tmpFileOut);
  } finally {
    if (fs.existsSync(tmpFileIn)) try { fs.unlinkSync(tmpFileIn); } catch {}
    if (fs.existsSync(tmpFileOut)) try { fs.unlinkSync(tmpFileOut); } catch {}
  }
}

async function writeExif(media, metadata = {}) {
  let wMedia = /webp/.test(media?.mimetype) ? media.data : /image/.test(media?.mimetype) ? await imageToWebp(media.data) : /video/.test(media?.mimetype) ? await videoToWebp(media.data) : '';
  if (!wMedia || !Buffer.isBuffer(wMedia)) return wMedia;
  if (!metadata || (!metadata.packname && !metadata.author)) return wMedia;
  const tmpFileIn = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`);
  const tmpFileOut = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`);
  try {
    fs.writeFileSync(tmpFileIn, wMedia);
    const img = new webp.Image();
    const json = {
      'sticker-pack-id': 'https://github.com/iamDestroy/YukiBot-MD',
      'sticker-pack-name': metadata.packname || '',
      'sticker-pack-publisher': metadata.author || '',
      emojis: metadata.categories ? metadata.categories : ['']
    };
    const exifAttr = Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]);
    const jsonBuff = Buffer.from(JSON.stringify(json), 'utf-8');
    const exif = Buffer.concat([exifAttr, jsonBuff]);
    exif.writeUIntLE(jsonBuff.length, 14, 4);
    await img.load(tmpFileIn);
    img.exif = exif;
    await img.save(tmpFileOut);
    return fs.readFileSync(tmpFileOut);
  } finally {
    if (fs.existsSync(tmpFileIn)) try { fs.unlinkSync(tmpFileIn); } catch {}
    if (fs.existsSync(tmpFileOut)) try { fs.unlinkSync(tmpFileOut); } catch {}
  }
}

export default { imageToWebp, videoToWebp, writeExifImg, writeExifVid, writeExif };