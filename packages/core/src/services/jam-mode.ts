import type { JamMode, JamParticipant } from '../types/jam';

/** Указанный участник, если ещё в комнате; иначе фолбэк на HOST (в т.ч. когда колонка не назначена вовсе). */
export function resolveSpeakerParticipantId(
  participants: JamParticipant[],
  speakerParticipantId: string | null,
): string | null {
  if (speakerParticipantId && participants.some((p) => p.id === speakerParticipantId)) {
    return speakerParticipantId;
  }
  return participants.find((p) => p.role === 'HOST')?.id ?? null;
}

export function isAudioDevice(args: {
  mode: JamMode;
  participantId: string;
  participants: JamParticipant[];
  speakerParticipantId: string | null;
}): boolean {
  if (args.mode === 'SYNCED') return true;
  return resolveSpeakerParticipantId(args.participants, args.speakerParticipantId) === args.participantId;
}
