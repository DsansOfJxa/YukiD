import axios from 'axios';

const API = "https://www.tikwm.com";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function api(endpoint, params) {
  const { data } = await axios.post(`${API}${endpoint}`, new URLSearchParams(params).toString(), {
    headers: { 
      "User-Agent": UA, 
      "Content-Type": "application/x-www-form-urlencoded", 
      Accept: "application/json" 
    },
    timeout: 15000
  });
  
  if (data.code !== 0) throw new Error(`API error: ${data.msg}`);
  return data.data;
}

export function isTikTokLink(text) {
  return /tiktok\.com/i.test(text) || /vm\.tiktok/i.test(text);
}

export async function scrapeTikTokVideo(url) {
  try {
    const raw = await api("/api/", { url, hd: 1 });
    
    // Format to match YukiBot's standard downloader response
    return {
      status: true,
      data: {
        id: raw.id,
        title: (raw.title || "").trim(),
        region: raw.region || "",
        duration: raw.duration || 0,
        created_at: new Date(raw.create_time * 1000).toLocaleDateString(),
        thumbnail: raw.cover || raw.origin_cover || "",
        dl: raw.images ? raw.images : (raw.hdplay || raw.play || ""),
        download_wm: raw.wmplay || "",
        size: raw.size || 0,
        size_hd: raw.hd_size || 0,
        author: {
          uid: raw.author?.id,
          unique_id: raw.author?.unique_id,
          nickname: raw.author?.nickname,
          avatar: raw.author?.avatar || "",
        },
        stats: {
          views: raw.play_count || 0,
          likes: raw.digg_count || 0,
          comments: raw.comment_count || 0,
          shares: raw.share_count || 0,
          saved: raw.collect_count || 0,
          downloads: raw.download_count || 0,
        },
        music: {
          title: raw.music_info?.title || raw.music || "",
          author: raw.music_info?.author || "",
          mp3: raw.music_info?.play || "",
        },
        url: `https://www.tiktok.com/@${raw.author?.unique_id}/video/${raw.id}`,
        type: raw.images ? 'image' : 'video'
      }
    };
  } catch (error) {
    return null;
  }
}

export async function searchTikTokVideos(keyword, count = 18) {
  try {
    const raw = await api("/api/feed/search", { keywords: keyword, count: count.toString(), cursor: "0" });
    
    const mapped = (raw.videos || []).map((v) => ({
      id: v.id,
      title: (v.title || "").trim(),
      duration: v.duration || 0,
      created_at: new Date(v.create_time * 1000).toLocaleDateString(),
      thumbnail: v.cover || "",
      dl: v.play || v.hdplay || "",
      download_wm: v.wmplay || "",
      size: v.size || 0,
      author: { unique_id: v.author?.unique_id, nickname: v.author?.nickname, avatar: v.author?.avatar || "" },
      stats: {
        views: v.play_count || 0,
        likes: v.digg_count || 0,
        comments: v.comment_count || 0,
        shares: v.share_count || 0,
        saved: v.collect_count || 0,
      },
      music: { title: v.music_info?.title || v.music || "", author: v.music_info?.author || "", mp3: v.music_info?.play || "" },
      url: `https://www.tiktok.com/@${v.author?.unique_id}/video/${v.id}`,
      type: 'video' // Search results from tikwm /feed/search are generally videos
    }));
    
    return { status: true, data: mapped };
  } catch (error) {
    return null;
  }
}

export async function getTikTokUserDetails(uniqueId) {
  try {
    const raw = await api("/api/user/info", { unique_id: uniqueId });
    const u = raw.user || {};
    const s = raw.stats || {};
    return {
      uid: u.id,
      username: u.uniqueId,
      name: u.nickname,
      bio: (u.signature || "").trim(),
      avatar: u.avatarLarger || u.avatarMedium || u.avatarThumb || "",
      verified: !!u.verified,
      private: !!u.privateAccount,
      followers: s.followerCount || 0,
      following: s.followingCount || 0,
      likes: s.heartCount || s.heart || 0,
      videos: s.videoCount || 0,
      url: `https://www.tiktok.com/@${u.uniqueId}`,
    };
  } catch {
    return null;
  }
}

export async function searchTikTokUsers(keyword, count = 10) {
  try {
    const raw = await api("/api/user/search", { keywords: keyword, count: count.toString(), cursor: "0" });
    const list = (raw.user_list || []).map((entry) => entry.user?.uniqueId).filter(Boolean);

    // Promise.all to fetch details. We limit concurrency to prevent API rate limits.
    const details = [];
    for (const id of list.slice(0, count)) {
       const userDetail = await getTikTokUserDetails(id);
       if (userDetail) details.push(userDetail);
    }
    
    return { status: true, data: details };
  } catch (error) {
    return null;
  }
}
