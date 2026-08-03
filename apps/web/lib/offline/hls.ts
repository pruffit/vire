export function parseHlsSegments(playlistText: string, manifestUrl: string): string[] {
  return playlistText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line) => new URL(line, manifestUrl).toString());
}
