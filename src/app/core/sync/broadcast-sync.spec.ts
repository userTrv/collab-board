import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';
import { BroadcastSync, ChannelFactory, ChannelLike } from './broadcast-sync';

/** In-memory BroadcastChannel: synchronous delivery to every other open channel with the same name. */
function memoryBus(): ChannelFactory {
  const channels = new Map<string, Set<ChannelLike>>();
  return (name) => {
    const peers = channels.get(name) ?? new Set<ChannelLike>();
    channels.set(name, peers);
    const channel: ChannelLike = {
      onmessage: null,
      postMessage(message) {
        for (const other of [...peers]) if (other !== channel) other.onmessage?.({ data: message });
      },
      close() {
        peers.delete(channel);
      },
    };
    peers.add(channel);
    return channel;
  };
}

function tab(bus: ChannelFactory, name = 'board') {
  const doc = new Y.Doc();
  const awareness = new Awareness(doc);
  const sync = new BroadcastSync(doc, awareness, name, bus);
  return { doc, awareness, sync, text: doc.getText('t') };
}

describe('BroadcastSync (cross-tab provider)', () => {
  it('propagates live updates between connected tabs', () => {
    const bus = memoryBus();
    const a = tab(bus);
    const b = tab(bus);
    a.sync.connect();
    b.sync.connect();
    a.text.insert(0, 'hello');
    expect(b.text.toString()).toBe('hello');
    b.text.insert(5, ' world');
    expect(a.text.toString()).toBe('hello world');
  });

  it('a late-joining tab receives the existing state and contributes its own', () => {
    const bus = memoryBus();
    const a = tab(bus);
    a.sync.connect();
    a.text.insert(0, 'A');
    const b = tab(bus);
    b.text.insert(0, 'B'); // offline edit before joining
    b.sync.connect();
    expect(a.text.toString()).toBe(b.text.toString());
    expect(a.text.toString()).toHaveLength(2);
  });

  it('ignores other boards (channel names are per board)', () => {
    const bus = memoryBus();
    const a = tab(bus, 'board-1');
    const b = tab(bus, 'board-2');
    a.sync.connect();
    b.sync.connect();
    a.text.insert(0, 'x');
    expect(b.text.toString()).toBe('');
  });

  it('offline edits merge on reconnect', () => {
    const bus = memoryBus();
    const a = tab(bus);
    const b = tab(bus);
    a.sync.connect();
    b.sync.connect();
    a.text.insert(0, 'base');
    b.sync.disconnect();
    a.text.insert(4, '-A');
    b.text.insert(0, 'B-');
    expect(a.text.toString()).not.toBe(b.text.toString());
    b.sync.connect();
    expect(a.text.toString()).toBe('B-base-A');
    expect(b.text.toString()).toBe('B-base-A');
  });

  it('shares awareness and removes a tab’s presence when it disconnects', () => {
    const bus = memoryBus();
    const a = tab(bus);
    const b = tab(bus);
    a.awareness.setLocalState({ user: { name: 'A' } });
    b.awareness.setLocalState({ user: { name: 'B' } });
    a.sync.connect();
    b.sync.connect();
    expect(a.awareness.getStates().get(b.doc.clientID)).toEqual({ user: { name: 'B' } });
    expect(b.awareness.getStates().get(a.doc.clientID)).toEqual({ user: { name: 'A' } });
    b.sync.disconnect();
    expect(a.awareness.getStates().has(b.doc.clientID)).toBe(false);
    b.sync.connect();
    expect(a.awareness.getStates().get(b.doc.clientID)).toEqual({ user: { name: 'B' } });
  });
});
