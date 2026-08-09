import Image from 'next/image';

export function ChatAvatar({
  name, image, size = 44, fallbackName,
}: { name: string | null; image: string | null; size?: number; fallbackName?: string }) {
  const displayName = name ?? fallbackName ?? '?';
  if (image) {
    return (
      <Image
        src={image}
        alt={displayName}
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="grid shrink-0 place-items-center rounded-full bg-secondary font-medium text-muted-foreground"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {displayName[0]?.toUpperCase()}
    </div>
  );
}
