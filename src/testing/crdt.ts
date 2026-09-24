import * as Y from 'yjs';
import { BoardCommands } from '../app/domain/board-commands';
import { BoardContent } from '../app/domain/model';
import { createBoardDoc } from '../app/domain/schema';
import { WhiteboardCommands } from '../app/domain/whiteboard-commands';

/** Test replica: a doc with its own client id and command objects. */
export interface Replica {
  doc: Y.Doc;
  kanban: BoardCommands;
  whiteboard: WhiteboardCommands;
}

export function replica(clientID?: number): Replica {
  const doc = createBoardDoc();
  if (clientID !== undefined) doc.clientID = clientID;
  return { doc, kanban: new BoardCommands(doc), whiteboard: new WhiteboardCommands(doc) };
}

/** Replicas that start from the same state (as if one was cloned from the other before going offline). */
export function forkedReplicas(count: number, content: BoardContent): Replica[] {
  const base = replica();
  base.kanban.applyContent(content);
  const state = Y.encodeStateAsUpdate(base.doc);
  return Array.from({ length: count }, (_, i) => {
    const r = replica(i + 1);
    Y.applyUpdate(r.doc, state);
    return r;
  });
}

/** Exchanges exactly the missing updates between every pair ("reconnect"). */
export function syncAll(...docs: Y.Doc[]): void {
  for (const a of docs) {
    for (const b of docs) {
      if (a !== b) Y.applyUpdate(b, Y.encodeStateAsUpdate(a, Y.encodeStateVector(b)));
    }
  }
}

export function syncPair(a: Y.Doc, b: Y.Doc): void {
  syncAll(a, b);
}

/** Tiny deterministic PRNG for reproducible fuzz tests. */
export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function smallBoard(): BoardContent {
  return {
    title: 'Test',
    columns: [
      { id: 'todo', title: 'To do', rank: 'a', wipLimit: null },
      { id: 'doing', title: 'Doing', rank: 'i', wipLimit: 2 },
      { id: 'done', title: 'Done', rank: 'r', wipLimit: null },
    ],
    cards: ['c1', 'c2', 'c3', 'c4'].map((id, i) => ({
      id,
      columnId: 'todo',
      rank: ['a', 'i', 'r', 'v'][i],
      title: `Card ${i + 1}`,
      description: '',
      labels: [],
      assigneeId: null,
      due: null,
      checklist: [],
      comments: [],
      createdAt: 0,
    })),
    notes: [
      { id: 'n1', x: 0, y: 0, w: 200, h: 140, text: 'one', color: 'yellow', z: 1 },
      { id: 'n2', x: 300, y: 0, w: 200, h: 140, text: 'two', color: 'blue', z: 2 },
    ],
    connectors: [{ id: 'k1', from: 'n1', to: 'n2' }],
  };
}
