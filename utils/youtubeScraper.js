import axios from 'axios';

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const PROXY_URL = "https://app.ytdown.to/proxy.php";

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function proxy(target) {
  const { data } = await axios.post(PROXY_URL, new URLSearchParams({ url: target }).toString(), {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Accept": "*/*",
      "X-Requested-With": "XMLHttpRequest",
      "Origin": "https://app.ytdown.to",
      "Referer": "https://app.ytdown.to/",
      "User-Agent": UA
    },
    timeout: 15000
  });

  if (!data || !data.api) throw new Error("Respuesta inválida de proxy YT");
  return data.api;
}

function chooseMedia(items, type, quality) {
  const list = items.filter(item => String(item.type || "").toLowerCase() === type.toLowerCase());

  return list.find(item => {
    const data = [
      item.mediaUrl,
      item.mediaQuality,
      item.mediaRes,
      item.mediaExtension
    ].join(" ").toLowerCase();

    return data.includes(quality.toLowerCase());
  }) || list[0]; // Retorna el más cercano o el primero del tipo
}

async function getFile(mediaUrl) {
  for (let i = 0; i < 15; i++) { // Max 15 intentos (aprox 30-40s) para evitar bloquear el bot
    const file = await proxy(mediaUrl);

    if (file.status === "completed" && file.fileUrl && file.fileUrl !== "Waiting...") {
      return file;
    }

    if (file.status === "error" || file.status === "failed") {
      throw new Error(file.message || "Error procesando archivo de YT");
    }

    await sleep(2500);
  }

  throw new Error("La conversión en YT tardó demasiado tiempo");
}

export async function scrapeYouTube(videoUrl, type = "audio", quality = "mp3") {
  try {
    const info = await proxy(videoUrl);

    if (info.status !== "ok") {
      throw new Error(info.message || "No se pudo obtener información del video");
    }

    const media = chooseMedia(info.mediaItems || [], type, quality);
    if (!media) throw new Error(`No se encontró el formato pedido: ${type} ${quality}`);

    const file = await getFile(media.mediaUrl);

    return {
      status: true,
      data: {
        id: info.id,
        title: info.title,
        description: info.description,
        thumbnail: info.imagePreviewUrl,
        url: info.permanentLink,

        author: {
          name: info.userInfo?.name || "",
          username: info.userInfo?.username || "",
          id: info.userInfo?.userId || "",
          avatar: info.userInfo?.userAvatar || "",
          channel: info.userInfo?.internalUrl || "",
        },

        type: media.type,
        quality: media.mediaQuality,
        resolution: media.mediaRes,
        duration: media.mediaDuration,
        extension: media.mediaExtension,
        size: file.fileSize || media.mediaFileSize,

        fileName: file.fileName,
        dl: file.fileUrl,
        viewUrl: file.viewUrl || ""
      }
    };
  } catch (error) {
    return null;
  }
}

export async function scrapeYouTubeAudio(url) {
  const result = await scrapeYouTube(url, "audio", "mp3");
  if (result?.data?.dl) {
    return { url: result.data.dl, api: 'ytdown_scraper' };
  }
  return null;
}

export async function scrapeYouTubeVideo(url) {
  // Intentar obtener 720p, sino el que encuentre
  const result = await scrapeYouTube(url, "video", "720p");
  if (result?.data?.dl) {
    return { url: result.data.dl, api: 'ytdown_scraper' };
  }
  return null;
}
