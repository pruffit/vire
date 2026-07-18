export type RealtimeEvent = { type: string; [key: string]: unknown };

// core не знает про Redis/SSE — web-композиция инъектирует реализацию поверх lib/realtime.ts.
export interface RealtimePublisher {
  publish(userId: string, event: RealtimeEvent): void | Promise<void>;
}
