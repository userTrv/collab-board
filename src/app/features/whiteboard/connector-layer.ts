import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { BoardSession } from '../../data/board-session';
import { center, edgePoint, Point, Rect } from './viewport';

interface Segment {
  readonly id: string;
  readonly a: Point;
  readonly b: Point;
}

/** Connectors drawn in world coordinates, clipped to the note edges, with arrowheads. */
@Component({
  // An attribute selector on <svg> keeps the SVG namespace for the connector markup.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'svg[appConnectorLayer]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg:defs>
      <svg:marker id="cb-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <svg:path d="M0 0L10 5L0 10z" class="arrow" />
      </svg:marker>
    </svg:defs>
    @for (s of segments(); track s.id) {
      <svg:g [attr.data-connector-id]="s.id" [class.selected]="s.id === selectedId()">
        <svg:line class="hit" [attr.x1]="s.a.x" [attr.y1]="s.a.y" [attr.x2]="s.b.x" [attr.y2]="s.b.y" />
        <svg:line class="line" [attr.x1]="s.a.x" [attr.y1]="s.a.y" [attr.x2]="s.b.x" [attr.y2]="s.b.y" marker-end="url(#cb-arrow)" />
      </svg:g>
    }
    @if (pending(); as p) {
      <svg:line class="line pending" [attr.x1]="p.a.x" [attr.y1]="p.a.y" [attr.x2]="p.b.x" [attr.y2]="p.b.y" marker-end="url(#cb-arrow)" />
    }
  `,
  styles: `
    :host {
      position: absolute;
      left: 0;
      top: 0;
      width: 1px;
      height: 1px;
      overflow: visible;
      pointer-events: none;
    }
    .line {
      stroke: var(--text-muted);
      stroke-width: 2;
      fill: none;
    }
    .arrow {
      fill: var(--text-muted);
    }
    .hit {
      stroke: transparent;
      stroke-width: 14;
      pointer-events: stroke;
      cursor: pointer;
    }
    .selected .line {
      stroke: var(--primary);
      stroke-width: 3;
    }
    .pending {
      stroke: var(--primary);
      stroke-dasharray: 6 5;
    }
  `,
})
export class ConnectorLayer {
  readonly selectedId = input<string | null>(null);
  readonly pendingLink = input<{ from: string; to: Point } | null>(null);
  private readonly store = inject(BoardSession).store;

  private rect(id: string): Rect | null {
    const n = this.store.note(id)();
    return n ? { x: n.x, y: n.y, w: n.w, h: n.h } : null;
  }

  protected readonly segments = computed<Segment[]>(() =>
    this.store.connectors().flatMap((c) => {
      const [from, to] = [this.rect(c.from), this.rect(c.to)];
      if (!from || !to) return [];
      return [{ id: c.id, a: edgePoint(from, center(to)), b: edgePoint(to, center(from)) }];
    }),
  );

  protected readonly pending = computed(() => {
    const link = this.pendingLink();
    const from = link && this.rect(link.from);
    return link && from ? { a: edgePoint(from, link.to), b: link.to } : null;
  });
}
