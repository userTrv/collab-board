import { computed, Injectable, Signal, signal } from '@angular/core';
import { Awareness } from 'y-protocols/awareness';
import { IndexeddbPersistence } from 'y-indexeddb';
import * as Y from 'yjs';
import { KeyedSignals } from '../core/crdt/y-signal';
import { BroadcastSync } from '../core/sync/broadcast-sync';
import { BoardCommands } from '../domain/board-commands';
import { newId } from '../domain/id';
import { BoardContent, BoardSummary } from '../domain/model';
import { HISTORY_ORIGIN, SYSTEM_ORIGIN } from '../domain/origins';
import { readBoard } from '../domain/read';
import { boardTypes, createBoardDoc, entity } from '../domain/schema';
import { demoBoard } from '../domain/seed';
import { decodeBinaryInto, encodeBinary } from '../domain/serialize';
import { deleteBoardDb, loadBoardDoc, persistNewBoardDoc, WORKSPACE_DB } from './persistence';

const SEEDED_KEY = 'cb.seeded';

function readSummary(m: Y.Map<unknown>, id: string): BoardSummary {
  const n = (k: string) => (typeof m.get(k) === 'number' ? (m.get(k) as number) : 0);
  return { id, title: String(m.get('title') ?? 'Untitled board'), createdAt: n('createdAt'), updatedAt: n('updatedAt'), cardCount: n('cardCount'), noteCount: n('noteCount') };
}

/**
 * The workspace index: a small Y.Doc listing all boards (title, counts, timestamps), itself
 * persisted to IndexedDB and synced across tabs. Each board's content lives in its own doc,
 * so opening one board never loads the others.
 */
@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  private readonly doc = new Y.Doc();
  private readonly index = this.doc.getMap<Y.Map<unknown>>('boards');
  private readonly summaries = new KeyedSignals(this.index, { project: readSummary });
  private readonly sync = new BroadcastSync(this.doc, new Awareness(this.doc), 'cb-workspace');
  private readonly _ready = signal(false);
  readonly ready = this._ready.asReadonly();
  /** Set when IndexedDB is unavailable (e.g. some private modes): data then lives in memory only. */
  readonly storageError = signal<string | null>(null);

  readonly boards: Signal<BoardSummary[]> = computed(() => [...this.summaries.entries().values()].sort((a, b) => b.updatedAt - a.updatedAt));

  constructor() {
    this.sync.connect();
    let persistence: IndexeddbPersistence | null = null;
    try {
      persistence = new IndexeddbPersistence(WORKSPACE_DB, this.doc);
    } catch (e) {
      this.storageError.set(String(e));
    }
    const done = () => {
      this._ready.set(true);
      void this.seedOnFirstRun();
    };
    if (persistence) persistence.whenSynced.then(done, done);
    else done();
  }

  summary(id: string): Signal<BoardSummary | undefined> {
    return this.summaries.get(id);
  }

  has(id: string): boolean {
    return this.index.has(id);
  }

  async createBoard(content: BoardContent, options: { binary?: Uint8Array; id?: string } = {}): Promise<string> {
    const id = options.id ?? newId(10);
    const doc = createBoardDoc();
    let final = content;
    if (options.binary) {
      final = decodeBinaryInto(doc, options.binary);
    } else {
      new BoardCommands(doc, { origin: SYSTEM_ORIGIN }).applyContent(content, 'Board created');
      doc.transact(() => {
        boardTypes(doc).history.push([{ ts: Date.now(), by: 'System', color: '#64748b', label: 'Board created', snapshot: Y.encodeSnapshot(Y.snapshot(doc)) }]);
      }, HISTORY_ORIGIN);
    }
    if (!this.storageError()) await persistNewBoardDoc(id, doc);
    doc.destroy();
    const now = Date.now();
    this.index.set(id, entity({ title: content.title || final.title, createdAt: now, updatedAt: now, cardCount: final.cards.length, noteCount: final.notes.length }));
    return id;
  }

  renameBoard(id: string, title: string): void {
    const clean = title.trim();
    const entry = this.index.get(id);
    if (!entry || !clean || entry.get('title') === clean) return;
    this.doc.transact(() => {
      entry.set('title', clean);
      entry.set('updatedAt', Date.now());
    });
  }

  /** Called by an open board session after local edits. */
  touch(id: string, stats: { cardCount: number; noteCount: number }): void {
    const entry = this.index.get(id);
    if (!entry) return;
    this.doc.transact(() => {
      entry.set('updatedAt', Date.now());
      if (entry.get('cardCount') !== stats.cardCount) entry.set('cardCount', stats.cardCount);
      if (entry.get('noteCount') !== stats.noteCount) entry.set('noteCount', stats.noteCount);
    });
  }

  /** Registers a board that exists elsewhere (joined via P2P) with an empty local doc. */
  registerRemoteBoard(id: string, title = 'Shared board'): void {
    if (this.index.has(id)) return;
    const now = Date.now();
    this.index.set(id, entity({ title, createdAt: now, updatedAt: now, cardCount: 0, noteCount: 0 }));
  }

  async loadContent(id: string): Promise<{ content: BoardContent; binary: Uint8Array }> {
    const doc = createBoardDoc();
    try {
      await loadBoardDoc(id, doc);
      const content = { ...readBoard(doc), title: this.summaries.peek(id)?.title ?? readBoard(doc).title };
      return { content, binary: encodeBinary(doc) };
    } finally {
      doc.destroy();
    }
  }

  async duplicateBoard(id: string): Promise<string> {
    const { content } = await this.loadContent(id);
    return this.createBoard({ ...content, title: `${content.title} (copy)` });
  }

  deleteBoard(id: string): void {
    if (!this.index.has(id)) return;
    this.index.delete(id);
    deleteBoardDb(id);
  }

  async createDemoBoard(): Promise<string> {
    return this.createBoard(demoBoard());
  }

  private async seedOnFirstRun(): Promise<void> {
    try {
      if (this.index.size > 0 || localStorage.getItem(SEEDED_KEY)) return;
      localStorage.setItem(SEEDED_KEY, '1');
    } catch {
      if (this.index.size > 0) return;
    }
    await this.createDemoBoard();
  }
}
