import * as Y from 'yjs';
import { newId } from './id';
import { BoardContent, CardComment, CardPatch, Column, Id } from './model';
import { CommandBase } from './command-base';
import { compareRanked, rankForIndex, Ranked } from './rank';
import { readBoard, readCard, readColumn } from './read';
import { entity, YEntity } from './schema';

export interface NewCard {
  title: string;
  description?: string;
  labels?: readonly Id[];
  assigneeId?: Id | null;
  due?: string | null;
  checklist?: readonly { id?: Id; text: string; done?: boolean }[];
  comments?: readonly CardComment[];
}

/** Kanban commands: board title, columns, cards, checklist, comments, whole-board restore. */
export class BoardCommands extends CommandBase {
  // ---------- board ----------

  setTitle(title: string): void {
    const clean = title.trim() || 'Untitled board';
    this.run(`Renamed board to “${clean}”`, () => this.t.meta.set('title', clean));
  }

  // ---------- columns ----------

  sortedColumns(): Column[] {
    return [...this.t.columns.values()].map(readColumn).sort(compareRanked);
  }

  addColumn(title: string, index = Number.MAX_SAFE_INTEGER): Id {
    const id = newId();
    return this.run(`Added column “${title}”`, () => {
      const { rank, repairs } = rankForIndex(this.sortedColumns(), index);
      this.applyRepairs(this.t.columns, repairs);
      this.t.columns.set(id, entity({ id, title: title.trim() || 'Untitled', rank, wipLimit: null }));
      return id;
    });
  }

  renameColumn(id: Id, title: string): void {
    const col = this.t.columns.get(id);
    if (!col || !title.trim()) return;
    this.run(`Renamed column to “${title.trim()}”`, () => col.set('title', title.trim()));
  }

  setWipLimit(id: Id, limit: number | null): void {
    const col = this.t.columns.get(id);
    if (!col) return;
    const value = limit && limit > 0 ? Math.floor(limit) : null;
    this.run(value ? `Set WIP limit ${value}` : 'Removed WIP limit', () => col.set('wipLimit', value));
  }

  moveColumn(id: Id, toIndex: number): void {
    const col = this.t.columns.get(id);
    if (!col) return;
    const siblings = this.sortedColumns().filter((c) => c.id !== id);
    this.run(`Moved column “${readColumn(col).title}”`, () => {
      const { rank, repairs } = rankForIndex(siblings, toIndex);
      this.applyRepairs(this.t.columns, repairs);
      col.set('rank', rank);
    });
  }

  /** Deletes the column and the cards currently in it. */
  deleteColumn(id: Id): void {
    const col = this.t.columns.get(id);
    if (!col) return;
    this.run(`Deleted column “${readColumn(col).title}”`, () => {
      for (const [cardId, card] of this.t.cards) if (card.get('columnId') === id) this.t.cards.delete(cardId);
      this.t.columns.delete(id);
    });
  }

  // ---------- cards ----------

  /** Cards of a column in display order, optionally without one card (the one being moved). */
  columnCards(columnId: Id, excludeId?: Id): Ranked[] {
    const out: Ranked[] = [];
    for (const card of this.t.cards.values()) {
      if (card.get('columnId') === columnId && card.get('id') !== excludeId) {
        out.push({ id: card.get('id') as string, rank: card.get('rank') as string });
      }
    }
    return out.sort(compareRanked);
  }

  addCard(columnId: Id, input: NewCard, index = Number.MAX_SAFE_INTEGER): Id {
    const id = newId();
    return this.run(`Added card “${input.title}”`, () => {
      const { rank, repairs } = rankForIndex(this.columnCards(columnId), index);
      this.applyRepairs(this.t.cards, repairs);
      this.t.cards.set(id, this.cardEntity(id, columnId, rank, input));
      return id;
    });
  }

  protected cardEntity(id: Id, columnId: Id, rank: string, input: NewCard, createdAt = Date.now()): YEntity {
    const labels = new Y.Map<boolean>();
    for (const l of input.labels ?? []) labels.set(l, true);
    const checklist = new Y.Array<YEntity>();
    checklist.push((input.checklist ?? []).map((c) => entity({ id: c.id ?? newId(), text: c.text, done: !!c.done })));
    const comments = new Y.Array<unknown>();
    comments.push([...(input.comments ?? [])]);
    return entity({
      id,
      columnId,
      rank,
      title: input.title.trim() || 'Untitled',
      description: new Y.Text(input.description ?? ''),
      labels,
      assigneeId: input.assigneeId ?? null,
      due: input.due ?? null,
      checklist,
      comments,
      createdAt,
    });
  }

  updateCard(id: Id, patch: CardPatch): void {
    const card = this.t.cards.get(id);
    if (!card) return;
    const label = patch.title !== undefined ? `Renamed card to “${patch.title}”` : `Edited “${readCard(card).title}”`;
    this.run(label, () => {
      if (patch.title !== undefined && patch.title.trim()) card.set('title', patch.title.trim());
      if (patch.assigneeId !== undefined) card.set('assigneeId', patch.assigneeId);
      if (patch.due !== undefined) card.set('due', patch.due || null);
    });
  }

  toggleLabel(id: Id, labelId: Id): void {
    const labels = this.t.cards.get(id)?.get('labels');
    if (!(labels instanceof Y.Map)) return;
    this.run('Changed labels', () => {
      if (labels.get(labelId) === true) labels.delete(labelId);
      else labels.set(labelId, true);
    });
  }

