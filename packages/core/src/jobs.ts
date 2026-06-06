// BullMQ queue names — импортируются и apps/worker, и apps/web
export const QUEUE_TRANSCODE = 'transcode' as const;
export const QUEUE_PLAY_EVENTS = 'play-events' as const;

export interface TranscodeJobData {
  trackId: string;
  // S3-ключ в vault-бакете, куда артист загрузил FLAC (до постоянного пути)
  sourceKey: string;
}

export interface TranscodeJobResult {
  hlsManifestKey: string;
  durationSec: number;
}

export interface PlayEventJobData {
  trackId: string;
  sessionId: string;
  userId: string | null;
  source: string;
  durationPlayedSec: number;
  startedAt: string; // ISO string
}
