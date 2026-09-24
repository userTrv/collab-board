import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { Icon } from '../../shared/icon';
import { YTextDirective } from '../../shared/y-text.directive';
import { DemoReplica } from './demo-replica';
import { NOTES_CARD } from './scenario';

/** One simulated device: a mini kanban you can edit directly. */
@Component({
  selector: 'app-replica-panel',
  imports: [Icon, YTextDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './replica-panel.html',
  styleUrl: './replica-panel.scss',
  host: { '[attr.aria-label]': '"Replica " + replica().name' },
})
export class ReplicaPanel {
  readonly replica = input.required<DemoReplica>();
  readonly online = input(true);
  readonly label = input('');
  protected readonly notesId = NOTES_CARD;
  protected readonly renaming = signal<string | null>(null);

  protected readonly columns = computed(() => {
    const r = this.replica();
    return r.store
      .columnOrder()
      .map((id, index) => ({ id, index, title: r.store.column(id)()?.title ?? '', cards: r.store.columnCardIds(id)() }));
  });
  protected readonly notesText = computed(() => this.replica().kanban.descriptionText(NOTES_CARD));

  protected title(id: string): string {
    return this.replica().store.card(id)()?.title ?? '';
  }

  protected move(cardId: string, columnIndex: number): void {
    const target = this.columns()[columnIndex];
    if (target) this.replica().kanban.moveCard(cardId, target.id, 0);
  }

  protected rename(cardId: string, title: string): void {
    this.renaming.set(null);
    if (title.trim() && title.trim() !== this.title(cardId)) this.replica().kanban.updateCard(cardId, { title });
  }

  protected add(input: HTMLInputElement): void {
    if (!input.value.trim()) return;
    this.replica().kanban.addCard('todo', { title: input.value }, 0);
    input.value = '';
  }
}
