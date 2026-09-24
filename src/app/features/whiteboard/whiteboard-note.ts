import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { BoardSession } from '../../data/board-session';
import { Autofocus } from '../../shared/autofocus';

/** One sticky note. Pointer gestures are handled by the canvas (event delegation via data attributes). */
@Component({
  selector: 'app-whiteboard-note',
  imports: [Autofocus],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (note(); as n) {
      @if (editing()) {
        <textarea class="text" [value]="n.text" [appAutofocus]="true" aria-label="Note text" (input)="setText($any($event.target).value)" (blur)="done.emit()"
          (keydown.escape)="done.emit()" (keydown.control.enter)="done.emit()" (keydown.meta.enter)="done.emit()"></textarea>
      } @else {
        <p class="text" [class.placeholder]="!n.text">{{ n.text || 'Double-click to write' }}</p>
      }
      <span class="handle connect" data-handle="connect" title="Drag to another note to connect them" aria-hidden="true"></span>
      <span class="handle resize" data-handle="resize" title="Drag to resize" aria-hidden="true"></span>
    }
  `,
  styleUrl: './whiteboard-note.scss',
  host: {
    tabindex: '0',
    role: 'button',
    '[attr.data-note-id]': 'noteId()',
    '[attr.aria-label]': 'label()',
    '[attr.aria-pressed]': 'selected()',
    '[class]': '"note-" + (note()?.color ?? "yellow")',
    '[class.selected]': 'selected()',
    '[class.editing]': 'editing()',
    '[class.link-target]': 'linkTarget()',
    '[style.transform]': 'transform()',
    '[style.width.px]': 'note()?.w',
    '[style.height.px]': 'note()?.h',
    '[style.z-index]': 'note()?.z',
  },
})
export class WhiteboardNote {
  readonly noteId = input.required<string>();
  readonly selected = input(false);
  readonly editing = input(false);
  readonly linkTarget = input(false);
  readonly done = output<void>();

  private readonly session = inject(BoardSession);
  protected readonly note = computed(() => this.session.store.note(this.noteId())());
  protected readonly transform = computed(() => {
    const n = this.note();
    return n ? `translate(${n.x}px, ${n.y}px)` : null;
  });
  protected readonly label = computed(() => `Sticky note: ${this.note()?.text || 'empty'}. Enter to edit, arrow keys to move, Delete to remove.`);

  protected setText(text: string): void {
    this.session.whiteboard.setNoteText(this.noteId(), text);
  }
}
