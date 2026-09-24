import * as Y from 'yjs';
import { compareRanked } from './rank';
import { boardTypes, YEntity } from './schema';
import { BoardContent, Card, CardComment, ChecklistItem, Column, Connector, Note, NoteColor } from './model';

/* Pure projections Y types -> plain domain objects. Defensive: remote peers or imported files
 * may carry missing/odd fields, the UI must never crash on them. */

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

export function readColumn(m: YEntity): Column {
  const wip = m.get('wipLimit');
  return {
    id: str(m.get('id')),
    title: str(m.get('title'), 'Untitled'),
    rank: str(m.get('rank'), 'i'),
    wipLimit: typeof wip === 'number' && wip > 0 ? wip : null,
  };
}

export function readChecklist(v: unknown): ChecklistItem[] {
  if (!(v instanceof Y.Array)) return [];
  return (v.toArray() as unknown[])
    .filter((i): i is YEntity => i instanceof Y.Map)
    .map((i) => ({ id: str(i.get('id')), text: str(i.get('text')), done: i.get('done') === true }));
}

export function readComments(v: unknown): CardComment[] {
  if (!(v instanceof Y.Array)) return [];
  return (v.toArray() as Partial<CardComment>[]).map((c) => ({
    id: str(c.id),
    author: str(c.author, 'Someone'),
    color: str(c.color, '#888'),
    text: str(c.text),
    createdAt: num(c.createdAt),
  }));
}

export function readLabels(v: unknown): string[] {
  if (!(v instanceof Y.Map)) return [];
  return [...v.keys()].filter((k) => v.get(k) === true).sort();
}

export function readCard(m: YEntity): Card {
  const description = m.get('description');
  return {
    id: str(m.get('id')),
    columnId: str(m.get('columnId')),
    rank: str(m.get('rank'), 'i'),
    title: str(m.get('title'), 'Untitled'),
    description: description instanceof Y.Text ? description.toString() : str(description),
    labels: readLabels(m.get('labels')),
    assigneeId: strOrNull(m.get('assigneeId')),
    due: strOrNull(m.get('due')),
    checklist: readChecklist(m.get('checklist')),
    comments: readComments(m.get('comments')),
    createdAt: num(m.get('createdAt')),
  };
}

const NOTE_COLORS: readonly NoteColor[] = ['yellow', 'pink', 'blue', 'green', 'purple'];

export function readNote(m: YEntity): Note {
  const color = m.get('color') as NoteColor;
  return {
    id: str(m.get('id')),
    x: num(m.get('x')),
    y: num(m.get('y')),
    w: num(m.get('w'), 200),
    h: num(m.get('h'), 140),
    text: str(m.get('text')),
    color: NOTE_COLORS.includes(color) ? color : 'yellow',
    z: num(m.get('z')),
  };
}

export function readConnector(m: YEntity): Connector {
  return { id: str(m.get('id')), from: str(m.get('from')), to: str(m.get('to')) };
}

/**
 * Cards whose column was deleted concurrently (replica A deleted the column while B added a
 * card to it) are shown in the first column instead of vanishing. This is a derived view —
 * no write — so every replica derives exactly the same thing.
 */
export function effectiveColumnId(card: Pick<Card, 'columnId'>, columnIds: ReadonlySet<string>, firstColumnId: string | undefined): string | undefined {
  return columnIds.has(card.columnId) ? card.columnId : firstColumnId;
}

/** Full snapshot of a board, sorted deterministically. Used for export, history and tests. */
export function readBoard(doc: Y.Doc): BoardContent {
  const t = boardTypes(doc);
  const columns = [...t.columns.values()].map(readColumn).sort(compareRanked);
  const notes = [...t.notes.values()].map(readNote).sort((a, b) => a.z - b.z || (a.id < b.id ? -1 : 1));
  const noteIds = new Set(notes.map((n) => n.id));
  return {
    title: str(t.meta.get('title'), 'Untitled board'),
    columns,
    cards: [...t.cards.values()].map(readCard).sort(compareRanked),
    notes,
    connectors: [...t.connectors.values()]
      .map(readConnector)
      .filter((c) => noteIds.has(c.from) && noteIds.has(c.to))
      .sort((a, b) => (a.id < b.id ? -1 : 1)),
  };
}

/** Cards grouped per column in display order (orphans rescued into the first column). */
export function cardsByColumn(content: Pick<BoardContent, 'columns' | 'cards'>): Map<string, Card[]> {
  const ids = new Set(content.columns.map((c) => c.id));
  const first = content.columns[0]?.id;
  const out = new Map<string, Card[]>(content.columns.map((c) => [c.id, []]));
  for (const card of [...content.cards].sort(compareRanked)) {
    const col = effectiveColumnId(card, ids, first);
    if (col) out.get(col)!.push(card);
  }
  return out;
}
