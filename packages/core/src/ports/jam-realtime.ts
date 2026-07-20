import type { RealtimeEvent } from './realtime';

// core не знает про Redis pub/sub — web-композиция инъектирует реализацию поверх lib/realtime.ts.
export interface IJamBroadcaster {
  broadcast(jamId: string, event: RealtimeEvent): Promise<void>;
}
