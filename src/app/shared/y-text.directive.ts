import { Directive, effect, ElementRef, inject, input } from '@angular/core';
import * as Y from 'yjs';
import { bindTextField } from '../core/crdt/y-text-binding';

/** `<textarea [appYText]="text">` — collaborative text field bound to a Y.Text. */
@Directive({ selector: 'textarea[appYText], input[appYText]' })
export class YTextDirective {
  readonly text = input.required<Y.Text | null>({ alias: 'appYText' });
  private readonly el = inject<ElementRef<HTMLTextAreaElement | HTMLInputElement>>(ElementRef).nativeElement;

  constructor() {
    effect((onCleanup) => {
      const text = this.text();
      if (!text) return;
      onCleanup(bindTextField(this.el, text));
    });
  }
}
