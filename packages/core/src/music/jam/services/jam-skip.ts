export function resolveSkip(input: { votes: number; presentCount: number; isHost: boolean }): { skip: boolean; needed: number } {
  const needed = Math.max(1, Math.floor(input.presentCount / 2) + 1);
  return { skip: input.isHost || input.votes >= needed, needed };
}