  /** Y.Text of the card description (bound directly to the textarea for character-level merges). */
  descriptionText(id: Id): Y.Text | null {
    const text = this.t.cards.get(id)?.get('description');
    return text instanceof Y.Text ? text : null;
  }

  moveCard(id: Id, toColumnId: Id, toIndex: number): void {
    const card = this.t.cards.get(id);
    if (!card || !this.t.columns.has(toColumnId)) return;
    const title = readCard(card).title;
    const column = readColumn(this.t.columns.get(toColumnId)!).title;
    this.run(`Moved “${title}” to ${column}`, () => {
      const { rank, repairs } = rankForIndex(this.columnCards(toColumnId, id), toIndex);
      this.applyRepairs(this.t.cards, repairs);
      if (card.get('columnId') !== toColumnId) card.set('columnId', toColumnId);
      card.set('rank', rank);
    });
  }

  deleteCard(id: Id): void {
    const card = this.t.cards.get(id);
    if (!card) return;
    this.run(`Deleted card “${readCard(card).title}”`, () => this.t.cards.delete(id));
  }

  // ---------- checklist & comments ----------

  private checklist(cardId: Id): Y.Array<YEntity> | null {
    const list = this.t.cards.get(cardId)?.get('checklist');
    return list instanceof Y.Array ? (list as Y.Array<YEntity>) : null;
  }

  addChecklistItem(cardId: Id, text: string): void {
    const list = this.checklist(cardId);
    if (!list || !text.trim()) return;
    this.run('Added checklist item', () => list.push([entity({ id: newId(), text: text.trim(), done: false })]));
  }

  toggleChecklistItem(cardId: Id, itemId: Id): void {
    const item = this.checklist(cardId)?.toArray().find((i) => i.get('id') === itemId);
    if (!item) return;
    this.run(item.get('done') ? 'Unchecked an item' : 'Checked an item', () => item.set('done', !item.get('done')));
  }

  removeChecklistItem(cardId: Id, itemId: Id): void {
    const list = this.checklist(cardId);
    const index = list?.toArray().findIndex((i) => i.get('id') === itemId) ?? -1;
    if (!list || index < 0) return;
    this.run('Removed checklist item', () => list.delete(index, 1));
  }

  addComment(cardId: Id, text: string): void {
    const list = this.t.cards.get(cardId)?.get('comments');
    if (!(list instanceof Y.Array) || !text.trim()) return;
    const author = this.ctx.author?.() ?? { name: 'Someone', color: '#888' };
    this.run('Commented', () =>
      list.push([{ id: newId(), author: author.name, color: author.color, text: text.trim(), createdAt: Date.now() }]),
    );
  }

  // ---------- whole-board ----------

  /**
   * Makes the document match `content` with field-level patches (used by "restore version",
   * import and duplicate). Entities are matched by id; untouched fields keep their CRDT
   * history, so a restore is an ordinary, undoable and syncable edit — history is never rewritten.
   */
  applyContent(content: BoardContent, label = 'Restored a previous version'): void {
    this.run(label, () => {
      if (this.t.meta.get('title') !== content.title) this.t.meta.set('title', content.title);
      syncMap(this.t.columns, content.columns, (c) => entity({ ...c }), patchFields);
      syncMap(
        this.t.cards,
        content.cards,
        (c) => this.cardEntity(c.id, c.columnId, c.rank, c, c.createdAt),
        (m, c) => {
          patchFields(m, { id: c.id, columnId: c.columnId, rank: c.rank, title: c.title, assigneeId: c.assigneeId, due: c.due, createdAt: c.createdAt });
          const text = m.get('description');
          if (text instanceof Y.Text) {
            if (text.toString() !== c.description) {
              text.delete(0, text.length);
              text.insert(0, c.description);
            }
          } else m.set('description', new Y.Text(c.description));
          const labels = m.get('labels');
          if (labels instanceof Y.Map) {
            for (const k of [...labels.keys()]) if (!c.labels.includes(k)) labels.delete(k);
            for (const l of c.labels) if (labels.get(l) !== true) labels.set(l, true);
          }
          const list = m.get('checklist');
          if (list instanceof Y.Array && JSON.stringify(list.toJSON()) !== JSON.stringify(c.checklist)) {
            list.delete(0, list.length);
            list.push(c.checklist.map((i) => entity({ ...i })));
          }
          const comments = m.get('comments');
          if (comments instanceof Y.Array && JSON.stringify(comments.toJSON()) !== JSON.stringify(c.comments)) {
            comments.delete(0, comments.length);
            comments.push([...c.comments]);
          }
        },
      );
      syncMap(this.t.notes, content.notes, (n) => entity({ ...n }), patchFields);
      syncMap(this.t.connectors, content.connectors, (c) => entity({ ...c }), patchFields);
    });
  }

  snapshot(): BoardContent {
    return readBoard(this.doc);
  }

}

function patchFields<T extends object>(m: YEntity, value: T): void {
  for (const [k, v] of Object.entries(value)) if (m.get(k) !== v) m.set(k, v);
}

function syncMap<T extends { id: string }>(
  map: Y.Map<YEntity>,
  items: readonly T[],
  create: (item: T) => YEntity,
  patch: (m: YEntity, item: T) => void,
): void {
  const wanted = new Map(items.map((i) => [i.id, i]));
  for (const key of [...map.keys()]) if (!wanted.has(key)) map.delete(key);
  for (const item of items) {
    const existing = map.get(item.id);
    if (existing) patch(existing, item);
    else map.set(item.id, create(item));
  }
}
