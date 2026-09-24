import * as Y from 'yjs';
import { LOCAL_ORIGIN } from './origins';
import { boardTypes, BoardDocTypes, YEntity } from './schema';

export interface CommandContext {
  /** Transaction origin; LOCAL_ORIGIN for the user, so the UndoManager tracks it. */
  readonly origin?: unknown;
  /**
   * Called after every command with a human readable label (for the history timeline).
   * `continuous` is true for commands issued many times per gesture (dragging, resizing,
   * typing), which should be grouped into one undo step.
   */
  readonly describe?: (label: string, continuous: boolean) => void;
  /** Author shown on comments. */
  readonly author?: () => { name: string; color: string };
}

/**
 * Commands are framework-free: they take a Y.Doc and run each user intent as ONE transaction
 * (one undo step, one sync message). The same classes drive the real board, the conflict-demo
 * replicas and the tests.
 */
export abstract class CommandBase {
  protected readonly t: BoardDocTypes;

  constructor(
    protected readonly doc: Y.Doc,
    protected readonly ctx: CommandContext = {},
  ) {
    this.t = boardTypes(doc);
  }

  protected run<T>(label: string, fn: () => T, continuous = false): T {
    let result!: T;
    this.doc.transact(() => {
      result = fn();
    }, this.ctx.origin ?? LOCAL_ORIGIN);
    this.ctx.describe?.(label, continuous);
    return result;
  }

  protected applyRepairs(map: Y.Map<YEntity>, repairs: readonly { id: string; rank: string }[]): void {
    for (const r of repairs) map.get(r.id)?.set('rank', r.rank);
  }
}
