import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HistoryEntry } from '../../data/history-recorder';
import { Icon } from '../../shared/icon';

/**
 * Time-travel drawer: a slider and list over shared history snapshots. Selecting an entry
 * previews it read-only; "Restore" writes that state back as a new, undoable edit.
 */
@Component({
  selector: 'app-history-panel',
  imports: [Icon, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './history-panel.html',
  styleUrl: './history-panel.scss',
  host: { role: 'complementary', 'aria-label': 'Board history', '(keydown.escape)': 'closed.emit()' },
})
export class HistoryPanel {
  readonly entries = input.required<readonly HistoryEntry[]>();
  /** Index of the previewed entry, null = live board. */
  readonly selected = model<number | null>(null);
  readonly restore = output<number>();
  readonly closed = output<void>();

  protected readonly newestFirst = computed(() => [...this.entries()].reverse());
  protected readonly sliderValue = computed(() => this.selected() ?? this.entries().length);
  protected readonly selectedEntry = computed(() => {
    const i = this.selected();
    return i === null ? null : (this.entries()[i] ?? null);
  });

  protected onSlider(value: number): void {
    this.selected.set(value >= this.entries().length ? null : value);
  }
}
