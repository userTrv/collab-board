import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Peer } from '../../data/presence';

/** Live cursors of other tabs/peers, drawn in the coordinate space of the parent layer. */
@Component({
  selector: 'app-remote-cursors',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (peer of peers(); track peer.clientId) {
      @if (peer.cursor; as c) {
        <div class="cursor" [style.transform]="'translate(' + c.x + 'px,' + c.y + 'px) scale(' + 1 / scale() + ')'" [style.--c]="peer.user.color">
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M2 1.5l13 6.2-5.6 1.6L7 15z" /></svg>
          <span class="name">{{ peer.user.name }}</span>
        </div>
      }
    }
  `,
  host: { 'aria-hidden': 'true' },
  styles: `
    :host {
      position: absolute;
      inset: 0 auto auto 0;
      width: 0;
      height: 0;
      pointer-events: none;
      z-index: 20;
    }
    .cursor {
      position: absolute;
      left: 0;
      top: 0;
      transform-origin: 0 0;
      transition: transform 80ms linear;
      will-change: transform;
    }
    svg path {
      fill: var(--c);
      stroke: #fff;
      stroke-width: 1.2;
    }
    .name {
      position: absolute;
      left: 14px;
      top: 14px;
      padding: 1px 6px;
      border-radius: 4px;
      background: var(--c);
      color: #fff;
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
    }
  `,
})
export class RemoteCursors {
  readonly peers = input.required<readonly Peer[]>();
  /** Parent layer zoom, so cursors keep a constant on-screen size. */
  readonly scale = input(1);
}
