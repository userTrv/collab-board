import { afterNextRender, Directive, ElementRef, inject, input } from '@angular/core';

/** Focuses (and optionally selects) the element once it is rendered. */
@Directive({ selector: '[appAutofocus]' })
export class Autofocus {
  readonly select = input(false, { alias: 'appAutofocus', transform: (v: boolean | '') => v === '' || v });

  constructor() {
    const el = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
    afterNextRender(() => {
      el.focus();
      if (this.select()) el.select?.();
    });
  }
}
