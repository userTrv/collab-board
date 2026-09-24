import { signal } from '@angular/core';
import * as Y from 'yjs';
import { LOCAL_ORIGIN } from '../domain/origins';
import { undoScope } from '../domain/schema';

/**
 * Per-user undo: the UndoManager only tracks transactions with this tab's LOCAL_ORIGIN, so
 * undo never reverts what a collaborator did — it reverts *my* last change, even if others
 * edited the board afterwards.
 */
export class UndoController {
  readonly manager: Y.UndoManager;
  readonly canUndo = signal(false);
  readonly canRedo = signal(false);

  constructor(doc: Y.Doc, captureTimeout = 500) {
    this.manager = new Y.UndoManager(undoScope(doc), { trackedOrigins: new Set([LOCAL_ORIGIN]), captureTimeout });
    const sync = () => {
      this.canUndo.set(this.manager.canUndo());
      this.canRedo.set(this.manager.canRedo());
    };
    for (const e of ['stack-item-added', 'stack-item-popped', 'stack-cleared'] as const) this.manager.on(e, sync);
  }

  undo(): boolean {
    return this.manager.undo() !== null;
  }

  redo(): boolean {
    return this.manager.redo() !== null;
  }

  /** Ends the current capture group so the next edit becomes its own undo step. */
  stopCapturing(): void {
    this.manager.stopCapturing();
  }

  destroy(): void {
    this.manager.destroy();
  }
}
