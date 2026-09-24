import { Dialog } from '@angular/cdk/dialog';
import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { WorkspaceService } from '../../data/workspace.service';
import { BoardSummary } from '../../domain/model';
import { spreadRanks } from '../../domain/rank';
import { stressBoard } from '../../domain/seed';
import { ImportError, parseExportJson, toExportJson } from '../../domain/serialize';
import { newId } from '../../domain/id';
import { ConfirmDialog, ConfirmData } from '../../shared/confirm-dialog';
import { downloadBlob, slugify } from '../../shared/download';
import { Autofocus } from '../../shared/autofocus';
import { Icon } from '../../shared/icon';
import { RelativeTimePipe } from '../../shared/relative-time.pipe';

const TIP_KEY = 'cb.tip.dismissed';

@Component({
  selector: 'app-boards-page',
  imports: [RouterLink, Icon, CdkMenuTrigger, CdkMenu, CdkMenuItem, RelativeTimePipe, DatePipe, Autofocus],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './boards-page.html',
  styleUrl: './boards-page.scss',
})
export class BoardsPage {
  protected readonly workspace = inject(WorkspaceService);
  private readonly router = inject(Router);
  private readonly dialog = inject(Dialog);

  protected readonly renaming = signal<string | null>(null);
  protected readonly busy = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly showTip = signal(!this.readFlag(TIP_KEY));

  protected async createBoard(): Promise<void> {
    const ranks = spreadRanks(3);
    const id = await this.workspace.createBoard({
      title: 'Untitled board',
      columns: ['To do', 'Doing', 'Done'].map((title, i) => ({ id: newId(), title, rank: ranks[i], wipLimit: null })),
      cards: [],
      notes: [],
      connectors: [],
    });
    await this.router.navigate(['/b', id]);
  }

  protected async createStressBoard(): Promise<void> {
    this.busy.set('Generating 1,000 cards…');
    try {
      const t0 = performance.now();
      const id = await this.workspace.createBoard(stressBoard(1000));
      console.info(`[perf] stress board created and persisted in ${Math.round(performance.now() - t0)} ms`);
      await this.router.navigate(['/b', id]);
    } finally {
      this.busy.set(null);
    }
  }

  protected async createDemo(): Promise<void> {
    const id = await this.workspace.createDemoBoard();
    await this.router.navigate(['/b', id]);
  }

  protected rename(board: BoardSummary, title: string): void {
    this.workspace.renameBoard(board.id, title);
    this.renaming.set(null);
  }

  protected async duplicate(board: BoardSummary): Promise<void> {
    await this.workspace.duplicateBoard(board.id);
  }

  protected async remove(board: BoardSummary): Promise<void> {
    const ref = this.dialog.open<boolean, ConfirmData>(ConfirmDialog, {
      data: { title: `Delete “${board.title}”?`, message: 'The board and its history are removed from this browser. Other tabs showing it will close it. This cannot be undone.', confirm: 'Delete board', danger: true },
      ariaLabelledBy: 'confirm-title',
    });
    if (await firstValueFrom(ref.closed)) this.workspace.deleteBoard(board.id);
  }

  protected async export(board: BoardSummary, format: 'json' | 'yjs'): Promise<void> {
    const { content, binary } = await this.workspace.loadContent(board.id);
    if (format === 'json') downloadBlob(toExportJson(content), `${slugify(board.title)}.board.json`, 'application/json');
    else downloadBlob(binary as Uint8Array<ArrayBuffer>, `${slugify(board.title)}.yjs`, 'application/octet-stream');
  }

  protected async import(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.error.set(null);
    try {
      let id: string;
      if (file.name.endsWith('.json')) {
        id = await this.workspace.createBoard(parseExportJson(await file.text()));
      } else {
        const bytes = new Uint8Array(await file.arrayBuffer());
        // The title comes from the update itself (meta.title); the file name is only a fallback.
        const fallback = file.name.replace(/\.(yjs|bin)$/, '') || 'Imported board';
        id = await this.workspace.createBoard({ title: '', columns: [], cards: [], notes: [], connectors: [] }, { binary: bytes, fallbackTitle: fallback });
      }
      await this.router.navigate(['/b', id]);
    } catch (e) {
      this.error.set(e instanceof ImportError ? e.message : `Import failed: ${String(e)}`);
    }
  }

  protected dismissTip(): void {
    this.showTip.set(false);
    try {
      localStorage.setItem(TIP_KEY, '1');
    } catch {
      /* ignore */
    }
  }

  private readFlag(key: string): boolean {
    try {
      return !!localStorage.getItem(key);
    } catch {
      return false;
    }
  }
}
