import * as Y from 'yjs';
import { replica, smallBoard } from '../../../testing/crdt';
import { BoardStore } from '../../data/board-store';
import { readCard } from '../../domain/read';
import { boardTypes } from '../../domain/schema';
import { KeyedSignals, ySignal } from './y-signal';

describe('Yjs ⇄ signals adapter', () => {
  it('ySignal re-projects on deep changes', () => {
    const doc = new Y.Doc();
    const map = doc.getMap<number>('m');
    const ref = ySignal(map as unknown as Y.AbstractType<unknown>, () => map.get('n') ?? 0);
    expect(ref.value()).toBe(0);
    map.set('n', 5);
    expect(ref.value()).toBe(5);
    ref.destroy();
    map.set('n', 6);
    expect(ref.value()).toBe(5);
  });

  it('KeyedSignals recomputes only the entries a transaction touched', () => {
    const r = replica();
    r.kanban.applyContent(smallBoard());
    const cards = new KeyedSignals(boardTypes(r.doc).cards, { project: readCard });
    const c1 = cards.get('c1');
    const c2 = cards.get('c2');
    const c2Before = c2();
    const before = cards.projections;

    r.kanban.updateCard('c1', { title: 'Renamed' });
    expect(cards.projections - before).toBe(1);
    expect(c1()?.title).toBe('Renamed');
    expect(c2()).toBe(c2Before); // same object: untouched entries keep identity

    r.kanban.descriptionText('c1')!.insert(0, 'deep edit'); // nested Y.Text inside the entry
    expect(c1()?.description).toBe('deep edit');
    expect(cards.projections - before).toBe(2);
  });

  it('reports additions and deletions through entries() and per-key signals', () => {
    const r = replica();
    r.kanban.applyContent(smallBoard());
    const cards = new KeyedSignals(boardTypes(r.doc).cards, { project: readCard });
    const c3 = cards.get('c3');
    expect(cards.size()).toBe(4);
    r.kanban.deleteCard('c3');
    expect(c3()).toBeUndefined();
    const id = r.kanban.addCard('todo', { title: 'New' });
    expect(cards.entries().get(id)?.title).toBe('New');
    expect(cards.size()).toBe(4);
  });

  it('with `fields`, ignores changes to other fields', () => {
    const r = replica();
    r.kanban.applyContent(smallBoard());
    const placement = new KeyedSignals(boardTypes(r.doc).cards, {
      project: (m) => `${m.get('columnId')}:${m.get('rank')}`,
      fields: ['columnId', 'rank'],
    });
    const before = placement.projections;
    r.kanban.updateCard('c1', { title: 'x' });
    r.kanban.descriptionText('c1')!.insert(0, 'y');
    r.kanban.toggleLabel('c1', 'bug');
    expect(placement.projections).toBe(before);
    r.kanban.moveCard('c1', 'done', 0);
    expect(placement.projections).toBe(before + 1);
    expect(placement.get('c1')()).toMatch(/^done:/);
  });
});

describe('BoardStore', () => {
  it('derives ordered columns and card lists', () => {
    const r = replica();
    r.kanban.applyContent(smallBoard());
    const store = new BoardStore(r.doc);
    expect(store.columnOrder()).toEqual(['todo', 'doing', 'done']);
    expect(store.columnCardIds('todo')()).toEqual(['c1', 'c2', 'c3', 'c4']);
    r.kanban.moveCard('c4', 'doing', 0);
    expect(store.columnCardIds('todo')()).toEqual(['c1', 'c2', 'c3']);
    expect(store.columnCardIds('doing')()).toEqual(['c4']);
    expect(store.cardCount()).toBe(4);
  });

  it('keeps column lists referentially stable when only card content changes', () => {
    const r = replica();
    r.kanban.applyContent(smallBoard());
    const store = new BoardStore(r.doc);
    const todo = store.columnCardIds('todo');
    const list = todo();
    r.kanban.updateCard('c2', { title: 'Edited' });
    r.kanban.toggleLabel('c2', 'bug');
    expect(todo()).toBe(list);
    expect(store.card('c2')()?.labels).toEqual(['bug']);
  });

  it('hides connectors whose notes are gone', () => {
    const r = replica();
    r.kanban.applyContent(smallBoard());
    const store = new BoardStore(r.doc);
    expect(store.connectors()).toHaveLength(1);
    boardTypes(r.doc).notes.delete('n2'); // simulate a raw remote delete without cleanup
    expect(store.connectors()).toHaveLength(0);
    expect(store.noteIds()).toEqual(['n1']);
  });
});
