import { signal } from '@angular/core';
import { Awareness } from 'y-protocols/awareness';
import { Identity } from '../core/identity/identity.service';

export type BoardView = 'kanban' | 'whiteboard' | 'history';

export interface CursorPosition {
  readonly x: number;
  readonly y: number;
  /** Cursor coordinates only make sense for peers looking at the same view. */
  readonly view: BoardView;
}

export interface PresenceState {
  readonly user: Identity;
  readonly cursor: CursorPosition | null;
  readonly editing: string | null;
  readonly view: BoardView;
}

export interface Peer extends PresenceState {
  readonly clientId: number;
}

/** Signals over the Yjs Awareness protocol (ephemeral, never persisted). */
export class PresenceController {
  readonly peers = signal<readonly Peer[]>([]);

  constructor(
    readonly awareness: Awareness,
    user: Identity,
  ) {
    awareness.setLocalState({ user, cursor: null, editing: null, view: 'kanban' } satisfies PresenceState);
    awareness.on('change', this.refresh);
    this.refresh();
  }

  private readonly refresh = () => {
    const peers: Peer[] = [];
    for (const [clientId, state] of this.awareness.getStates()) {
      if (clientId === this.awareness.clientID) continue;
      const s = state as Partial<PresenceState>;
      if (!s.user?.name) continue;
      peers.push({ clientId, user: s.user, cursor: s.cursor ?? null, editing: s.editing ?? null, view: s.view ?? 'kanban' });
    }
    this.peers.set(peers.sort((a, b) => a.clientId - b.clientId));
  };

  private patch(patch: Partial<PresenceState>): void {
    const current = this.awareness.getLocalState() as PresenceState | null;
    if (!current) return;
    this.awareness.setLocalState({ ...current, ...patch });
  }

  setUser(user: Identity): void {
    this.patch({ user });
  }

  setCursor(cursor: CursorPosition | null): void {
    this.patch({ cursor });
  }

  setEditing(cardId: string | null): void {
    this.patch({ editing: cardId });
  }

  setView(view: BoardView): void {
    this.patch({ view, cursor: null });
  }

  destroy(): void {
    this.awareness.off('change', this.refresh);
    this.awareness.destroy();
  }
}
