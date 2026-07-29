export interface JamTransport {
  toggle(): void;
  next(): void;
  prev(): void;
  seek(ms: number): void;
  positionMs(): number;
}

let transport: JamTransport | null = null;

/** Модульный регистр: jam-room регистрирует свой транспорт, mini-bar (и audio-engine guard) зовут его в режиме джема. */
export function setJamTransport(t: JamTransport | null): void {
  transport = t;
}

export function getJamTransport(): JamTransport | null {
  return transport;
}

export function jamToggle(): void {
  transport?.toggle();
}
