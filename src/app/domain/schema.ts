import * as Y from 'yjs';

/**
 * Layout of one board inside a Y.Doc (one doc per board).
 *
 *   meta        Y.Map    title, createdAt, schema
 *   columns     Y.Map    id -> Y.Map { id, title, rank, wipLimit }
 *   cards       Y.Map    id -> Y.Map { id, columnId, rank, title, description: Y.Text,
 *                                      labels: Y.Map<true>, assigneeId, due,
 *                                      checklist: Y.Array<Y.Map>, comments: Y.Array<json>, createdAt }
 *   notes       Y.Map    id -> Y.Map { id, x, y, w, h, text, color, z }
 *   connectors  Y.Map    id -> Y.Map { id, from, to }
 *   history     Y.Array  snapshots (see history-recorder.ts), never undo-tracked
 *
 * Everything is keyed by id in maps (not arrays), ordering uses fractional ranks: a move is a
 * field write, so concurrent moves/deletes can never duplicate an entity.
 */
export const SCHEMA_VERSION = 1;

// Yjs child types are heterogeneous; `unknown` values are narrowed in read.ts.
export type YEntity = Y.Map<unknown>;

export interface BoardDocTypes {
  readonly meta: Y.Map<unknown>;
  readonly columns: Y.Map<YEntity>;
  readonly cards: Y.Map<YEntity>;
  readonly notes: Y.Map<YEntity>;
  readonly connectors: Y.Map<YEntity>;
  readonly history: Y.Array<HistoryEntryData>;
}

export interface HistoryEntryData {
  readonly ts: number;
  readonly by: string;
  readonly color: string;
  readonly label: string;
  readonly snapshot: Uint8Array;
}

export function boardTypes(doc: Y.Doc): BoardDocTypes {
  return {
    meta: doc.getMap('meta'),
    columns: doc.getMap<YEntity>('columns'),
    cards: doc.getMap<YEntity>('cards'),
    notes: doc.getMap<YEntity>('notes'),
    connectors: doc.getMap<YEntity>('connectors'),
    history: doc.getArray<HistoryEntryData>('history'),
  };
}

/** The types a user's undo stack covers (history is deliberately excluded). */
export function undoScope(doc: Y.Doc): Y.AbstractType<unknown>[] {
  const t = boardTypes(doc);
  return [t.meta, t.columns, t.cards, t.notes, t.connectors] as Y.AbstractType<unknown>[];
}

/** Every board doc is created with gc disabled: history preview needs deleted content. */
export function createBoardDoc(guid?: string): Y.Doc {
  return new Y.Doc({ gc: false, ...(guid ? { guid } : {}) });
}

export function entity(fields: Record<string, unknown>): YEntity {
  const map = new Y.Map<unknown>();
  for (const [k, v] of Object.entries(fields)) map.set(k, v);
  return map;
}
