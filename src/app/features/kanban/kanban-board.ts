import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { BoardSession } from '../../data/board-session';
import { Autofocus } from '../../shared/autofocus';
import { Icon } from '../../shared/icon';
import { RemoteCursors } from '../board/remote-cursors';
import { KanbanActions } from './kanban-actions';
import { KanbanColumn } from './kanban-column';

@Component({
  selector: 'app-kanban-board',
  imports: [CdkDropList, CdkDrag, KanbanColumn, Icon, RemoteCursors, Autofocus],
  providers: [KanbanActions],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './kanban-board.html',
  styleUrl: './kanban-board.scss',
})
export class KanbanBoard {
  protected readonly session = inject(BoardSession);
  protected readonly store = this.session.store;
  protected readonly columnIds = this.store.columnOrder;
  protected readonly dropListIds = computed(() => this.columnIds().map((id) => `col-${id}`));
  protected readonly addingColumn = signal(false);
  protected readonly cursorPeers = computed(() => this.session.presence.peers().filter((p) => p.cursor?.view === 'kanban'));
  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');
  private frame = 0;

  protected dropColumn(event: CdkDragDrop<readonly string[]>): void {
    if (event.previousIndex !== event.currentIndex) this.session.kanban.moveColumn(event.item.data as string, event.currentIndex);
  }

  protected addColumn(title: string): void {
    if (!title.trim()) return;
    this.session.kanban.addColumn(title.trim());
    this.addingColumn.set(false);
  }

  /** Broadcast my cursor in content coordinates (throttled to one update per frame). */
  protected trackCursor(event: PointerEvent): void {
    if (event.pointerType === 'touch' || this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      const el = this.scroller().nativeElement;
      const rect = el.getBoundingClientRect();
      this.session.presence.setCursor({ x: event.clientX - rect.left + el.scrollLeft, y: event.clientY - rect.top + el.scrollTop, view: 'kanban' });
    });
  }

  protected clearCursor(): void {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.session.presence.setCursor(null);
  }
}
