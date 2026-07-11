// VK REST API (server-only), нужен VK_SERVICE_TOKEN в env; любой сбой деградирует до null.

interface VkImage {
  url: string;
  width: number;
  height: number;
}

interface VkVideoGetResponse {
  response?: {
    items?: Array<{ image?: VkImage[]; title?: string }>;
  };
}

/** Название VK-видео по id вида `${oid}_${id}`. null при отсутствии токена/сбое. */
export async function fetchVkTitle(videoId: string): Promise<string | null> {
  const token = process.env.VK_SERVICE_TOKEN;
  if (!token) return null;
  try {
    const url = `https://api.vk.com/method/video.get?videos=${encodeURIComponent(videoId)}&access_token=${token}&v=5.199`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const json = (await res.json()) as VkVideoGetResponse;
    const title = json.response?.items?.[0]?.title;
    return title?.trim() || null;
  } catch {
    return null;
  }
}

/** Постер VK-видео по id вида `${oid}_${id}` — самый крупный из доступных. */
export async function fetchVkPoster(videoId: string): Promise<string | null> {
  const token = process.env.VK_SERVICE_TOKEN;
  if (!token) return null;

  try {
    const url = `https://api.vk.com/method/video.get?videos=${encodeURIComponent(videoId)}&access_token=${token}&v=5.199`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;

    const json = (await res.json()) as VkVideoGetResponse;
    const images = json.response?.items?.[0]?.image;
    if (!images || images.length === 0) return null;

    return images.reduce((best, img) => (img.width > best.width ? img : best)).url;
  } catch {
    return null;
  }
}
