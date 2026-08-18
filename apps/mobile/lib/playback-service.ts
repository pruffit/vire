import './audio-engine';

/**
 * Headless-таск RNTP (регистрируется в index.ts как имя 'TrackPlayer', обязателен для
 * Android — без него foreground-service/lock-screen контролы не поднимаются). Реальные
 * слушатели remote-команд и статуса живут в конструкторе TrackPlayerAudioEngine
 * (lib/audio-engine.ts) — импорт выше гарантирует, что singleton уже создан и они
 * зарегистрированы к моменту вызова этого таска.
 */
export async function playbackService(): Promise<void> {}
