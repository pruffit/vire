import { connection } from './connection.js';

// Все воркеры делят один event loop, а ffmpeg и ONNX-инференс блокируют его на минуты:
// с дефолтными 30с очереди теряют лок на чужой работе (инцидент 06.09).
export const WORKER_LOCK_MS = 5 * 60 * 1000;

export const baseWorkerOptions = { connection, lockDuration: WORKER_LOCK_MS };
