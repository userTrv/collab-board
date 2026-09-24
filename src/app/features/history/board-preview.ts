import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input } from '@angular/core';
import { boundsOf, fitTo } from '../whiteboard/viewport';
import { BoardContent } from '../../domain/model';
import { cardsByColumn } from '../../domain/read';
import { labelById, memberById } from '../../domain/team';

/** Read-only rendering of a board state (history preview, conflict demo). */
@Component({
  selector: 'app-board-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="banner" role="status">Read-only preview · {{ content().cards.length }} cards · {{ content().notes.length }} notes</div>
    @if (view() === 'whiteboard') {
      <div class="canvas">
        <div class="world" [style.transform]="'scale(' + fit().zoom + ')'" [style.left.px]="fit().x" [style.top.px]="fit().y">
          @for (n of content().notes; track n.id) {
            <div class="note note-{{ n.color }}" [style.left.px]="n.x" [style.top.px]="n.y" [style.width.px]="n.w" [style.height.px]="n.h">{{ n.text }}</div>
          }
        </div>
      </div>
    } @else {
    <div class="columns">
      @for (col of columns(); track col.column.id) {
        <section class="column" [attr.aria-label]="col.column.title">
          <h3>{{ col.column.title }} <span class="muted">{{ col.cards.length }}</span></h3>
          @for (card of col.cards; track card.id) {
            <div class="card">
              @if (card.labels.length) {
                <div class="labels">
                  @for (l of card.labels; track l) {
                    <span class="chip label-chip label-{{ label(l)?.color }}">{{ label(l)?.name }}</span>
                  }
                </div>
              }
              <div>{{ card.title }}</div>
              @if (member(card.assigneeId); as m) {
                <div class="muted small">{{ m.name }}</div>
              }
            </div>
          }
        </section>
      }
    </div>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 0;
      background: repeating-linear-gradient(-45deg, transparent 0 12px, color-mix(in srgb, var(--primary) 4%, transparent) 12px 24px);
    }
    .banner {
      padding: 8px 16px;
      background: var(--primary-soft);
      color: var(--primary);
      font-weight: 600;
      font-size: 13px;
    }
    .columns {
      flex: 1;
      display: flex;
      gap: 12px;
      padding: 16px;
      overflow: auto;
      align-items: flex-start;
    }
    .column {
      width: 260px;
      flex: none;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    h3 {
      font-size: 13px;
    }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 8px 10px;
    }
    .labels {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
      margin-bottom: 4px;
    }
    .small {
      font-size: 12px;
    }
    .canvas {
      position: relative;
      flex: 1;
      overflow: hidden;
    }
    .world {
      position: absolute;
      transform-origin: 0 0;
    }
    .note {
      position: absolute;
      padding: 12px 14px;
      border-radius: 4px 4px 14px 4px;
      color: var(--note-text);
      font-size: 15px;
      white-space: pre-wrap;
      overflow: hidden;
      box-shadow: 0 1px 2px rgb(0 0 0 / 12%);
    }
    @each $c in 'yellow', 'pink', 'blue', 'green', 'purple' {
      .note-#{$c} {
        background: var(--note-#{$c});
      }
    }
  `,
})
export class BoardPreview {
  readonly content = input.required<BoardContent>();
  readonly view = input<'kanban' | 'whiteboard'>('kanban');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  /** Whiteboard preview: fit all notes into the available area. */
  protected readonly fit = computed(() => fitTo(boundsOf(this.content().notes), this.host.clientWidth || 800, (this.host.clientHeight || 600) - 40));
  protected readonly columns = computed(() => {
    const grouped = cardsByColumn(this.content());
    return this.content().columns.map((column) => ({ column, cards: grouped.get(column.id) ?? [] }));
  });
  protected readonly label = labelById;
  protected readonly member = memberById;
}
