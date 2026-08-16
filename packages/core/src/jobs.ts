// BullMQ queue names — импортируются и apps/worker, и apps/web
export const QUEUE_TRANSCODE = 'transcode' as const;
export const QUEUE_PLAY_EVENTS = 'play-events' as const;
export const QUEUE_NOTIFY_RELEASE = 'notify-release' as const;
export const QUEUE_ANALYZE = 'analyze-audio' as const;
export const QUEUE_ANALYZE_GENRE = 'analyze-genre' as const;
export const QUEUE_EDITORIAL = 'editorial' as const;
export const QUEUE_SCHEDULED_PUBLISH = 'scheduled-publish' as const;
export const QUEUE_FULFILL_PRESAVE = 'fulfill-presave' as const;
export const QUEUE_METRICS = 'metrics-daily' as const;
export const QUEUE_JAM_REAPER = 'jam-reaper' as const;
export const QUEUE_STORAGE_CLEANUP = 'storage-cleanup' as const;

export interface TranscodeJobData {
  trackId: string;
  // S3-ключ в vault-бакете, куда артист загрузил FLAC (до постоянного пути)
  sourceKey: string;
}

export interface TranscodeJobResult {
  hlsManifestKey: string;
  durationSec: number;
}

export interface NotifyReleaseJobData {
  releaseId: string;
  releaseTitle: string;
  releaseType: string;
  coverUrl: string | null;
  artistProfileId: string;
  artistName: string;
  artistSlug: string;
}

export interface AnalyzeJobData {
  trackId: string;
  flacKey: string;
}

// Анализ жанра по требованию (кнопка в дашборде/админке) — в отличие от
// AnalyzeJobData, флаг AUTO_GENRE не проверяется: это явный запрос пользователя.
export interface AnalyzeGenreJobData {
  trackId: string;
}

export interface PlayEventJobData {
  trackId: string;
  sessionId: string;
  userId: string | null;
  source: string;
  durationPlayedSec: number;
  startedAt: string; // ISO string
}

export interface EditorialJobData {
  scope: 'shared' | 'personal';
}

export interface FulfillPresaveJobData {
  releaseId: string;
  releaseTitle: string;
  releaseType: string;
  coverUrl: string | null;
  artistName: string;
  artistSlug: string;
}

export const QUEUE_NOTIFY_EXTERNAL = 'notify-external' as const;

export type ExternalNotifyKind = 'FRIEND_REQUEST' | 'CHAT_MESSAGE';

export interface ExternalNotifyJobData {
  kind: ExternalNotifyKind;
  recipientId: string;
  actorId: string;
  conversationId?: string;
}
