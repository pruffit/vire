import type { PlaylistWithTracks, PlaylistCollaborator } from './playlist';

export type PlaylistPageRole = 'OWNER' | 'COLLABORATOR' | 'VIEWER';

export interface PlaylistPageInvite {
  title: string;
  ownerUserId: string | null;
}

export type PlaylistPageView =
  | { kind: 'invite'; title: string; ownerUserId: string | null }
  | {
      kind: 'playlist';
      playlist: PlaylistWithTracks;
      role: PlaylistPageRole;
      collaborators: PlaylistCollaborator[];
      liked: boolean;
      invite: PlaylistPageInvite | null;
      inviterName: string | null;
    };
