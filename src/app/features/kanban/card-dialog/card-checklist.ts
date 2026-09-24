import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { BoardSession } from '../../../data/board-session';
import { ChecklistItem } from '../../../domain/model';
import { Icon } from '../../../shared/icon';

@Component({
  selector: 'app-card-checklist',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-labelledby="checklist-h">
      <div class="head">
        <h3 id="checklist-h">Checklist</h3>
        @if (items().length) {
          <span class="muted">{{ done() }}/{{ items().length }}</span>
        }
      </div>
      @if (items().length) {
        <div class="bar" role="progressbar" [attr.aria-valuenow]="done()" aria-valuemin="0" [attr.aria-valuemax]="items().length" aria-label="Checklist progress">
          <span [style.width.%]="(done() / items().length) * 100"></span>
        </div>
      }
      <ul>
        @for (item of items(); track item.id) {
          <li>
            <label>
              <input type="checkbox" [checked]="item.done" (change)="toggle(item.id)" />
              <span [class.done]="item.done">{{ item.text }}</span>
            </label>
            <button type="button" class="btn ghost icon sm" [attr.aria-label]="'Remove ' + item.text" (click)="remove(item.id)"><app-icon name="x" [size]="14" /></button>
          </li>
        }
      </ul>
      <form (submit)="$event.preventDefault(); add(newItem)">
        <input #newItem class="input" placeholder="Add an item and press Enter" aria-label="New checklist item" />
      </form>
    </section>
  `,
  styles: `
    .head {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      h3 {
        font-size: 13px;
      }
    }
    .bar {
      height: 4px;
      border-radius: 2px;
      background: var(--surface-3);
      margin-bottom: 8px;
      overflow: hidden;
      span {
        display: block;
        height: 100%;
        background: var(--success);
        transition: width 0.2s;
      }
    }
    ul {
      list-style: none;
      margin: 0 0 8px;
      padding: 0;
    }
    li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 2px 0;
      label {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
        cursor: pointer;
      }
      input {
        accent-color: var(--primary);
      }
    }
    .done {
      text-decoration: line-through;
      color: var(--text-faint);
    }
  `,
})
export class CardChecklist {
  readonly cardId = input.required<string>();
  readonly items = input.required<readonly ChecklistItem[]>();
  private readonly session = inject(BoardSession);
  protected readonly done = computed(() => this.items().filter((i) => i.done).length);

  protected add(input: HTMLInputElement): void {
    this.session.kanban.addChecklistItem(this.cardId(), input.value);
    input.value = '';
  }

  protected toggle(id: string): void {
    this.session.kanban.toggleChecklistItem(this.cardId(), id);
  }

  protected remove(id: string): void {
    this.session.kanban.removeChecklistItem(this.cardId(), id);
  }
}
