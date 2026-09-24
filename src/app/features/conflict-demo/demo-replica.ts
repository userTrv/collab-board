import { signal } from '@angular/core';
import * as Y from 'yjs';
import { BoardStore } from '../../data/board-store';
import { BoardCommands } from '../../domain/board-commands';
import { BoardContent } from '../../domain/model';
import { LOCAL_ORIGIN } from '../../domain/origins';
import { readBoard } from '../../domain/read';
import { createBoardDoc } from '../../domain/schema';

export const REMOTE = Symbol('demo-network');

/** One simulated device in the conflict demo: its own Y.Doc, commands and signals. */
export class DemoReplica {
  readonly doc: Y.Doc;
  readonly kanban: BoardCommands;
  readonly store: BoardStore;
  /** Local transactions not yet delivered to the other replica. */
  readonly pendingOps = signal(0);
  readonly lastAction = signal<string | null>(null);
  /** Formatted state vector, e.g. "1:12 · 2:5" (client id : inserted items seen). */
  readonly stateVector = signal('');

  constructor(
    readonly name: 'A' | 'B',
    readonly clientId: number,
    base: Uint8Array,
  ) {
    this.doc = createBoardDoc();
    this.doc.clientID = clientId; // fixed ids make the LWW tie-break explainable
    Y.applyUpdate(this.doc, base, REMOTE);
    this.kanban = new BoardCommands(this.doc, { origin: LOCAL_ORIGIN, describe: (l) => this.lastAction.set(l) });
    this.store = new BoardStore(this.doc);
    const refresh = () =>
      this.stateVector.set(
        [...Y.decodeStateVector(Y.encodeStateVector(this.doc))]
          .filter(([client]) => client === 1 || client === 2)
          .sort(([a], [b]) => a - b)
          .map(([client, clock]) => `${client === 1 ? 'A' : 'B'}:${clock}`)
          .join(' · ') || 'A:0 · B:0',
      );
    refresh();
    this.doc.on('update', refresh);
  }

  content(): BoardContent {
    return readBoard(this.doc);
  }

  /** Bytes this replica would send so that `other` catches up. */
  diffFor(other: DemoReplica): Uint8Array {
    return Y.encodeStateAsUpdate(this.doc, Y.encodeStateVector(other.doc));
  }

  destroy(): void {
    this.store.destroy();
    this.doc.destroy();
  }
}
