// BullMQ queue names — импортируются и apps/worker, и apps/web
export const QUEUE_TRANSCODE = 'transcode' as const;

export interface TranscodeJobData {
  trackId: string;
  // S3-ключ в vault-бакете, куда артист загрузил FLAC (до постоянного пути)
  sourceKey: string;
}

export interface TranscodeJobResult {
  hlsManifestKey: string;
  durationSec: number;
}
