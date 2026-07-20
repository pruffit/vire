type JamToggleFn = () => void;

let toggle: JamToggleFn | null = null;

/** Модульный регистр: jam-room регистрирует свой play/pause, mini-bar (и audio-engine-guard) зовут его в режиме джема. */
export function setJamToggle(fn: JamToggleFn | null): void {
  toggle = fn;
}

export function jamToggle(): void {
  toggle?.();
}
