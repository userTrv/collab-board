import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { BoardSession } from '../../../data/board-session';
import { LABELS, TEAM } from '../../../domain/team';
import { Avatar } from '../../../shared/avatar';
import { Icon } from '../../../shared/icon';
import { renderMarkdown } from '../../../shared/markdown';
import { YTextDirective } from '../../../shared/y-text.directive';
import { KanbanActions } from '../kanban-actions';
import { CardChecklist } from './card-checklist';
import { CardComments } from './card-comments';

export interface CardDialogData {
  readonly cardId: string;
}

@Component({
  selector: 'app-card-dialog',
  imports: [Icon, Avatar, YTextDirective, CardChecklist, CardComments],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './card-dialog.html',
  styleUrl: './card-dialog.scss',
})
export class CardDialog {
  private readonly data = inject<CardDialogData>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef);
  protected readonly session = inject(BoardSession);
  private readonly actions = inject(KanbanActions);
  protected readonly labels = LABELS;
  protected readonly team = TEAM;

  protected readonly cardId = this.data.cardId;
  protected readonly card = this.session.store.card(this.cardId);
  protected readonly columns = computed(() =>
    this.session.store
      .columnOrder()
      .map((id) => this.session.store.column(id)())
      .filter((c) => !!c),
  );
  protected readonly currentColumn = computed(() => this.session.store.columnOrder().find((c) => this.session.store.cardIdsByColumn().get(c)?.includes(this.cardId)));
  protected readonly others = computed(() => this.actions.editorsByCard().get(this.cardId) ?? []);
  protected readonly description = this.session.kanban.descriptionText(this.cardId);
  protected readonly preview = signal(false);
  protected readonly previewHtml = computed(() => renderMarkdown(this.card()?.description ?? ''));

  constructor() {
    this.session.presence.setEditing(this.cardId);
    this.session.undo.stopCapturing();
    inject(DestroyRef).onDestroy(() => this.session.presence.setEditing(null));
  }

  protected rename(title: string): void {
    if (title.trim() && title.trim() !== this.card()?.title) this.session.kanban.updateCard(this.cardId, { title });
  }

  protected moveTo(columnId: string): void {
    this.session.kanban.moveCard(this.cardId, columnId, Number.MAX_SAFE_INTEGER);
  }

  protected setAssignee(id: string): void {
    this.session.kanban.updateCard(this.cardId, { assigneeId: id || null });
  }

  protected setDue(value: string): void {
    this.session.kanban.updateCard(this.cardId, { due: value || null });
  }

  protected toggleLabel(id: string): void {
    this.session.kanban.toggleLabel(this.cardId, id);
  }

  protected remove(): void {
    this.session.kanban.deleteCard(this.cardId);
    this.ref.close();
  }
}
