import { replica, smallBoard, syncAll } from '../../testing/crdt';
import * as Y from 'yjs';
import { readBoard } from '../domain/read';
import { UndoController } from './undo-controller';

function pair() {
  const a = replica(1);
  a.kanban.applyContent(smallBoard());
  const b = replica(2);
  Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));
  return { a, b, undoA: new UndoController(a.doc, 0), undoB: new UndoController(b.doc, 0) };
}

const title = (doc: Y.Doc, id: string) => readBoard(doc).cards.find((c) => c.id === id)?.title;

describe('UndoController (per-user undo)', () => {
  it('does not track setup done with other origins', () => {
    const { undoA } = pair();
    expect(undoA.canUndo()).toBe(false);
  });

  it('undoes only my own change, even after a collaborator edited later', () => {
    const { a, b, undoA } = pair();
    a.kanban.updateCard('c1', { title: 'A edit' });
    syncAll(a.doc, b.doc);
    b.kanban.updateCard('c2', { title: 'B edit' });
    syncAll(a.doc, b.doc);

    expect(undoA.canUndo()).toBe(true);
    undoA.undo();
    syncAll(a.doc, b.doc);
    for (const doc of [a.doc, b.doc]) {
      expect(title(doc, 'c1')).toBe('Card 1');
      expect(title(doc, 'c2')).toBe('B edit');
    }
  });

  it('never undoes remote changes', () => {
    const { a, b, undoA } = pair();
    b.kanban.deleteCard('c3');
    syncAll(a.doc, b.doc);
    expect(undoA.canUndo()).toBe(false);
    expect(undoA.undo()).toBe(false);
    expect(readBoard(a.doc).cards.map((c) => c.id)).not.toContain('c3');
  });

  it('restores a deleted card with its nested content and supports redo', () => {
    const { a, undoA } = pair();
    a.kanban.addChecklistItem('c1', 'keep me');
    undoA.stopCapturing();
    a.kanban.deleteCard('c1');
    expect(title(a.doc, 'c1')).toBeUndefined();
    undoA.undo();
    const restored = readBoard(a.doc).cards.find((c) => c.id === 'c1')!;
    expect(restored.checklist.map((i) => i.text)).toEqual(['keep me']);
    expect(undoA.canRedo()).toBe(true);
    undoA.redo();
    expect(title(a.doc, 'c1')).toBeUndefined();
  });

  it('groups rapid edits into one step within the capture timeout', () => {
    const a = replica(1);
    a.kanban.applyContent(smallBoard());
    const undo = new UndoController(a.doc, 10_000);
    a.kanban.updateCard('c1', { title: 'one' });
    a.kanban.updateCard('c1', { title: 'two' });
    undo.undo();
    expect(title(a.doc, 'c1')).toBe('Card 1');
  });
});
