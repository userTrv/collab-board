import * as Y from 'yjs';
import { BoardCommands } from '../../domain/board-commands';
import { readBoard } from '../../domain/read';
import { createBoardDoc } from '../../domain/schema';
import { mergeReport } from './merge-report';
import { demoBase, NOTES_CARD, SCENARIO } from './scenario';

function replicas() {
  const base = createBoardDoc();
  new BoardCommands(base).applyContent(demoBase());
  const update = Y.encodeStateAsUpdate(base);
  const make = (clientID: number) => {
    const doc = createBoardDoc();
    doc.clientID = clientID;
    Y.applyUpdate(doc, update);
    return { doc, kanban: new BoardCommands(doc) };
  };
  return { base: readBoard(base), a: make(1), b: make(2) };
}

describe('conflict demo scenario + merge report', () => {
  it('converges and explains every conflict from the actual merge', () => {
    const { base, a, b } = replicas();
    for (const step of SCENARIO) step.run(step.replica === 'A' ? a.kanban : b.kanban);
    const [preA, preB] = [readBoard(a.doc), readBoard(b.doc)];

    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc, Y.encodeStateVector(b.doc)));
    Y.applyUpdate(a.doc, Y.encodeStateAsUpdate(b.doc, Y.encodeStateVector(a.doc)));
    const merged = readBoard(a.doc);
    expect(readBoard(b.doc)).toEqual(merged);

    // semantic outcomes
    expect(merged.cards.find((c) => c.id === 'login')).toBeUndefined();
    expect(merged.cards.filter((c) => c.id === 'review')).toHaveLength(1);
    expect(merged.cards.find((c) => c.id === NOTES_CARD)!.description).toBe('Draft: v2 ships offline mode. Faster sync.');
    expect(merged.cards.map((c) => c.title)).toEqual(expect.arrayContaining(['Add dark mode', 'Add CSV export']));

    const report = mergeReport(base, preA, preB, merged);
    const kinds = report.map((l) => l.kind);
    expect(kinds.filter((k) => k === 'lww')).toHaveLength(2); // rename + move
    expect(kinds).toContain('delete-wins');
    expect(kinds).toContain('text-merge');
    expect(kinds.filter((k) => k === 'both-kept')).toHaveLength(2);
    const rename = report.find((l) => l.cardId === 'docs')!;
    const winnerTitle = merged.cards.find((c) => c.id === 'docs')!.title;
    expect(rename.text).toContain(winnerTitle);
  });
});
