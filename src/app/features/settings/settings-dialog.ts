import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { IdentityService, PRESENCE_COLORS } from '../../core/identity/identity.service';
import { isValidSignalingUrl, P2PSettingsService } from '../../data/p2p-settings.service';
import { Icon } from '../../shared/icon';

@Component({
  selector: 'app-settings-dialog',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings-dialog.html',
  styleUrl: './settings-dialog.scss',
})
export class SettingsDialog {
  private readonly identity = inject(IdentityService);
  private readonly p2pSettings = inject(P2PSettingsService);
  protected readonly ref = inject(DialogRef);
  protected readonly colors = PRESENCE_COLORS;

  protected readonly name = signal(this.identity.me().name);
  protected readonly color = signal(this.identity.me().color);
  protected readonly p2pEnabled = signal(this.p2pSettings.settings().enabled);
  protected readonly signalingUrl = signal(this.p2pSettings.settings().signalingUrl);
  protected readonly password = signal(this.p2pSettings.settings().password);
  protected readonly urlError = computed(() =>
    this.p2pEnabled() && !isValidSignalingUrl(this.signalingUrl()) ? 'Enter a ws:// or wss:// URL of a y-webrtc signaling server.' : null,
  );

  protected save(): void {
    if (this.urlError()) return;
    this.identity.update({ name: this.name(), color: this.color() });
    this.p2pSettings.save({ enabled: this.p2pEnabled(), signalingUrl: this.signalingUrl().trim(), password: this.password() });
    this.ref.close();
  }
}
