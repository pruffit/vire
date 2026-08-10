export const JAM_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const JAM_CODE_LENGTH = 6;

export function generateJamCode(random: () => number): string {
  let code = '';
  for (let i = 0; i < JAM_CODE_LENGTH; i++) {
    const index = Math.min(
      JAM_CODE_ALPHABET.length - 1,
      Math.floor(random() * JAM_CODE_ALPHABET.length),
    );
    code += JAM_CODE_ALPHABET[index];
  }
  return code;
}

export function normalizeJamCode(raw: string): string | null {
  const cleaned = raw.trim().toUpperCase().replace(/[\s-]/g, '');
  if (cleaned.length !== JAM_CODE_LENGTH) return null;
  for (const char of cleaned) {
    if (!JAM_CODE_ALPHABET.includes(char)) return null;
  }
  return cleaned;
}
