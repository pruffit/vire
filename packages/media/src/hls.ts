export function parseHlsSegments(playlistText: string, manifestUrl: string): string[] {
  return playlistText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line) => new URL(line, manifestUrl).toString());
}

/**
 * Rewrites an HLS playlist so each segment URI line points at a local filename instead
 * of the original (relative or absolute) URL. Tag/comment/blank lines pass through
 * untouched; segment lines are replaced in the same order `parseHlsSegments` walks them.
 * `localFilenames` must have exactly one entry per segment line, in order.
 */
export function rewritePlaylistForLocalSegments(playlistText: string, localFilenames: string[]): string {
  const lines = playlistText.split(/\r?\n/);
  const segmentLineCount = lines.filter((line) => {
    const trimmed = line.trim();
    return trimmed.length > 0 && !trimmed.startsWith('#');
  }).length;

  if (segmentLineCount !== localFilenames.length) {
    throw new Error(
      `rewritePlaylistForLocalSegments: expected ${segmentLineCount} local filenames, got ${localFilenames.length}`,
    );
  }

  let segmentIndex = 0;
  const rewritten = lines.map((line) => {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) return line;
    return localFilenames[segmentIndex++];
  });

  return rewritten.join('\n');
}
