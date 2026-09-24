import { Dialog } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { IdentityService } from './core/identity/identity.service';
import { ThemeService } from './core/ui/theme.service';
import { WorkspaceService } from './data/workspace.service';
import { SettingsDialog } from './features/settings/settings-dialog';
import { Avatar } from './shared/avatar';
import { Icon } from './shared/icon';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, Avatar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly theme = inject(ThemeService);
  protected readonly identity = inject(IdentityService);
  protected readonly workspace = inject(WorkspaceService);
  private readonly dialog = inject(Dialog);

  protected openSettings(): void {
    this.dialog.open(SettingsDialog, { ariaLabelledBy: 'settings-title' });
  }
}
