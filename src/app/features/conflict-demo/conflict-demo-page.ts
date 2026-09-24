import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import * as Y from 'yjs';
import { BoardCommands } from '../../domain/board-commands';
import { BoardContent } from '../../domain/model';
import { SYSTEM_ORIGIN } from '../../domain/origins';
import { createBoardDoc } from '../../domain/schema';
import { Icon } from '../../shared/icon';
import { DemoReplica, REMOTE } from './demo-replica';
import { mergeReport, ReportLine } from './merge-report';
import { ReplicaPanel } from './replica-panel';
import { demoBase, SCENARIO } from './scenario';

interface SyncStats {
  readonly aToB: number;
  readonly bToA: number;
}

/**
 * Two in-memory replicas of the same board with a simulated network between them. Go offline,
 * make conflicting edits on both (or play the scripted scenario), reconnect and see how Yjs
 * merged each conflict — and that both replicas end up byte-for-byte identical.
 */
@Component({
  selector: 'app-conflict-demo-page',
  imports: [ReplicaPanel, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './conflict-demo-page.html',
  styleUrl: './conflict-demo-page.scss',
})
export class ConflictDemoPage {
  protected readonly replicas = signal<readonly [DemoReplica, DemoReplica]>(this.createReplicas());
  protected readonly online = signal(true);
  protected readonly step = signal<number | null>(null);
  protected readonly playing = signal(false);
  protected readonly report = signal<readonly ReportLine[] | null>(null);
  protected readonly lastSync = signal<SyncStats | null>(null);
  protected readonly scenario = SCENARIO;
  private readonly version = signal(0);
  private baseAtDisconnect: BoardContent | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private unlink: (() => void) | null = null;

  protected readonly converged = computed(() => {
    this.version();
    const [a, b] = this.replicas();
    return JSON.stringify(a.content()) === JSON.stringify(b.content()) && Y.encodeStateVector(a.doc).join() === Y.encodeStateVector(b.doc).join();
  });
  protected readonly pending = computed(() => this.replicas()[0].pendingOps() + this.replicas()[1].pendingOps());

  constructor() {
    this.link();
    inject(DestroyRef).onDestroy(() => {
      this.stopTimers();
      this.unlink?.();
      this.replicas().forEach((r) => r.destroy());
    });
  }

  protected goOffline(): void {
    this.baseAtDisconnect = this.replicas()[0].content();
    this.online.set(false);
    this.report.set(null);
    this.lastSync.set(null);
  }

  /** Exchanges exactly the missing updates in both directions (what any Yjs provider does on reconnect). */
  protected reconnect(): void {
    const [a, b] = this.replicas();
    const [preA, preB] = [a.content(), b.content()];
    const [aToB, bToA] = [a.diffFor(b), b.diffFor(a)];
    Y.applyUpdate(b.doc, aToB, REMOTE);
    Y.applyUpdate(a.doc, bToA, REMOTE);
    a.pendingOps.set(0);
    b.pendingOps.set(0);
    this.online.set(true);
    this.step.set(null);
    this.lastSync.set({ aToB: aToB.byteLength, bToA: bToA.byteLength });
    if (this.baseAtDisconnect) this.report.set(mergeReport(this.baseAtDisconnect, preA, preB, a.content()));
    this.version.update((v) => v + 1);
  }

  protected reset(): void {
    this.stopTimers();
    this.unlink?.();
    this.replicas().forEach((r) => r.destroy());
    this.replicas.set(this.createReplicas());
    this.online.set(true);
    this.report.set(null);
    this.lastSync.set(null);
    this.step.set(null);
    this.playing.set(false);
    this.link();
  }

  protected play(): void {
    this.reset();
    this.goOffline();
    this.playing.set(true);
    SCENARIO.forEach((s, i) => {
      this.timers.push(
        setTimeout(() => {
          const [a, b] = this.replicas();
          this.step.set(i);
          s.run(s.replica === 'A' ? a.kanban : b.kanban);
          if (i === SCENARIO.length - 1) this.playing.set(false);
        }, 700 * (i + 1)),
      );
    });
  }

  private createReplicas(): readonly [DemoReplica, DemoReplica] {
    const seed = createBoardDoc();
    new BoardCommands(seed, { origin: SYSTEM_ORIGIN }).applyContent(demoBase());
    const base = Y.encodeStateAsUpdate(seed);
    seed.destroy();
    return [new DemoReplica('A', 1, base), new DemoReplica('B', 2, base)];
  }

  /** The simulated network: forwards updates live while online, counts them while offline. */
  private link(): void {
    const [a, b] = this.replicas();
    const forward = (from: DemoReplica, to: DemoReplica) => (update: Uint8Array, origin: unknown) => {
      this.version.update((v) => v + 1);
      if (origin === REMOTE) return;
      if (this.online()) Y.applyUpdate(to.doc, update, REMOTE);
      else from.pendingOps.update((n) => n + 1);
    };
    const [ab, ba] = [forward(a, b), forward(b, a)];
    a.doc.on('update', ab);
    b.doc.on('update', ba);
    this.unlink = () => {
      a.doc.off('update', ab);
      b.doc.off('update', ba);
    };
  }

  private stopTimers(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }
}
