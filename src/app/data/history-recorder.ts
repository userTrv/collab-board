import { signal } from '@angular/core';
import * as Y from 'yjs';
import { BoardContent } from '../domain/model';
import { HISTORY_ORIGIN, LOCAL_ORIGIN } from '../domain/origins';
import { readBoard } from '../domain/read';
import { boardTypes, HistoryEntryData, undoScope } from '../domain/schema';

export interface HistoryEntry {
  readonly index: number;
  readonly ts: number;
  readonly by: string;
  readonly color: string;
  readonly label: string;
}

export const MAX_HISTORY = 150;
const UNDO_LABEL = 'Undo / redo';

/**
 * Time travel via Yjs snapshots. After a burst of *local* edits settles, the tab that made them
 * appends { author, label, Y.snapshot } to the shared `history` array — so every collaborator
 * sees one shared timeline. A snapshot is only a state vector + delete set (a few hundred
 * bytes); previewing rebuilds the past state with Y.createDocFromSnapshot, which is why board
 * docs keep gc disabled.
 */
export class HistoryRecorder {
  readonly entries = signal<readonly HistoryEntry[]>([]);
  private readonly history: Y.Array<HistoryEntryData>;
  private readonly scope: ReadonlySet<object>;
  private pendingLabels: string[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly onAfterTransaction = (tr: Y.Transaction) => {
    const mine = tr.origin === LOCAL_ORIGIN || tr.origin instanceof Y.UndoManager;
    if (!mine || ![...tr.changedParentTypes.keys()].some((t) => this.scope.has(t))) return;
    if (tr.origin instanceof Y.UndoManager) this.pendingLabels.push(UNDO_LABEL);
    this.schedule();
  };
  private readonly onHistoryChange = () => this.refresh();

  constructor(
    private readonly doc: Y.Doc,
    private readonly author: () => { name: string; color: string },
    private readonly debounceMs = 1200,
  ) {
    this.history = boardTypes(doc).history;
    this.scope = new Set(undoScope(doc));
    doc.on('afterTransaction', this.onAfterTransaction);
    this.history.observe(this.onHistoryChange);
    this.refresh();
  }

  /** Commands report what they did; the next recorded entry uses these labels. */
  describe(label: string): void {
    if (this.pendingLabels.at(-1) !== label) this.pendingLabels.push(label);
  }

  /** Records immediately (e.g. before leaving the page). */
  flush(): void {
    if (this.timer === null) return;
    clearTimeout(this.timer);
    this.timer = null;
    this.record();
  }

  record(label?: string): void {
    const labels = label ? [label] : this.pendingLabels;
    this.pendingLabels = [];
    const main = labels.filter((l) => l !== UNDO_LABEL).at(-1) ?? labels.at(-1);
    const text = !main ? 'Edited the board' : labels.length === 1 ? main : `${main} (+${labels.length - 1} more)`;
    const { name, color } = this.author();
    const snapshot = Y.encodeSnapshot(Y.snapshot(this.doc));
    this.doc.transact(() => {
      this.history.push([{ ts: Date.now(), by: name, color, label: text, snapshot }]);
      if (this.history.length > MAX_HISTORY) this.history.delete(0, this.history.length - MAX_HISTORY);
    }, HISTORY_ORIGIN);
  }

  /** Board content as it was at history entry `index`. */
  contentAt(index: number): BoardContent | null {
    const entry = this.history.get(index);
    if (!entry) return null;
    const past = Y.createDocFromSnapshot(this.doc, Y.decodeSnapshot(entry.snapshot));
    try {
      return readBoard(past);
    } finally {
      past.destroy();
    }
  }

  destroy(): void {
    this.flush();
    this.doc.off('afterTransaction', this.onAfterTransaction);
    this.history.unobserve(this.onHistoryChange);
  }

  private schedule(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.record();
    }, this.debounceMs);
  }

  private refresh(): void {
    this.entries.set(this.history.toArray().map((e, index) => ({ index, ts: e.ts, by: e.by, color: e.color, label: e.label })));
  }
}
