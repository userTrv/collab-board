import { signal } from '@angular/core';
import type { Awareness } from 'y-protocols/awareness';
import type { WebrtcProvider } from 'y-webrtc';
import type * as Y from 'yjs';
import { P2PSettings } from './p2p-settings.service';

export type P2PStatus = 'off' | 'connecting' | 'connected' | 'error';

/**
 * EXPERIMENTAL cross-device sync with y-webrtc. Loaded lazily (its code is not in the initial
 * bundle) and only when the user enables it with their own signaling server. Public signaling
 * servers come and go, so nothing in the app depends on this.
 */
export class P2PConnection {
  readonly status = signal<P2PStatus>('off');
  readonly peerCount = signal(0);
  readonly error = signal<string | null>(null);
  private provider: WebrtcProvider | null = null;
  private generation = 0;
  private poll: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly boardId: string,
    private readonly doc: Y.Doc,
    private readonly awareness: Awareness,
  ) {}

  async apply(settings: P2PSettings): Promise<void> {
    const gen = ++this.generation;
    this.stop();
    if (!settings.enabled || !settings.signalingUrl) return;
    this.status.set('connecting');
    this.error.set(null);
    try {
      const { WebrtcProvider } = await import('y-webrtc');
      if (gen !== this.generation) return;
      const provider = new WebrtcProvider(`collab-board-${this.boardId}`, this.doc, {
        signaling: [settings.signalingUrl],
        ...(settings.password ? { password: settings.password } : {}),
        awareness: this.awareness,
        // Our own BroadcastSync already covers tabs of this browser.
        filterBcConns: true,
      });
      this.provider = provider;
      // provider 'status' only says "looking for peers"; the signaling socket state is what
      // tells the user whether their server is reachable.
      this.poll = setInterval(() => {
        const up = provider.signalingConns.some((c) => c.connected);
        this.status.set(up ? 'connected' : 'connecting');
        // Count data channels that are actually open (the 'peers' event also lists pending ones).
        const conns = provider.room?.webrtcConns ?? new Map<string, { connected: boolean }>();
        this.peerCount.set([...conns.values()].filter((c) => c.connected).length);
      }, 1000);
    } catch (e) {
      this.status.set('error');
      this.error.set(e instanceof Error ? e.message : String(e));
    }
  }

  stop(): void {
    if (this.poll) clearInterval(this.poll);
    this.poll = null;
    this.provider?.destroy();
    this.provider = null;
    this.status.set('off');
    this.peerCount.set(0);
  }

  destroy(): void {
    this.generation++;
    this.stop();
  }
}
