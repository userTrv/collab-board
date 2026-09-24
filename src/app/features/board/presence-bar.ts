import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Peer } from '../../data/presence';
import { Avatar } from '../../shared/avatar';

/** "Who is viewing" — one avatar per other tab/peer on this board. */
@Component({
  selector: 'app-presence-bar',
  imports: [Avatar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (peers().length) {
      <div class="stack" role="list" [attr.aria-label]="label()">
        @for (peer of visible(); track peer.clientId) {
          <app-avatar role="listitem" [name]="peer.user.name" [color]="peer.user.color" [size]="26" [ring]="true" [title]="describe(peer)" />
        }
        @if (overflow() > 0) {
          <span class="more">+{{ overflow() }}</span>
        }
      </div>
    } @else {
      <span class="alone" title="Open this board in another tab or window to collaborate">Only you</span>
    }
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
    }
    .stack {
      display: flex;
      padding-left: 6px;
      app-avatar {
        margin-left: -6px;
      }
    }
    .more {
      margin-left: 4px;
      font-size: 12px;
      color: var(--text-muted);
    }
    .alone {
      font-size: 12px;
      color: var(--text-faint);
      white-space: nowrap;
    }
  `,
})
export class PresenceBar {
  readonly peers = input.required<readonly Peer[]>();
  protected readonly visible = computed(() => this.peers().slice(0, 4));
  protected readonly overflow = computed(() => this.peers().length - 4);
  protected readonly label = computed(() => `${this.peers().length} other ${this.peers().length === 1 ? 'person' : 'people'} viewing`);

  protected describe(peer: Peer): string {
    const where = peer.view === 'whiteboard' ? 'on the whiteboard' : peer.view === 'history' ? 'browsing history' : 'on the kanban';
    return `${peer.user.name} — ${peer.editing ? 'editing a card' : where}`;
  }
}
