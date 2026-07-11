/**
 * Название трека с приглушёнными `feat.`/`— Version` (opacity — тема-агностично).
 * Только для UI; SEO/JSON-LD берут полную строку из `displayTrackTitle`.
 */
export function TrackTitleText({
  title,
  version,
  feat,
}: {
  title: string;
  version?: string | null;
  feat?: string[];
}) {
  const v = version?.trim();
  const hasFeat = !!feat && feat.length > 0;

  return (
    <>
      {title}
      {hasFeat && <span className="font-normal opacity-55"> feat. {feat.join(', ')}</span>}
      {v && <span className="font-normal opacity-55"> — {v}</span>}
    </>
  );
}
