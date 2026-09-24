import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { NoteColor } from '../../domain/model';
import { Icon } from '../../shared/icon';

export const NOTE_COLORS: readonly NoteColor[] = ['yellow', 'pink', 'blue', 'green', 'purple'];

@Component({
  selector: 'app-whiteboard-toolbar',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="group" role="group" aria-label="Tool">
      <button type="button" class="btn sm icon" [attr.aria-pressed]="tool() === 'select'" (click)="tool.set('select')" aria-label="Select tool" title="Select (V)"><app-icon name="pointer" /></button>
      <button type="button" class="btn sm icon" [attr.aria-pressed]="tool() === 'hand'" (click)="tool.set('hand')" aria-label="Pan tool" title="Pan (H, or hold Space)"><app-icon name="hand" /></button>
    </div>
    <button type="button" class="btn sm primary" (click)="addNote.emit()" title="Add a sticky note (N)"><app-icon name="plus" [size]="14" />Note</button>
    <div class="group colors" role="group" aria-label="Colour of selected notes">
      @for (c of colors; track c) {
        <button type="button" class="swatch note-{{ c }}" [disabled]="!selectionCount()" [attr.aria-label]="'Make selected notes ' + c" [title]="c" (click)="color.emit(c)"></button>
      }
    </div>
    <button type="button" class="btn sm" [disabled]="selectionCount() !== 2" (click)="link.emit()" title="Connect the two selected notes"><app-icon name="link" [size]="14" /><span class="hide-sm">Connect</span></button>
    <button type="button" class="btn sm icon danger" [disabled]="!canDelete()" (click)="remove.emit()" aria-label="Delete selection" title="Delete selection (Del)"><app-icon name="trash" /></button>
    <button type="button" class="btn sm" [attr.aria-pressed]="snap()" (click)="snap.set(!snap())" title="Snap notes to a 20px grid"><app-icon name="grid" [size]="14" /><span class="hide-sm">Snap</span></button>
    <div class="group" role="group" aria-label="Zoom">
      <button type="button" class="btn sm icon" (click)="zoomBy.emit(1 / 1.25)" aria-label="Zoom out" title="Zoom out (-)"><app-icon name="zoom-out" /></button>
      <button type="button" class="btn sm zoom" (click)="resetZoom.emit()" title="Reset to 100%" aria-label="Reset zoom">{{ zoomPercent() }}%</button>
      <button type="button" class="btn sm icon" (click)="zoomBy.emit(1.25)" aria-label="Zoom in" title="Zoom in (+)"><app-icon name="zoom-in" /></button>
      <button type="button" class="btn sm icon" (click)="fit.emit()" aria-label="Fit all notes" title="Fit all notes (F)"><app-icon name="fit" /></button>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      padding: 6px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
    }
    .group {
      display: flex;
      gap: 2px;
    }
    .colors {
      gap: 4px;
      padding: 0 4px;
    }
    .swatch {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 1px solid var(--border-strong);
      cursor: pointer;
      &:disabled {
        opacity: 0.35;
        cursor: default;
      }
    }
    @each $c in 'yellow', 'pink', 'blue', 'green', 'purple' {
      .note-#{$c} {
        background: var(--note-#{$c});
      }
    }
    .zoom {
      min-width: 52px;
      font-variant-numeric: tabular-nums;
    }
    @media (max-width: 720px) {
      .hide-sm {
        display: none;
      }
    }
  `,
})
export class WhiteboardToolbar {
  readonly tool = model.required<'select' | 'hand'>();
  readonly snap = model.required<boolean>();
  readonly selectionCount = input(0);
  readonly canDelete = input(false);
  readonly zoomPercent = input(100);
  readonly addNote = output<void>();
  readonly color = output<NoteColor>();
  readonly link = output<void>();
  readonly remove = output<void>();
  readonly zoomBy = output<number>();
  readonly resetZoom = output<void>();
  readonly fit = output<void>();
  protected readonly colors = NOTE_COLORS;
}
