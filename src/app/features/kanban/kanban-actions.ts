import { LiveAnnouncer } from '@angular/cdk/a11y';
import { Dialog } from '@angular/cdk/dialog';
import { afterNextRender, computed, inject, Injectable, Injector } from '@angular/core';
import { BoardSession } from '../../data/board-session';
import { Peer } from '../../data/presence';
import { CardDialog, CardDialogData } from './card-dialog/card-dialog';

/**
 * Kanban interactions shared by columns and card tiles (provided by KanbanBoard): opening the
 * card dialog, pointer and keyboard moves with screen-reader announcements.
 */
@Injectable()
export class KanbanActions {
  private readonly session = inject(BoardSession);
  private readonly dialog = inject(Dialog);
  private readonly injector = inject(Injector);
  private readonly announcer = inject(LiveAnnouncer);

  /**
   * cardId -> peers editing it. Only notifies when the *editing* mapping changes, not on every
   * remote cursor move, so 1,000 tiles don't re-evaluate while someone waves their mouse.
   */
  readonly editorsByCard = computed(
    () => {
      const map = new Map<string, Peer[]>();
      for (const p of this.session.presence.peers()) if (p.editing) map.set(p.editing, [...(map.get(p.editing) ?? []), p]);
      return map;
    },
    { equal: (a, b) => a.size === b.size && [...a].every(([k, v]) => b.get(k)?.map((p) => p.clientId + p.user.name).join() === v.map((p) => p.clientId + p.user.name).join()) },
  );

  open(cardId: string): void {
    if (this.dialog.openDialogs.length) return;
    this.dialog.open<void, CardDialogData>(CardDialog, {
      data: { cardId },
      injector: this.injector,
      ariaLabelledBy: 'card-dialog-title',
      maxHeight: '100dvh',
    });
  }

  /** Pointer drop (CDK drag & drop). `index` is the position among the target's other cards. */
  drop(cardId: string, columnId: string, index: number): void {
    this.session.kanban.moveCard(cardId, columnId, index);
    this.announcePosition(cardId);
  }

  /** Keyboard move: Alt+↑/↓ within the column, Alt+←/→ to neighbouring columns. */
  moveBy(cardId: string, columnDelta: number, indexDelta: number): void {
    const store = this.session.store;
    const order = store.columnOrder();
    const byColumn = store.cardIdsByColumn();
    const fromColumn = order.find((c) => byColumn.get(c)?.includes(cardId));
    if (!fromColumn) return;
    const fromIndex = byColumn.get(fromColumn)!.indexOf(cardId);
    const toColumn = order[order.indexOf(fromColumn) + columnDelta];
    if (!toColumn) {
      this.announcer.announce(columnDelta < 0 ? 'Already in the first column' : 'Already in the last column');
      return;
    }
    const siblings = (byColumn.get(toColumn) ?? []).filter((id) => id !== cardId);
    const toIndex = columnDelta === 0 ? fromIndex + indexDelta : Math.min(fromIndex, siblings.length);
    if (toIndex < 0 || toIndex > siblings.length) {
      this.announcer.announce(indexDelta < 0 ? 'Already at the top' : 'Already at the bottom');
      return;
    }
    this.session.kanban.moveCard(cardId, toColumn, toIndex);
    this.announcePosition(cardId);
    afterNextRender(() => document.querySelector<HTMLElement>(`[data-card-id="${cardId}"]`)?.focus(), { injector: this.injector });
  }

  private announcePosition(cardId: string): void {
    const store = this.session.store;
    const column = store.columnOrder().find((c) => store.cardIdsByColumn().get(c)?.includes(cardId));
    if (!column) return;
    const list = store.cardIdsByColumn().get(column)!;
    const title = store.card(cardId)()?.title ?? 'Card';
    void this.announcer.announce(`${title} moved to ${store.column(column)()?.title}, position ${list.indexOf(cardId) + 1} of ${list.length}`);
  }
}
