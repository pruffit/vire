import type { RealtimeEvent } from '../../../platform/ports/realtime';

// core не знает про Redis pub/sub — web-композиция инъектирует реализацию поверх lib/realtime.ts.
export interface IPlaylistBroadcaster {
  broadcast(playlistId: string, event: RealtimeEvent): Promise<void>;
}
