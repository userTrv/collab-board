import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

export interface ConfirmData {
  readonly title: string;
  readonly message: string;
  readonly confirm: string;
  readonly danger?: boolean;
}

@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog" style="width: min(420px, calc(100vw - 24px))">
      <div class="dialog-head"><h2 id="confirm-title" style="font-size: 16px">{{ data.title }}</h2></div>
      <div class="dialog-body">
        <p>{{ data.message }}</p>
      </div>
      <div class="dialog-foot">
        <button type="button" class="btn" (click)="ref.close(false)">Cancel</button>
        <button type="button" class="btn" [class.primary]="!data.danger" [class.danger]="data.danger" cdkFocusInitial (click)="ref.close(true)">{{ data.confirm }}</button>
      </div>
    </div>
  `,
})
export class ConfirmDialog {
  protected readonly data = inject<ConfirmData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
}
