import { replica, smallBoard } from '../../testing/crdt';
import { BoardCommands } from '../domain/board-commands';
import { readBoard } from '../domain/read';
import { HistoryRecorder } from './history-recorder';

describe('HistoryRecorder (time travel)', () => {
  afterEach(() => vi.useRealTimers());

  it('records a debounced entry per burst of local edits with the command labels', () => {
    vi.useFakeTimers();
    const r = replica();
    r.kanban.applyContent(smallBoard()); // default origin is LOCAL — flush it away
    const history = new HistoryRecorder(r.doc, () => ({ name: 'Ada', color: '#f00' }), 1000);
    vi.advanceTimersByTime(1000);
    const base = history.entries().length;

    const ctxKanban = new BoardCommands(r.doc, { describe: (l) => history.describe(l) });
    ctxKanban.updateCard('c1', { title: 'One' });
    ctxKanban.moveCard('c1', 'done', 0);
    expect(history.entries()).toHaveLength(base);
    vi.advanceTimersByTime(1000);
    expect(history.entries()).toHaveLength(base + 1);
    const entry = history.entries().at(-1)!;
    expect(entry.by).toBe('Ada');
    expect(entry.label).toBe('Moved “One” to Done (+1 more)');
  });

  it('rebuilds past states from snapshots and restores them as a new edit', () => {
    const r = replica();
    r.kanban.applyContent(smallBoard());
    const history = new HistoryRecorder(r.doc, () => ({ name: 'Ada', color: '#f00' }), 10);
    history.record('before');
    const before = readBoard(r.doc);
    r.kanban.deleteCard('c1');
    r.kanban.addColumn('Later');
    history.record('after');

    const past = history.contentAt(0)!;
    expect(past).toEqual(before);
    expect(readBoard(r.doc).cards.map((c) => c.id)).not.toContain('c1');

    r.kanban.applyContent(past);
    expect(readBoard(r.doc)).toEqual(before);
    history.destroy();
  });

  it('ignores remote and history-only transactions', () => {
    vi.useFakeTimers();
    const r = replica();
    const history = new HistoryRecorder(r.doc, () => ({ name: 'Ada', color: '#f00' }), 10);
    history.record('x'); // HISTORY_ORIGIN push must not schedule another entry
    vi.advanceTimersByTime(100);
    expect(history.entries()).toHaveLength(1);
  });
});
