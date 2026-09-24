import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const MESSAGE_QUERY_AWARENESS = 3;

/** The subset of BroadcastChannel we use — lets tests plug in an in-memory bus. */
export interface ChannelLike {
  postMessage(message: Uint8Array): void;
  close(): void;
  onmessage: ((event: { data: unknown }) => void) | null;
}

export type ChannelFactory = (name: string) => ChannelLike;

const browserChannel: ChannelFactory = (name) => new BroadcastChannel(name) as unknown as ChannelLike;

/**
 * Syncs a Y.Doc (and its Awareness) between browser tabs of the same origin with
 * BroadcastChannel, using the standard y-protocols wire format (sync step 1/2 + updates,
 * awareness updates). No server involved, so it works on a plain static host.
 *
 * Handshake (same as y-webrtc's BroadcastChannel path): on connect a tab posts its state
 * vector (step 1) and its full state (step 2). Peers apply the state and answer the step 1
 * with exactly the updates the newcomer is missing, so everyone ends up with the union.
 */
export class BroadcastSync {
  private channel: ChannelLike | null = null;
  private savedLocalState: Record<string, unknown> | null = null;
  private readonly onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === this) return; // do not echo what we received
    this.post((enc) => {
      encoding.writeVarUint(enc, MESSAGE_SYNC);
      syncProtocol.writeUpdate(enc, update);
    });
  };
  private readonly onAwarenessUpdate = (changes: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
    if (origin === this) return;
    const clients = [...changes.added, ...changes.updated, ...changes.removed];
    this.post((enc) => {
      encoding.writeVarUint(enc, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(enc, awarenessProtocol.encodeAwarenessUpdate(this.awareness, clients));
    });
  };

  constructor(
    readonly doc: Y.Doc,
    readonly awareness: awarenessProtocol.Awareness,
    readonly name: string,
    private readonly factory: ChannelFactory = browserChannel,
  ) {}

  get connected(): boolean {
    return this.channel !== null;
  }

  connect(): void {
    if (this.channel) return;
    const channel = this.factory(this.name);
    channel.onmessage = (event) => this.receive(event.data);
    this.channel = channel;
    this.doc.on('update', this.onDocUpdate);
    this.awareness.on('update', this.onAwarenessUpdate);
    if (this.savedLocalState && this.awareness.getLocalState() === null) {
      this.awareness.setLocalState(this.savedLocalState);
    }
    this.post((enc) => {
      encoding.writeVarUint(enc, MESSAGE_SYNC);
      syncProtocol.writeSyncStep1(enc, this.doc);
    });
    this.post((enc) => {
      encoding.writeVarUint(enc, MESSAGE_SYNC);
      syncProtocol.writeSyncStep2(enc, this.doc);
    });
    this.post((enc) => encoding.writeVarUint(enc, MESSAGE_QUERY_AWARENESS));
    this.broadcastLocalAwareness();
  }

  /** Simulates going offline (used by the UI toggle): stop sending and receiving. */
  disconnect(): void {
    if (!this.channel) return;
    // Tell the other tabs we left so our cursor/avatar disappears immediately.
    this.savedLocalState = this.awareness.getLocalState();
    awarenessProtocol.removeAwarenessStates(this.awareness, [this.doc.clientID], 'disconnect');
    this.post((enc) => {
      encoding.writeVarUint(enc, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(enc, awarenessProtocol.encodeAwarenessUpdate(this.awareness, [this.doc.clientID]));
    });
    this.doc.off('update', this.onDocUpdate);
    this.awareness.off('update', this.onAwarenessUpdate);
    this.channel.onmessage = null;
    this.channel.close();
    this.channel = null;
  }

  destroy(): void {
    this.disconnect();
  }

  private broadcastLocalAwareness(): void {
    if (this.awareness.getLocalState() === null) return;
    this.post((enc) => {
      encoding.writeVarUint(enc, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(enc, awarenessProtocol.encodeAwarenessUpdate(this.awareness, [this.doc.clientID]));
    });
  }

  private post(write: (enc: encoding.Encoder) => void): void {
    if (!this.channel) return;
    const enc = encoding.createEncoder();
    write(enc);
    this.channel.postMessage(encoding.toUint8Array(enc));
  }

  private receive(data: unknown): void {
    if (!(data instanceof Uint8Array) || !this.channel) return;
    const dec = decoding.createDecoder(data);
    const type = decoding.readVarUint(dec);
    switch (type) {
      case MESSAGE_SYNC: {
        const reply = encoding.createEncoder();
        encoding.writeVarUint(reply, MESSAGE_SYNC);
        const kind = syncProtocol.readSyncMessage(dec, reply, this.doc, this);
        // readSyncMessage wrote a step 2 into `reply` when the message was a step 1.
        if (kind === syncProtocol.messageYjsSyncStep1) this.channel.postMessage(encoding.toUint8Array(reply));
        break;
      }
      case MESSAGE_AWARENESS:
        awarenessProtocol.applyAwarenessUpdate(this.awareness, decoding.readVarUint8Array(dec), this);
        break;
      case MESSAGE_QUERY_AWARENESS:
        this.broadcastLocalAwareness();
        break;
    }
  }
}
