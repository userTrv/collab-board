import { cardsByColumn } from './read';
import { demoBoard, stressBoard } from './seed';
import { LABELS, TEAM } from './team';

describe('seed data', () => {
  it('builds a demo board that exercises every feature', () => {
    const board = demoBoard(Date.UTC(2026, 8, 24));
    expect(board.columns.map((c) => c.title)).toEqual(['Backlog', 'To do', 'In progress', 'Review', 'Done']);
    expect(board.cards.length).toBeGreaterThanOrEqual(10);
    expect(board.cards.some((c) => c.checklist.length > 0)).toBe(true);
    expect(board.cards.some((c) => c.comments.length > 0)).toBe(true);
    expect(board.cards.some((c) => c.due !== null)).toBe(true);
    expect(board.columns.some((c) => c.wipLimit !== null)).toBe(true);
    const labelIds = new Set(LABELS.map((l) => l.id));
    const memberIds = new Set(TEAM.map((m) => m.id));
    for (const card of board.cards) {
      expect(card.labels.every((l) => labelIds.has(l))).toBe(true);
      if (card.assigneeId) expect(memberIds.has(card.assigneeId)).toBe(true);
    }
    expect(board.notes.length).toBeGreaterThan(3);
    const noteIds = new Set(board.notes.map((n) => n.id));
    expect(board.connectors.every((c) => noteIds.has(c.from) && noteIds.has(c.to))).toBe(true);
  });

  it('builds a 1,000-card stress board with unique ids and short ranks', () => {
    const board = stressBoard(1000);
    expect(board.cards).toHaveLength(1000);
    expect(new Set(board.cards.map((c) => c.id)).size).toBe(1000);
    expect(Math.max(...board.cards.map((c) => c.rank.length))).toBeLessThanOrEqual(3);
    const perColumn = [...cardsByColumn(board).values()].map((c) => c.length);
    expect(perColumn).toEqual([200, 200, 200, 200, 200]);
  });
});
