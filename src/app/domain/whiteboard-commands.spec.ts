import { replica, smallBoard } from '../../testing/crdt';
import { readBoard } from './read';
import { GRID } from './whiteboard-commands';

describe('WhiteboardCommands', () => {
  function board() {
    const r = replica();
    r.kanban.applyContent(smallBoard());
    return r;
  }

  it('adds notes on top of the stack and moves them with optional snapping', () => {
    const r = board();
    const id = r.whiteboard.addNote({ x: 13, y: 27, text: 'hi' });
    const note = () => readBoard(r.doc).notes.find((n) => n.id === id)!;
    expect(note().z).toBe(3);
    r.whiteboard.moveNotes([id], 10, 0, GRID);
    expect([note().x, note().y]).toEqual([20, 20]);
    r.whiteboard.placeNotes([{ id, x: 101.4, y: 50.6 }]);
    expect([note().x, note().y]).toEqual([101, 51]);
  });

  it('connects notes once, never to themselves, and cascades deletes to connectors', () => {
    const r = board();
    expect(r.whiteboard.connect('n1', 'n1')).toBeNull();
    expect(r.whiteboard.connect('n2', 'n1')).toBeNull(); // n1→n2 already exists
    const n3 = r.whiteboard.addNote({ x: 0, y: 400 });
    expect(r.whiteboard.connect('n2', n3)).not.toBeNull();
    r.whiteboard.deleteNotes(['n2']);
    const content = readBoard(r.doc);
    expect(content.notes.map((n) => n.id).sort()).toEqual(['n1', n3].sort());
    expect(content.connectors).toEqual([]);
  });

  it('clamps resize, recolours and brings notes to front', () => {
    const r = board();
    r.whiteboard.resizeNote('n1', 10, 10);
    r.whiteboard.setNoteColor(['n1', 'n2'], 'pink');
    r.whiteboard.bringToFront(['n1']);
    const [n2, n1] = readBoard(r.doc).notes;
    expect(n1).toMatchObject({ id: 'n1', w: 120, h: 80, color: 'pink', z: 3 });
    expect(n2.color).toBe('pink');
  });
});
