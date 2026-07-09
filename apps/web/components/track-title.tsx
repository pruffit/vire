/**
 * Единый рендер названия трека: `title` основным начертанием, `feat. …` и
 * `— Version` — приглушённо (opacity, не цвет — тема-агностично: работает и в
 * артист-теме, и в нейтральной). Инлайновый фрагмент — встраивается в
 * существующие truncate-спаны, сам не оборачивает и не задаёт block/flex.
 * SEO/metadata/JSON-LD по-прежнему берут полную строку из `displayTrackTitle`
 * (lib/track-display.ts) — этот компонент только для UI.
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
