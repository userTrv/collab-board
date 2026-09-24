import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { BoardSession } from '../../data/board-session';
import { P2PSettingsService } from '../../data/p2p-settings.service';
import { WorkspaceService } from '../../data/workspace.service';
import { toExportJson } from '../../domain/serialize';
import { downloadBlob, slugify } from '../../shared/download';
import { Icon } from '../../shared/icon';
import { HistoryPanel } from '../history/history-panel';
import { BoardPreview } from '../history/board-preview';
import { PresenceBar } from './presence-bar';

@Component({
  selector: 'app-board-page',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, CdkMenu, CdkMenuItem, CdkMenuTrigger, PresenceBar, HistoryPanel, BoardPreview],
  providers: [BoardSession],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './board-page.html',
  styleUrl: './board-page.scss',
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class BoardPage {
  protected readonly session = inject(BoardSession);
  protected readonly workspace = inject(WorkspaceService);
  private readonly p2pSettings = inject(P2PSettingsService);
  private readonly router = inject(Router);

  protected readonly historyOpen = signal(false);
  protected readonly previewIndex = signal<number | null>(null);
  protected readonly preview = computed(() => {
    const i = this.previewIndex();
    return i === null ? null : this.session.history.contentAt(i);
  });
  protected readonly p2pEnabled = computed(() => this.p2pSettings.settings().enabled && !!this.p2pSettings.settings().signalingUrl);
  protected readonly missing = computed(() => this.workspace.ready() && !this.session.summary());

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );
  protected readonly view = computed(() => (this.url().endsWith('/whiteboard') ? 'whiteboard' : 'kanban'));

  constructor() {
    effect(() => {
      const view = this.historyOpen() ? 'history' : this.view();
      untracked(() => this.session.presence.setView(view));
    });
    effect(() => {
      const settings = this.p2pSettings.settings();
      untracked(() => void this.session.p2p.apply(settings));
    });
  }

  protected toggleHistory(): void {
    this.historyOpen.update((open) => !open);
    if (!this.historyOpen()) this.previewIndex.set(null);
  }

  protected closeHistory(): void {
    this.historyOpen.set(false);
    this.previewIndex.set(null);
  }

  protected restore(index: number): void {
    if (this.session.restore(index)) this.closeHistory();
  }

  protected openInNewTab(): void {
    window.open(location.href, '_blank', 'noopener');
  }

  protected exportJson(): void {
    downloadBlob(toExportJson(this.session.content()), `${slugify(this.session.title())}.board.json`, 'application/json');
  }

  protected exportBinary(): void {
    downloadBlob(this.session.binary() as Uint8Array<ArrayBuffer>, `${slugify(this.session.title())}.yjs`, 'application/octet-stream');
  }

  protected rename(title: string): void {
    if (title.trim() && title.trim() !== this.session.title()) this.session.rename(title);
  }

  protected joinShared(): void {
    this.workspace.registerRemoteBoard(this.session.id);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === 'z' && !event.shiftKey) {
      event.preventDefault();
      this.session.undo.undo();
    } else if ((key === 'z' && event.shiftKey) || key === 'y') {
      event.preventDefault();
      this.session.undo.redo();
    }
  }
}
