import { describe, it, expect } from 'vitest';
import { resolveSpeakerParticipantId, isAudioDevice } from './jam-mode';
import type { JamParticipant } from '../types/jam';

function participant(overrides?: Partial<JamParticipant>): JamParticipant {
  return {
    id: 'p-1',
    jamId: 'jam-1',
    userId: null,
    guestSessionId: 'guest-1',
    displayName: 'Guest',
    role: 'GUEST',
    joinedAt: new Date('2026-07-20T12:00:00Z'),
    lastSeenAt: new Date('2026-07-20T12:00:00Z'),
    ...overrides,
  };
}

describe('resolveSpeakerParticipantId', () => {
  const host = participant({ id: 'p-host', role: 'HOST' });
  const guest = participant({ id: 'p-guest', role: 'GUEST' });

  it('returns the designated speaker when still in the room', () => {
    expect(resolveSpeakerParticipantId([host, guest], 'p-guest')).toBe('p-guest');
  });

  it('falls back to the host when no speaker is designated', () => {
    expect(resolveSpeakerParticipantId([host, guest], null)).toBe('p-host');
  });

  it('falls back to the host when the designated speaker has left the room', () => {
    expect(resolveSpeakerParticipantId([host], 'p-guest')).toBe('p-host');
  });

  it('returns null when neither the speaker nor a host are present', () => {
    expect(resolveSpeakerParticipantId([guest], null)).toBeNull();
  });
});

describe('isAudioDevice', () => {
  const host = participant({ id: 'p-host', role: 'HOST' });
  const guest = participant({ id: 'p-guest', role: 'GUEST' });

  it('is always true in SYNCED, regardless of who asks', () => {
    expect(isAudioDevice({ mode: 'SYNCED', participantId: 'p-guest', participants: [host, guest], speakerParticipantId: null })).toBe(true);
  });

  it('in SPEAKER, is true only for the resolved speaker', () => {
    expect(isAudioDevice({ mode: 'SPEAKER', participantId: 'p-guest', participants: [host, guest], speakerParticipantId: 'p-guest' })).toBe(true);
    expect(isAudioDevice({ mode: 'SPEAKER', participantId: 'p-host', participants: [host, guest], speakerParticipantId: 'p-guest' })).toBe(false);
  });

  it('in SPEAKER without a designated speaker, the host is the audio device', () => {
    expect(isAudioDevice({ mode: 'SPEAKER', participantId: 'p-host', participants: [host, guest], speakerParticipantId: null })).toBe(true);
    expect(isAudioDevice({ mode: 'SPEAKER', participantId: 'p-guest', participants: [host, guest], speakerParticipantId: null })).toBe(false);
  });
});
