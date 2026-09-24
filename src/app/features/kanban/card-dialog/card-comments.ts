import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { BoardSession } from '../../../data/board-session';
import { CardComment } from '../../../domain/model';
import { Avatar } from '../../../shared/avatar';

@Component({
  selector: 'app-card-comments',
  imports: [Avatar, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-labelledby="comments-h">
      <h3 id="comments-h">Comments</h3>
      <form (submit)="$event.preventDefault(); add(text)">
        <textarea #text class="input" rows="2" placeholder="Write a comment… (Ctrl/⌘+Enter to post)" aria-label="New comment"
          (keydown.control.enter)="add(text)" (keydown.meta.enter)="add(text)"></textarea>
        <button type="submit" class="btn sm primary">Comment</button>
      </form>
      <ol>
        @for (c of newestFirst(); track c.id) {
          <li>
            <app-avatar [name]="c.author" [color]="c.color" [size]="26" />
            <div>
              <div class="meta"><strong>{{ c.author }}</strong> <span class="muted">{{ c.createdAt | date: 'MMM d, HH:mm' }}</span></div>
              <p>{{ c.text }}</p>
            </div>
          </li>
        } @empty {
          <li class="muted empty">No comments yet.</li>
        }
      </ol>
    </section>
  `,
  styles: `
    h3 {
      font-size: 13px;
      margin-bottom: 8px;
    }
    form {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 6px;
    }
    ol {
      list-style: none;
      margin: 12px 0 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    li {
      display: flex;
      gap: 10px;
    }
    .meta {
      display: flex;
      gap: 6px;
      font-size: 12px;
    }
    p {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .empty {
      font-size: 13px;
    }
  `,
})
export class CardComments {
  readonly cardId = input.required<string>();
  readonly comments = input.required<readonly CardComment[]>();
  private readonly session = inject(BoardSession);

  protected readonly newestFirst = computed(() => [...this.comments()].reverse());

  protected add(text: HTMLTextAreaElement): void {
    this.session.kanban.addComment(this.cardId(), text.value);
    text.value = '';
  }
}
