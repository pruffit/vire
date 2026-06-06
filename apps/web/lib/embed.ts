export function getEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);

    // YouTube: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/shorts/ID
    if (u.hostname === 'www.youtube.com' || u.hostname === 'youtube.com') {
      const v = u.searchParams.get('v');
      if (v) return `https://www.youtube.com/embed/${v}`;
      const shorts = u.pathname.match(/^\/shorts\/([^/?]+)/);
      if (shorts) return `https://www.youtube.com/embed/${shorts[1]}`;
    }
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.slice(1);
      if (id) return `https://www.youtube.com/embed/${id}`;
    }

    // VK: vk.com/video{oid}_{id} or vk.com/video?z=video{oid}_{id}
    if (u.hostname === 'vk.com' || u.hostname === 'www.vk.com') {
      const pathMatch = u.pathname.match(/^\/video(-?\d+)_(\d+)/);
      if (pathMatch) {
        return `https://vk.com/video_ext.php?oid=${pathMatch[1]}&id=${pathMatch[2]}&hd=2`;
      }
      const z = u.searchParams.get('z');
      if (z) {
        const zMatch = z.match(/^video(-?\d+)_(\d+)/);
        if (zMatch) {
          return `https://vk.com/video_ext.php?oid=${zMatch[1]}&id=${zMatch[2]}&hd=2`;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}
