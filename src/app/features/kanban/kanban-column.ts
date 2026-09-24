import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { Dialog } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BoardSession } from '../../data/board-session';
import { Autofocus } from '../../shared/autofocus';
import { ConfirmData, ConfirmDialog } from '../../shared/confirm-dialog';
import { Icon } from '../../shared/icon';
import { CardTile } from './card-tile';
import { KanbanActions } from './kanban-actions';

@Component({
  selector: 'app-kanban-column',
  imports: [CdkDropList, CdkDrag, CdkDragHandle, CdkMenu, CdkMenuItem, CdkMenuTrigger, CardTile, Icon, Autofocus],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './kanban-column.html',
  styleUrl: './kanban-column.scss',
  host: { role: 'group', '[attr.aria-label]': 'column()?.title' },
})
export class KanbanColumn {
  readonly columnId = input.required<string>();
  readonly connectedTo = input.required<string[]>();
  readonly index = input(0);
  readonly count = input(1);

  private readonly session = inject(BoardSession);
  private readonly dialog = inject(Dialog);
  protected readonly actions = inject(KanbanActions);

  protected readonly column = computed(() => this.session.store.column(this.columnId())());
  protected readonly cardIds = computed(() => this.session.store.columnCardIds(this.columnId())());
  protected readonly overLimit = computed(() => {
    const limit = this.column()?.wipLimit;
    return !!limit && this.cardIds().length > limit;
  });
  protected readonly adding = signal(false);
  protected readonly editingWip = signal(false);

  protected drop(event: CdkDragDrop<string>): void {
    if (event.previousContainer === event.container && event.previousIndex === event.currentIndex) return;
    this.actions.drop(event.item.data as string, this.columnId(), event.currentIndex);
  }

  protected rename(title: string): void {
    if (title.trim() && title.trim() !== this.column()?.title) this.session.kanban.renameColumn(this.columnId(), title);
  }

  protected addCard(input: HTMLTextAreaElement): void {
    const title = input.value.trim();
    if (!title) return;
    this.session.kanban.addCard(this.columnId(), { title });
    input.value = '';
    input.focus();
  }

  protected setWip(value: string): void {
    const n = Number.parseInt(value, 10);
    this.session.kanban.setWipLimit(this.columnId(), Number.isFinite(n) && n > 0 ? n : null);
    this.editingWip.set(false);
  }

  protected move(delta: number): void {
    this.session.kanban.moveColumn(this.columnId(), this.index() + delta);
  }

  protected async remove(): Promise<void> {
    const cards = this.cardIds().length;
    const ref = this.dialog.open<boolean, ConfirmData>(ConfirmDialog, {
      data: {
        title: `Delete column “${this.column()?.title}”?`,
        message: cards ? `Its ${cards} ${cards === 1 ? 'card' : 'cards'} will be deleted too. You can undo this.` : 'You can undo this.',
        confirm: 'Delete column',
        danger: true,
      },
      ariaLabelledBy: 'confirm-title',
    });
    if (await firstValueFrom(ref.closed)) this.session.kanban.deleteColumn(this.columnId());
  }
}
