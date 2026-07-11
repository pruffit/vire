export type EmbedPlatform = 'youtube' | 'vk';

export interface EmbedInfo {
  platform: EmbedPlatform;
  /** Платформенный id (YouTube videoId; VK `${oid}_${id}`). */
  id: string;
  /** Базовый URL для встраивания (без autoplay-параметров). */
  embedUrl: string;
  /** Постер для фасада. У YouTube есть всегда, у VK — нет (нужен API). */
  thumbnailUrl: string | null;
}

/** Разбирает ссылку на видео (YouTube watch/youtu.be/shorts, VK video{oid}_{id} в пути или ?z=) в платформу/id/embed-URL/постер для плеера-фасада. */
export function parseEmbed(url: string): EmbedInfo | null {
  try {
    const u = new URL(url);

    // YouTube
    let ytId: string | null = null;
    if (u.hostname === 'www.youtube.com' || u.hostname === 'youtube.com') {
      ytId = u.searchParams.get('v');
      if (!ytId) {
        const shorts = u.pathname.match(/^\/shorts\/([^/?]+)/);
        if (shorts) ytId = shorts[1];
      }
    } else if (u.hostname === 'youtu.be') {
      const id = u.pathname.slice(1);
      if (id) ytId = id;
    }
    if (ytId) {
      return {
        platform: 'youtube',
        id: ytId,
        embedUrl: `https://www.youtube.com/embed/${ytId}`,
        thumbnailUrl: `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
      };
    }

    // VK (vk.com и новый домен vkvideo.ru)
    const vkHosts = ['vk.com', 'www.vk.com', 'vkvideo.ru', 'www.vkvideo.ru', 'm.vk.com'];
    if (vkHosts.includes(u.hostname)) {
      let m = u.pathname.match(/^\/video(-?\d+)_(\d+)/);
      if (!m) {
        const z = u.searchParams.get('z');
        if (z) m = z.match(/^video(-?\d+)_(\d+)/);
      }
      if (m) {
        return {
          platform: 'vk',
          id: `${m[1]}_${m[2]}`,
          embedUrl: `https://vk.com/video_ext.php?oid=${m[1]}&id=${m[2]}&hd=2`,
          thumbnailUrl: null,
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

/** URL для прямого встраивания (совместимость со старым кодом/тестами). */
export function getEmbedUrl(url: string): string | null {
  return parseEmbed(url)?.embedUrl ?? null;
}

/** Embed-URL с автоплеем и приглушённым брендингом — для активного плеера-фасада. */
export function activeEmbedUrl(embed: EmbedInfo): string {
  if (embed.platform === 'youtube') {
    return `${embed.embedUrl}?autoplay=1&modestbranding=1&rel=0&color=white&playsinline=1`;
  }
  return `${embed.embedUrl}&autoplay=1`;
}
