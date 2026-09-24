import { computed, DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Awareness } from 'y-protocols/awareness';
import { IndexeddbPersistence } from 'y-indexeddb';
import * as Y from 'yjs';
import { IdentityService } from '../core/identity/identity.service';
import { BroadcastSync } from '../core/sync/broadcast-sync';
import { BoardCommands, CommandContext } from '../domain/board-commands';
import { BoardContent } from '../domain/model';
import { LOCAL_ORIGIN } from '../domain/origins';
import { readBoard } from '../domain/read';
import { createBoardDoc } from '../domain/schema';
import { WhiteboardCommands } from '../domain/whiteboard-commands';
import { BoardStore } from './board-store';
import { HistoryRecorder } from './history-recorder';
import { P2PConnection } from './p2p-connection';
import { boardChannelName, boardDbName } from './persistence';
import { PresenceController } from './presence';
import { UndoController } from './undo-controller';
import { WorkspaceService } from './workspace.service';

/**
 * Everything for one open board, scoped to the board route (provided by BoardPage):
 * Y.Doc + IndexedDB persistence + cross-tab sync + presence + undo + history + commands.
 */
@Injectable()
export class BoardSession {
  private readonly workspace = inject(WorkspaceService);
  private readonly identity = inject(IdentityService);

  readonly id: string = inject(ActivatedRoute).snapshot.paramMap.get('boardId') ?? '';
  readonly doc: Y.Doc = createBoardDoc();
  readonly summary = this.workspace.summary(this.id);
  readonly title = computed(() => this.summary()?.title ?? 'Board');
  /** False until IndexedDB has been read — avoids flashing an empty board. */
  readonly loaded = signal(false);
  /** Cross-tab sync on/off. Turning it off simulates being offline. */
  readonly online = signal(true);

  readonly store = new BoardStore(this.doc);
  readonly history: HistoryRecorder;
  readonly undo = new UndoController(this.doc);
  readonly presence: PresenceController;
  readonly kanban: BoardCommands;
  readonly whiteboard: WhiteboardCommands;
  readonly p2p: P2PConnection;

  private readonly awareness = new Awareness(this.doc);
  private readonly sync = new BroadcastSync(this.doc, this.awareness, boardChannelName(this.id));
  private readonly persistence = new IndexeddbPersistence(boardDbName(this.id), this.doc);
  private touchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const author = () => this.identity.me();
    this.history = new HistoryRecorder(this.doc, author);
    const ctx: CommandContext = { origin: LOCAL_ORIGIN, describe: (l) => this.history.describe(l), author };
    this.kanban = new BoardCommands(this.doc, ctx);
    this.whiteboard = new WhiteboardCommands(this.doc, ctx);
    this.presence = new PresenceController(this.awareness, this.identity.me());
    this.p2p = new P2PConnection(this.id, this.doc, this.awareness);

    this.persistence.whenSynced.then(() => this.loaded.set(true));
    this.sync.connect();

    effect(() => {
      const me = this.identity.me();
      untracked(() => this.presence.setUser(me));
    });

    // Keep the workspace index (counts, "updated" time) fresh after my own edits.
    const onLocalChange = (tr: Y.Transaction) => {
      if (tr.origin !== LOCAL_ORIGIN && !(tr.origin instanceof Y.UndoManager)) return;
      if (this.touchTimer) clearTimeout(this.touchTimer);
      this.touchTimer = setTimeout(() => this.workspace.touch(this.id, { cardCount: this.store.cardCount(), noteCount: this.store.noteCount() }), 800);
    };
    this.doc.on('afterTransaction', onLocalChange);

    inject(DestroyRef).onDestroy(() => {
      this.doc.off('afterTransaction', onLocalChange);
      if (this.touchTimer) clearTimeout(this.touchTimer);
      this.history.destroy();
      this.undo.destroy();
      this.p2p.destroy();
      this.sync.destroy();
      this.presence.destroy();
      this.store.destroy();
      void this.persistence.destroy();
      this.doc.destroy();
    });
  }

  setOnline(online: boolean): void {
    if (online) this.sync.connect();
    else this.sync.disconnect();
    this.online.set(online);
  }

  /** Current content, with the index title (the title lives in the workspace index). */
  content(): BoardContent {
    return { ...readBoard(this.doc), title: this.title() };
  }

  rename(title: string): void {
    this.workspace.renameBoard(this.id, title);
    this.kanban.setTitle(title);
  }

  restore(index: number): boolean {
    const past = this.history.contentAt(index);
    if (!past) return false;
    this.undo.stopCapturing();
    this.kanban.applyContent({ ...past, title: readBoard(this.doc).title }, `Restored version from ${new Date(this.history.entries()[index]?.ts ?? Date.now()).toLocaleTimeString()}`);
    return true;
  }

  binary(): Uint8Array {
    return Y.encodeStateAsUpdate(this.doc);
  }
}
