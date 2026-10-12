import { connection } from './connection.js';

// Все воркеры делят один event loop, а ffmpeg и ONNX-инференс блокируют его на минуты:
// с дефолтными 30с очереди теряют лок на чужой работе (инцидент 06.09).
export const WORKER_LOCK_MS = 5 * 60 * 1000;

// Запасной лимит истории для задач без своего removeOn* — это задачи кронов. Без него
// due-every-min копил по записи в минуту, и минутный снапшот Redis положил диск (инцидент 12.10).
export const KEEP_COMPLETED = { count: 200 };
export const KEEP_FAILED = { count: 500 };

export const baseWorkerOptions = {
  connection,
  lockDuration: WORKER_LOCK_MS,
  removeOnComplete: KEEP_COMPLETED,
  removeOnFail: KEEP_FAILED,
};
