import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
}

@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `{{ letters() }}`,
  host: {
    role: 'img',
    '[attr.aria-label]': 'name()',
    '[attr.title]': 'title() ?? name()',
    '[style.--avatar-bg]': 'color()',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
    '[style.font-size.px]': 'size() * 0.4',
    '[class.ring]': 'ring()',
  },
  styles: `
    :host {
      display: inline-grid;
      place-items: center;
      flex: none;
      border-radius: 50%;
      background: var(--avatar-bg);
      color: #fff;
      font-weight: 700;
      letter-spacing: 0.02em;
      user-select: none;
    }
    :host(.ring) {
      box-shadow:
        0 0 0 2px var(--surface),
        0 0 0 4px var(--avatar-bg);
    }
  `,
})
export class Avatar {
  readonly name = input.required<string>();
  readonly color = input('#64748b');
  readonly size = input(24);
  readonly ring = input(false);
  readonly title = input<string | null>(null);
  protected readonly letters = computed(() => initials(this.name()));
}
