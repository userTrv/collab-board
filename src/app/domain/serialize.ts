import * as Y from 'yjs';
import { BoardContent, Card, CardComment, ChecklistItem, Column, Connector, Note, NoteColor } from './model';
import { spreadRanks } from './rank';
import { readBoard } from './read';
import { LABELS } from './team';

export const EXPORT_FORMAT = 'collab-board';
export const EXPORT_VERSION = 1;

export interface BoardExport {
  readonly format: typeof EXPORT_FORMAT;
  readonly version: typeof EXPORT_VERSION;
  readonly exportedAt: string;
  readonly board: BoardContent;
}

export class ImportError extends Error {}

export function toExportJson(board: BoardContent, now = new Date()): string {
  const out: BoardExport = { format: EXPORT_FORMAT, version: EXPORT_VERSION, exportedAt: now.toISOString(), board };
  return JSON.stringify(out, null, 2);
}

/** Parses and sanitises an exported board. Never trusts the file: unknown fields are dropped. */
export function parseExportJson(text: string): BoardContent {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ImportError('The file is not valid JSON.');
  }
  const r = raw as Partial<BoardExport>;
  if (!r || r.format !== EXPORT_FORMAT) throw new ImportError('Not a Collab Board export (missing "format": "collab-board").');
  if (r.version !== EXPORT_VERSION) throw new ImportError(`Unsupported export version ${String(r.version)}.`);
  return sanitizeContent(r.board);
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const arr = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter(isObj) : []);
const s = (v: unknown, max = 10_000): string => (typeof v === 'string' ? v.slice(0, max) : '');
const n = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const ID = /^[\w-]{1,64}$/;
const RANK = /^[0-9a-z]*[1-9a-z]$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const NOTE_COLORS: NoteColor[] = ['yellow', 'pink', 'blue', 'green', 'purple'];

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((i) => ID.test(i.id) && !seen.has(i.id) && seen.add(i.id));
}

/** Invalid ranks are replaced so that order is preserved as given in the file. */
function fixRanks<T extends { rank: string }>(items: T[]): T[] {
  if (items.every((i) => RANK.test(i.rank))) return items;
  const ranks = spreadRanks(items.length);
  return items.map((i, k) => ({ ...i, rank: ranks[k] }));
}

export function sanitizeContent(value: unknown): BoardContent {
  if (!isObj(value)) throw new ImportError('The export has no "board" object.');
  const columns: Column[] = fixRanks(
    uniqueById(arr(value['columns']).map((c) => ({ id: s(c['id']), title: s(c['title'], 200) || 'Untitled', rank: s(c['rank']), wipLimit: n(c['wipLimit']) > 0 ? Math.floor(n(c['wipLimit'])) : null }))),
  );
  if (!columns.length) throw new ImportError('The board has no columns.');
  const columnIds = new Set(columns.map((c) => c.id));
  const labelIds = new Set(LABELS.map((l) => l.id));
  const cards: Card[] = fixRanks(
    uniqueById(
      arr(value['cards']).map((c) => ({
        id: s(c['id']),
        columnId: columnIds.has(s(c['columnId'])) ? s(c['columnId']) : columns[0].id,
        rank: s(c['rank']),
        title: s(c['title'], 500) || 'Untitled',
        description: s(c['description'], 50_000),
        labels: Array.isArray(c['labels']) ? [...new Set(c['labels'].filter((l): l is string => typeof l === 'string' && labelIds.has(l)))].sort() : [],
        assigneeId: s(c['assigneeId'], 64) || null,
        due: DATE.test(s(c['due'])) ? s(c['due']) : null,
        checklist: uniqueById(arr(c['checklist']).map((i): ChecklistItem => ({ id: s(i['id']), text: s(i['text'], 500), done: i['done'] === true }))),
        comments: uniqueById(arr(c['comments']).map((i): CardComment => ({ id: s(i['id']), author: s(i['author'], 100) || 'Someone', color: s(i['color'], 32) || '#888', text: s(i['text'], 5000), createdAt: n(i['createdAt']) }))),
        createdAt: n(c['createdAt']),
      })),
    ),
  );
  const notes: Note[] = uniqueById(
    arr(value['notes']).map((i) => ({
      id: s(i['id']),
      x: n(i['x']),
      y: n(i['y']),
      w: Math.max(120, n(i['w'], 200)),
      h: Math.max(80, n(i['h'], 140)),
      text: s(i['text'], 5000),
      color: NOTE_COLORS.includes(i['color'] as NoteColor) ? (i['color'] as NoteColor) : 'yellow',
      z: n(i['z']),
    })),
  );
  const noteIds = new Set(notes.map((x) => x.id));
  const connectors: Connector[] = uniqueById(arr(value['connectors']).map((c) => ({ id: s(c['id']), from: s(c['from']), to: s(c['to']) }))).filter(
    (c) => noteIds.has(c.from) && noteIds.has(c.to) && c.from !== c.to,
  );
  return { title: s(value['title'], 200) || 'Imported board', columns, cards, notes, connectors };
}

/** Binary export: the full Yjs state (including history), loadable by any Yjs peer. */
export function encodeBinary(doc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(doc);
}

/** Applies a binary export to an (empty) doc and checks it contains a board. */
export function decodeBinaryInto(doc: Y.Doc, bytes: Uint8Array): BoardContent {
  try {
    Y.applyUpdate(doc, bytes);
  } catch {
    throw new ImportError('The file is not a valid Yjs update.');
  }
  const content = readBoard(doc);
  if (!content.columns.length && !content.notes.length) throw new ImportError('The Yjs update does not contain a Collab Board.');
  return content;
}
