import { snap as snapTo } from '../../domain/whiteboard-commands';
import { intersects, normalizeRect, Point, Viewport, zoomAt } from './viewport';
import type { Whiteboard } from './whiteboard';

type Gesture =
  | { kind: 'pan'; start: Point; origin: Viewport }
  | { kind: 'marquee'; start: Point; base: ReadonlySet<string> }
  | { kind: 'drag'; start: Point; origins: Map<string, Point>; moved: boolean; clicked: string; additive: boolean }
  | { kind: 'connect'; from: string }
  | { kind: 'resize'; id: string; start: Point; w: number; h: number }
  | { kind: 'pinch'; distance: number; zoom: number };

/**
 * Pointer/keyboard state machine for the whiteboard canvas. Uses event delegation
 * (data-note-id / data-handle / data-connector-id attributes) instead of per-note listeners.
 */
export class CanvasGestures {
  private gesture: Gesture | null = null;
  private readonly pointers = new Map<number, Point>();
  private spaceHeld = false;
  private frame = 0;
  private pendingPositions: { id: string; x: number; y: number }[] | null = null;

  constructor(private readonly wb: Whiteboard) {}

  pointerDown(e: PointerEvent): void {
    const target = e.target as Element;
    if (target.closest('textarea, button, input')) return;
    const canvas = this.wb.canvas().nativeElement;
    canvas.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, this.wb.screenPoint(e));
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.gesture = { kind: 'pinch', distance: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.wb.viewport().zoom };
      return;
    }
    const world = this.wb.worldPoint(e);
    const noteEl = target.closest<HTMLElement>('[data-note-id]');
    const handle = target.closest<HTMLElement>('[data-handle]')?.dataset['handle'];
    const connectorId = target.closest('[data-connector-id]')?.getAttribute('data-connector-id');
    const panRequested = e.button === 1 || this.spaceHeld || this.wb.tool() === 'hand';

    if (noteEl && !panRequested) {
      const id = noteEl.dataset['noteId']!;
      this.wb.selectedConnector.set(null);
      if (handle === 'connect') {
        this.gesture = { kind: 'connect', from: id };
        this.wb.pendingLink.set({ from: id, to: world });
        return;
      }
      if (handle === 'resize') {
        const r = this.wb.noteRect(id)!;
        this.gesture = { kind: 'resize', id, start: world, w: r.w, h: r.h };
        return;
      }
      if (this.wb.editingId() !== id) this.wb.editingId.set(null);
      const sel = new Set(this.wb.selection());
      if (e.shiftKey && sel.has(id)) sel.delete(id);
      else if (e.shiftKey) sel.add(id);
      else if (!sel.has(id)) {
        sel.clear();
        sel.add(id);
      }
      this.wb.selection.set(sel);
      const origins = new Map<string, Point>();
      for (const sid of sel) {
        const r = this.wb.noteRect(sid);
        if (r) origins.set(sid, { x: r.x, y: r.y });
      }
      this.gesture = { kind: 'drag', start: world, origins, moved: false, clicked: id, additive: e.shiftKey };
      return;
    }
    this.wb.editingId.set(null);
    if (connectorId && !panRequested) {
      this.wb.selection.set(new Set());
      this.wb.selectedConnector.set(connectorId);
      return;
    }
    this.wb.selectedConnector.set(null);
    if (panRequested || e.pointerType === 'touch') {
      this.gesture = { kind: 'pan', start: this.wb.screenPoint(e), origin: this.wb.viewport() };
      return;
    }
    const base = e.shiftKey ? this.wb.selection() : new Set<string>();
    this.wb.selection.set(base);
    this.gesture = { kind: 'marquee', start: world, base };
  }

  pointerMove(e: PointerEvent): void {
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, this.wb.screenPoint(e));
    const world = this.wb.worldPoint(e);
    if (e.pointerType !== 'touch') this.wb.session.presence.setCursor({ ...world, view: 'whiteboard' });
    const g = this.gesture;
    if (!g) return;
    switch (g.kind) {
      case 'pinch': {
        if (this.pointers.size < 2) return;
        const [a, b] = [...this.pointers.values()];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        this.wb.viewport.update((v) => zoomAt(v, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, (g.zoom * distance) / g.distance));
        break;
      }
      case 'pan': {
        const p = this.wb.screenPoint(e);
        this.wb.viewport.set({ ...g.origin, x: g.origin.x + p.x - g.start.x, y: g.origin.y + p.y - g.start.y });
        break;
      }
      case 'marquee': {
        const rect = normalizeRect(g.start, world);
        this.wb.marquee.set(rect);
        const hits = this.wb.session.store.noteIds().filter((id) => {
          const r = this.wb.noteRect(id);
          return r && intersects(rect, r);
        });
        this.wb.selection.set(new Set([...g.base, ...hits]));
        break;
      }
      case 'drag': {
        const [dx, dy] = [world.x - g.start.x, world.y - g.start.y];
        if (!g.moved && Math.hypot(dx, dy) * this.wb.viewport().zoom < 4) return;
        if (!g.moved) {
          g.moved = true;
          this.wb.session.undo.stopCapturing();
          this.wb.session.whiteboard.bringToFront([...g.origins.keys()]);
        }
        const snap = this.wb.snap();
        this.schedulePlace([...g.origins].map(([id, o]) => ({ id, x: snap ? snapTo(o.x + dx) : o.x + dx, y: snap ? snapTo(o.y + dy) : o.y + dy })));
        break;
      }
      case 'connect': {
        this.wb.pendingLink.set({ from: g.from, to: world });
        const over = this.noteAt(e);
        this.wb.linkTarget.set(over && over !== g.from ? over : null);
        break;
      }
      case 'resize': {
        const snap = this.wb.snap();
        const w = g.w + world.x - g.start.x;
        const h = g.h + world.y - g.start.y;
        this.wb.session.whiteboard.resizeNote(g.id, snap ? snapTo(w) : w, snap ? snapTo(h) : h);
        break;
      }
    }
  }

  pointerUp(e: PointerEvent): void {
    this.pointers.delete(e.pointerId);
    const g = this.gesture;
    if (g?.kind === 'pinch' && this.pointers.size > 0) return;
    this.gesture = null;
    this.flushPlace();
    if (g?.kind === 'connect') {
      const to = this.noteAt(e);
      if (to && to !== g.from) this.wb.session.whiteboard.connect(g.from, to);
    }
    if (g?.kind === 'drag' && !g.moved && !g.additive) this.wb.selection.set(new Set([g.clicked]));
    this.wb.pendingLink.set(null);
    this.wb.linkTarget.set(null);
    this.wb.marquee.set(null);
  }

  pointerLeave(): void {
    this.wb.session.presence.setCursor(null);
  }

  doubleClick(e: MouseEvent): void {
    const noteEl = (e.target as Element).closest<HTMLElement>('[data-note-id]');
    if (noteEl) this.wb.editingId.set(noteEl.dataset['noteId']!);
    else if (!(e.target as Element).closest('[data-connector-id], app-whiteboard-toolbar')) this.wb.addNote(this.wb.worldPoint(e));
  }

  wheel(e: WheelEvent): void {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      this.wb.zoomBy(Math.exp(-e.deltaY * 0.01), this.wb.screenPoint(e));
    } else {
      this.wb.viewport.update((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    }
  }

  keydown(e: KeyboardEvent): void {
    if ((e.target as Element).closest('textarea, input')) return;
    const mod = e.metaKey || e.ctrlKey;
    const arrows: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (e.key === ' ') {
      this.spaceHeld = true;
      e.preventDefault();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      this.wb.deleteSelection();
    } else if (e.key === 'Escape') {
      this.wb.selection.set(new Set());
      this.wb.selectedConnector.set(null);
    } else if (e.key === 'Enter' && this.wb.selection().size === 1) {
      e.preventDefault();
      this.wb.editingId.set([...this.wb.selection()][0]);
    } else if (arrows[e.key] && this.wb.selection().size) {
      e.preventDefault();
      this.wb.nudge(...arrows[e.key], e.shiftKey);
    } else if (mod && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      this.wb.selectAll();
    } else if (!mod && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === 'n') this.wb.addNote();
      else if (k === 'v') this.wb.tool.set('select');
      else if (k === 'h') this.wb.tool.set('hand');
      else if (k === 'f') this.wb.fit();
      else if (k === '+' || k === '=') this.wb.zoomBy(1.25);
      else if (k === '-') this.wb.zoomBy(1 / 1.25);
      else return;
      e.preventDefault();
    }
  }

  keyup(e: KeyboardEvent): void {
    if (e.key === ' ') this.spaceHeld = false;
  }

  /** Keyboard focus on a note selects it (so arrows/Delete act on it). */
  focusIn(e: FocusEvent): void {
    const id = (e.target as Element).closest<HTMLElement>('[data-note-id]')?.dataset['noteId'];
    if (id && !this.wb.selection().has(id)) this.wb.selection.set(new Set([id]));
  }

  private noteAt(e: PointerEvent): string | null {
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-note-id]');
    return el?.dataset['noteId'] ?? null;
  }

  /** Coalesces drag writes to one Yjs transaction per animation frame. */
  private schedulePlace(positions: { id: string; x: number; y: number }[]): void {
    this.pendingPositions = positions;
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => this.flushPlace());
  }

  private flushPlace(): void {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    if (this.pendingPositions) this.wb.session.whiteboard.placeNotes(this.pendingPositions);
    this.pendingPositions = null;
  }
}
