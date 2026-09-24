import { LiveAnnouncer } from '@angular/cdk/a11y';
import { afterNextRender, ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, Injector, signal, viewChild } from '@angular/core';
import { BoardSession } from '../../data/board-session';
import { NoteColor } from '../../domain/model';
import { GRID, snap as snapTo } from '../../domain/whiteboard-commands';
import { RemoteCursors } from '../board/remote-cursors';
import { ConnectorLayer } from './connector-layer';
import { CanvasGestures } from './canvas-gestures';
import { boundsOf, fitTo, Point, Rect, toWorld, Viewport, zoomAt } from './viewport';
import { WhiteboardNote } from './whiteboard-note';
import { WhiteboardToolbar } from './whiteboard-toolbar';

const SNAP_KEY = 'cb.snap';

/**
 * Whiteboard view: DOM notes + SVG connectors inside one transformed "world" layer.
 * Viewport and selection are local UI state; notes and connectors live in the Y.Doc.
 */
@Component({
  selector: 'app-whiteboard',
  imports: [WhiteboardNote, ConnectorLayer, WhiteboardToolbar, RemoteCursors],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './whiteboard.html',
  styleUrl: './whiteboard.scss',
})
export class Whiteboard {
  readonly session = inject(BoardSession);
  private readonly announcer = inject(LiveAnnouncer);
  private readonly injector = inject(Injector);
  readonly canvas = viewChild.required<ElementRef<HTMLElement>>('canvas');

  readonly viewport = signal<Viewport>({ x: 0, y: 0, zoom: 1 });
  readonly selection = signal<ReadonlySet<string>>(new Set());
  readonly selectedConnector = signal<string | null>(null);
  readonly editingId = signal<string | null>(null);
  readonly tool = signal<'select' | 'hand'>('select');
  readonly snap = signal(this.readSnap());
  readonly marquee = signal<Rect | null>(null);
  readonly pendingLink = signal<{ from: string; to: Point } | null>(null);
  readonly linkTarget = signal<string | null>(null);

  protected readonly noteIds = this.session.store.noteIds;
  protected readonly worldTransform = computed(() => {
    const v = this.viewport();
    return `translate(${v.x}px, ${v.y}px) scale(${v.zoom})`;
  });
  protected readonly gridStyle = computed(() => {
    const v = this.viewport();
    const size = GRID * v.zoom;
    return { 'background-size': `${size}px ${size}px`, 'background-position': `${v.x}px ${v.y}px` };
  });
  protected readonly cursorPeers = computed(() => this.session.presence.peers().filter((p) => p.cursor?.view === 'whiteboard'));
  protected readonly zoomPercent = computed(() => Math.round(this.viewport().zoom * 100));

  readonly gestures = new CanvasGestures(this);

  constructor() {
    effect(() => {
      try {
        localStorage.setItem(SNAP_KEY, this.snap() ? '1' : '0');
      } catch {
        /* ignore */
      }
    });
    // Drop selections of notes that someone else deleted.
    effect(() => {
      const ids = new Set(this.noteIds());
      const sel = this.selection();
      if ([...sel].some((id) => !ids.has(id))) this.selection.set(new Set([...sel].filter((id) => ids.has(id))));
    });
    afterNextRender(() => this.fit());
  }

  // ---------- coordinates ----------

  screenPoint(event: { clientX: number; clientY: number }): Point {
    const rect = this.canvas().nativeElement.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  worldPoint(event: { clientX: number; clientY: number }): Point {
    return toWorld(this.viewport(), this.screenPoint(event));
  }

  noteRect(id: string): Rect | null {
    const n = this.session.store.note(id)();
    return n ? { x: n.x, y: n.y, w: n.w, h: n.h } : null;
  }

  // ---------- actions (toolbar, keyboard, gestures) ----------

  addNote(at?: Point): void {
    const canvas = this.canvas().nativeElement;
    const centre = at ?? toWorld(this.viewport(), { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 });
    const x = centre.x - 100;
    const y = centre.y - 70;
    const id = this.session.whiteboard.addNote({ x: this.snap() ? snapTo(x) : x, y: this.snap() ? snapTo(y) : y, color: 'yellow' });
    this.selection.set(new Set([id]));
    this.editingId.set(id);
  }

  setColor(color: NoteColor): void {
    this.session.whiteboard.setNoteColor([...this.selection()], color);
  }

  linkSelected(): void {
    const [a, b] = [...this.selection()];
    if (a && b && this.session.whiteboard.connect(a, b)) void this.announcer.announce('Notes connected');
  }

  deleteSelection(): void {
    const connector = this.selectedConnector();
    if (connector) {
      this.session.whiteboard.deleteConnector(connector);
      this.selectedConnector.set(null);
      return;
    }
    const ids = [...this.selection()];
    if (!ids.length) return;
    this.session.whiteboard.deleteNotes(ids);
    this.selection.set(new Set());
    void this.announcer.announce(ids.length === 1 ? 'Note deleted' : `${ids.length} notes deleted`);
  }

  zoomBy(factor: number, anchor?: Point): void {
    const canvas = this.canvas().nativeElement;
    this.viewport.update((v) => zoomAt(v, anchor ?? { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 }, v.zoom * factor));
  }

  resetZoom(): void {
    this.zoomBy(1 / this.viewport().zoom);
  }

  /** Fits all notes below the floating toolbar; on small screens keeps notes readable (min 45%). */
  fit(): void {
    const canvas = this.canvas().nativeElement;
    const top = (canvas.parentElement?.querySelector('app-whiteboard-toolbar')?.getBoundingClientRect().height ?? 0) + 16;
    const bounds = boundsOf(
      this.noteIds()
        .map((id) => this.noteRect(id))
        .filter((r): r is Rect => r !== null),
    );
    const v = fitTo(bounds, canvas.clientWidth, canvas.clientHeight - top, 32);
    if (bounds && v.zoom < 0.45) this.viewport.set({ zoom: 0.45, x: 16 - bounds.x * 0.45, y: top + 16 - bounds.y * 0.45 });
    else this.viewport.set({ ...v, y: v.y + top });
  }

  /** Leaves edit mode and puts focus back on the note, so keyboard users don't lose their place. */
  stopEditing(id: string): void {
    if (this.editingId() !== id) return;
    this.editingId.set(null);
    afterNextRender(() => this.canvas().nativeElement.querySelector<HTMLElement>(`[data-note-id="${id}"]`)?.focus({ preventScroll: true }), { injector: this.injector });
  }

  selectAll(): void {
    this.selection.set(new Set(this.noteIds()));
  }

  /** Arrow-key nudge: one grid step with snapping, 10px without (Shift = ×5). */
  nudge(dx: number, dy: number, big: boolean): void {
    const ids = [...this.selection()];
    if (!ids.length) return;
    const step = (this.snap() ? GRID : 10) * (big ? 5 : 1);
    this.session.whiteboard.moveNotes(ids, dx * step, dy * step, this.snap() ? GRID : undefined);
  }

  private readSnap(): boolean {
    try {
      return localStorage.getItem(SNAP_KEY) !== '0';
    } catch {
      return true;
    }
  }
}
