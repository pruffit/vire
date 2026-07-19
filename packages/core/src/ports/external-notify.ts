import type { ExternalNotifyJobData } from '../jobs';

export interface IExternalNotifyQueue {
  add(data: ExternalNotifyJobData): Promise<void>;
}
