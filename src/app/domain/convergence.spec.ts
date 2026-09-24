import * as Y from 'yjs';
import { forkedReplicas, mulberry32, Replica, smallBoard, syncAll } from '../../testing/crdt';
import { cardsByColumn, readBoard } from './read';

const columnTitles = (r: Replica) => {
  const content = readBoard(r.doc);
  return Object.fromEntries([...cardsByColumn(content)].map(([col, cards]) => [col, cards.map((c) => c.id)]));
};

describe('CRDT convergence', () => {
  it('keeps both cards when two replicas insert at the same position offline', () => {
    const [a, b] = forkedReplicas(2, smallBoard());
    const idA = a.kanban.addCard('doing', { title: 'From A' }, 0);
    const idB = b.kanban.addCard('doing', { title: 'From B' }, 0);
    syncAll(a.doc, b.doc);
    expect(readBoard(a.doc)).toEqual(readBoard(b.doc));
    expect(columnTitles(a)['doing'].sort()).toEqual([idA, idB].sort());
  });

  it('move vs delete: the delete wins and nothing is resurrected or duplicated', () => {
    const [a, b] = forkedReplicas(2, smallBoard());
    a.kanban.moveCard('c2', 'done', 0);
    b.kanban.deleteCard('c2');
    syncAll(a.doc, b.doc);
    expect(readBoard(a.doc)).toEqual(readBoard(b.doc));
    expect(readBoard(a.doc).cards.map((c) => c.id)).not.toContain('c2');
  });

  it('concurrent moves of the same card end in exactly one column', () => {
    const [a, b] = forkedReplicas(2, smallBoard());
    a.kanban.moveCard('c1', 'doing', 0);
    b.kanban.moveCard('c1', 'done', 0);
    syncAll(a.doc, b.doc);
    const cols = columnTitles(a);
    expect(cols).toEqual(columnTitles(b));
    const occurrences = Object.values(cols).flat().filter((id) => id === 'c1');
    expect(occurrences).toHaveLength(1);
  });

  it('concurrent reorders in one column converge without losing or duplicating cards', () => {
    const [a, b] = forkedReplicas(2, smallBoard());
    a.kanban.moveCard('c4', 'todo', 0); // A: c4 to top
    b.kanban.moveCard('c3', 'todo', 0); // B: c3 to top
    b.kanban.moveCard('c1', 'todo', 3); // B: c1 to bottom
    syncAll(a.doc, b.doc);
    const order = columnTitles(a)['todo'];
    expect(order).toEqual(columnTitles(b)['todo']);
    expect([...order].sort()).toEqual(['c1', 'c2', 'c3', 'c4']);
    expect(order.at(-1)).toBe('c1');
  });

  it('a card added to a concurrently deleted column is rescued into the first column', () => {
    const [a, b] = forkedReplicas(2, smallBoard());
    a.kanban.deleteColumn('doing');
    const rescued = b.kanban.addCard('doing', { title: 'Late card' });
    syncAll(a.doc, b.doc);
    expect(columnTitles(a)).toEqual(columnTitles(b));
    expect(columnTitles(a)['todo']).toContain(rescued);
    // and moving it again repairs its columnId for real
    a.kanban.moveCard(rescued, 'done', 0);
    syncAll(a.doc, b.doc);
    expect(columnTitles(b)['done']).toEqual([rescued]);
  });

  it('merges concurrent description edits character by character', () => {
    const [a, b] = forkedReplicas(2, smallBoard());
    a.kanban.descriptionText('c1')!.insert(0, 'Hello');
    syncAll(a.doc, b.doc);
    a.kanban.descriptionText('c1')!.insert(5, ' world');
    b.kanban.descriptionText('c1')!.insert(0, '>> ');
    syncAll(a.doc, b.doc);
    expect(a.kanban.descriptionText('c1')!.toString()).toBe('>> Hello world');
    expect(b.kanban.descriptionText('c1')!.toString()).toBe('>> Hello world');
  });

  it('merges concurrent label toggles and checklist additions', () => {
    const [a, b] = forkedReplicas(2, smallBoard());
    a.kanban.toggleLabel('c1', 'bug');
    b.kanban.toggleLabel('c1', 'design');
    a.kanban.addChecklistItem('c1', 'from A');
    b.kanban.addChecklistItem('c1', 'from B');
    syncAll(a.doc, b.doc);
    const card = readBoard(a.doc).cards.find((c) => c.id === 'c1')!;
    expect(card.labels).toEqual(['bug', 'design']);
    expect(card.checklist.map((i) => i.text).sort()).toEqual(['from A', 'from B']);
    expect(readBoard(b.doc)).toEqual(readBoard(a.doc));
  });

  it('deleting a note drops connectors that a peer concurrently attached to it', () => {
    const [a, b] = forkedReplicas(2, smallBoard());
    const n3 = b.whiteboard.addNote({ x: 0, y: 300 });
    syncAll(a.doc, b.doc);
    a.whiteboard.deleteNotes(['n1']);
    b.whiteboard.connect(n3, 'n1');
    syncAll(a.doc, b.doc);
    const content = readBoard(a.doc);
    expect(content).toEqual(readBoard(b.doc));
    expect(content.connectors.every((c) => c.from !== 'n1' && c.to !== 'n1')).toBe(true);
  });

  it('three replicas with 600 random interleaved ops and partial syncs converge (seeded fuzz)', () => {
    const rnd = mulberry32(20260924);
    const replicas = forkedReplicas(3, smallBoard());
    const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)];
    for (let step = 0; step < 600; step++) {
      const r = pick(replicas);
      const content = readBoard(r.doc);
      const cols = content.columns.map((c) => c.id);
      const cards = content.cards.map((c) => c.id);
      const roll = rnd();
      if (roll < 0.25 || cards.length < 3) r.kanban.addCard(pick(cols.length ? cols : ['todo']), { title: `s${step}` }, Math.floor(rnd() * 5));
      else if (roll < 0.6) r.kanban.moveCard(pick(cards), pick(cols), Math.floor(rnd() * 6));
      else if (roll < 0.7) r.kanban.deleteCard(pick(cards));
      else if (roll < 0.8) r.kanban.updateCard(pick(cards), { title: `t${step}` });
      else if (roll < 0.85 && cols.length > 1) r.kanban.moveColumn(pick(cols), Math.floor(rnd() * 3));
      else if (roll < 0.9) r.kanban.toggleLabel(pick(cards), pick(['bug', 'design', 'chore']));
      else r.kanban.descriptionText(pick(cards))?.insert(0, 'x');
      // occasionally a pair reconnects
      if (rnd() < 0.15) {
        const [x, y] = [pick(replicas), pick(replicas)];
        if (x !== y) syncAll(x.doc, y.doc);
      }
    }
    syncAll(...replicas.map((r) => r.doc));
    const [first, ...rest] = replicas.map((r) => readBoard(r.doc));
    for (const other of rest) expect(other).toEqual(first);
    // invariants: every card appears exactly once in the derived columns
    const grouped = [...cardsByColumn(first).values()].flat().map((c) => c.id);
    expect(grouped.length).toBe(first.cards.length);
    expect(new Set(grouped).size).toBe(grouped.length);
    // and the binary states are identical
    const states = replicas.map((r) => Y.encodeStateVector(r.doc).join(','));
    expect(new Set(states).size).toBe(1);
  });
});
