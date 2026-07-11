import { parseEmbed } from '@/lib/embed';
import { fetchVkTitle } from '@/lib/vk-api';

/** Название ролика по ссылке (server-only): YouTube — keyless oEmbed, VK — video.get (VK_SERVICE_TOKEN). Любой сбой → '' (подпись останется пустой). */
export async function resolveVideoTitle(url: string): Promise<string> {
  const embed = parseEmbed(url);
  if (!embed) return '';
  try {
    if (embed.platform === 'youtube') {
      const res = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
        { next: { revalidate: 86400 } },
      );
      if (res.ok) {
        const json = (await res.json()) as { title?: string };
        return json.title?.trim() ?? '';
      }
    } else if (embed.platform === 'vk') {
      return (await fetchVkTitle(embed.id)) ?? '';
    }
  } catch {
    /* деградируем до пустой подписи */
  }
  return '';
}
