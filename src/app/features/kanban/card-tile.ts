import { CdkDrag } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input } from '@angular/core';
import { BoardSession } from '../../data/board-session';
import { labelById, memberById } from '../../domain/team';
import { Avatar } from '../../shared/avatar';
import { Icon } from '../../shared/icon';
import { KanbanActions } from './kanban-actions';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');
/** Local calendar date as yyyy-mm-dd (due dates are plain dates, not instants). */
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * One card on the board. Reads only its own card signal, so an edit to another card never
 * re-renders this one.
 */
@Component({
  selector: 'app-card-tile',
  imports: [Avatar, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './card-tile.html',
  styleUrl: './card-tile.scss',
  host: {
    tabindex: '0',
    '[attr.data-card-id]': 'cardId()',
    '[attr.aria-label]': 'ariaLabel()',
    'aria-roledescription': 'card. Press Enter to open, Alt plus arrow keys to move',
    '[class.being-edited]': 'editors().length > 0',
    '[style.--editor]': 'editors()[0]?.user?.color',
    '(click)': 'onClick()',
    '(keydown)': 'onKeydown($event)',
  },
})
export class CardTile {
  readonly cardId = input.required<string>();
  private readonly session = inject(BoardSession);
  private readonly actions = inject(KanbanActions);
  private readonly drag = inject(CdkDrag, { optional: true });
  private lastDragEnd = 0;

  protected readonly card = computed(() => this.session.store.card(this.cardId())());
  protected readonly labels = computed(() => (this.card()?.labels ?? []).map(labelById).filter((l) => !!l));
  protected readonly assignee = computed(() => memberById(this.card()?.assigneeId ?? null));
  protected readonly checklist = computed(() => {
    const items = this.card()?.checklist ?? [];
    return items.length ? { done: items.filter((i) => i.done).length, total: items.length } : null;
  });
  protected readonly dueState = computed(() => {
    const due = this.card()?.due;
    if (!due) return null;
    const t = today();
    return due < t ? 'overdue' : due === t ? 'today' : 'later';
  });
  protected readonly editors = computed(() => this.actions.editorsByCard().get(this.cardId()) ?? []);
  protected readonly ariaLabel = computed(() => {
    const c = this.card();
    if (!c) return 'Card';
    const parts = [c.title];
    if (this.labels().length) parts.push(`labels ${this.labels().map((l) => l.name).join(', ')}`);
    if (this.assignee()) parts.push(`assigned to ${this.assignee()!.name}`);
    if (c.due) parts.push(`due ${c.due}${this.dueState() === 'overdue' ? ' (overdue)' : ''}`);
    if (this.editors().length) parts.push(`being edited by ${this.editors().map((p) => p.user.name).join(', ')}`);
    return parts.join(', ');
  });

  protected shortDate(iso: string): string {
    const [, m, d] = iso.split('-').map(Number);
    return `${MONTHS[m - 1] ?? '?'} ${d}`;
  }

  constructor() {
    const sub = this.drag?.ended.subscribe(() => (this.lastDragEnd = performance.now()));
    inject(DestroyRef).onDestroy(() => sub?.unsubscribe());
  }

  protected onClick(): void {
    // A drop also produces a click on the dragged element; don't open the dialog then.
    if (performance.now() - this.lastDragEnd < 250) return;
    this.actions.open(this.cardId());
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.target !== event.currentTarget) return;
    if ((event.key === 'Enter' || event.key === ' ') && !event.altKey) {
      event.preventDefault();
      this.actions.open(this.cardId());
      return;
    }
    if (!event.altKey) return;
    const moves: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    this.actions.moveBy(this.cardId(), move[0], move[1]);
  }
}
