import * as Y from 'yjs';
import { replica } from '../../testing/crdt';
import { createBoardDoc } from './schema';
import { readBoard } from './read';
import { demoBoard } from './seed';
import { decodeBinaryInto, encodeBinary, ImportError, parseExportJson, sanitizeContent, toExportJson } from './serialize';

describe('export / import', () => {
  it('round-trips a board through JSON without loss', () => {
    const source = replica();
    source.kanban.applyContent(demoBoard(Date.UTC(2026, 8, 24)));
    source.kanban.descriptionText(readBoard(source.doc).cards[0].id)!.insert(0, 'typed ');
    const original = readBoard(source.doc);

    const json = toExportJson(original);
    const target = replica();
    target.kanban.applyContent(parseExportJson(json));
    expect(readBoard(target.doc)).toEqual(original);
  });

  it('round-trips through the Yjs binary format, including history', () => {
    const source = replica();
    source.kanban.applyContent(demoBoard());
    Y.transact(source.doc, () => source.doc.getArray('history').push([{ ts: 1 }]));
    const doc = createBoardDoc();
    const content = decodeBinaryInto(doc, encodeBinary(source.doc));
    expect(content).toEqual(readBoard(source.doc));
    expect(doc.getArray('history').length).toBe(1);
  });

  it('rejects files that are not exports', () => {
    expect(() => parseExportJson('nope')).toThrow(ImportError);
    expect(() => parseExportJson('{"format":"trello"}')).toThrow(/Not a Collab Board export/);
    expect(() => parseExportJson('{"format":"collab-board","version":99,"board":{}}')).toThrow(/version/);
    expect(() => decodeBinaryInto(createBoardDoc(), new Uint8Array([1, 2, 3]))).toThrow(ImportError);
  });

  it('sanitises hostile input: drops bad ids/refs, fixes ranks, clamps sizes', () => {
    const content = sanitizeContent({
      title: 'x'.repeat(1000),
      columns: [{ id: 'a', title: 'A', rank: 'BAD RANK' }, { id: 'a', title: 'dupe' }, { id: 'b', title: 'B', rank: '' }],
      cards: [
        { id: 'k1', columnId: 'missing', rank: 'i', title: 'orphan', labels: ['bug', 'not-a-label', 42], due: 'tomorrow' },
        { id: '../../etc', columnId: 'a', rank: 'i', title: 'bad id' },
      ],
      notes: [{ id: 'n1', x: 'NaN', color: 'neon' }],
      connectors: [{ id: 'c', from: 'n1', to: 'ghost' }],
    });
    expect(content.title).toHaveLength(200);
    expect(content.columns.map((c) => c.id)).toEqual(['a', 'b']);
    expect(content.columns.map((c) => c.rank).every((r) => /^[0-9a-z]+$/.test(r))).toBe(true);
    expect(content.cards).toHaveLength(1);
    expect(content.cards[0]).toMatchObject({ columnId: 'a', labels: ['bug'], due: null });
    expect(content.notes[0]).toMatchObject({ x: 0, color: 'yellow' });
    expect(content.connectors).toEqual([]);
  });
});
