import { computed, Signal } from '@angular/core';
import * as Y from 'yjs';
import { arrayEqual, KeyedSignals, ySignal, YSignalRef } from '../core/crdt/y-signal';
import { Card, Column, Connector, Note } from '../domain/model';
import { compareRanked, Ranked } from '../domain/rank';
import { readCard, readColumn, readConnector, readNote } from '../domain/read';
import { boardTypes } from '../domain/schema';

interface Placement extends Ranked {
  readonly columnId: string;
}

const placementEqual = (a: Placement, b: Placement) => a.columnId === b.columnId && a.rank === b.rank;

/**
 * Read side of a board: signals derived from the Y.Doc with minimal recomputation.
 *
 * - `card(id)` changes only when that card changes (one component re-renders per edit).
 * - Column card lists derive from a *placement* projection (columnId + rank only), so typing in
 *   a card description does not re-sort any column.
 */
export class BoardStore {
  readonly columns: KeyedSignals<Column>;
  readonly cards: KeyedSignals<Card>;
  readonly notes: KeyedSignals<Note>;
  private readonly placements: KeyedSignals<Placement>;
  private readonly connectorsRef: YSignalRef<Connector[]>;
  private readonly columnListCache = new Map<string, Signal<readonly string[]>>();

  readonly columnOrder: Signal<readonly string[]>;
  readonly connectors: Signal<Connector[]>;
  /** Column id -> ordered card ids. Cards of a concurrently deleted column go to the first column. */
  readonly cardIdsByColumn: Signal<ReadonlyMap<string, readonly string[]>>;
  readonly noteIds: Signal<readonly string[]>;
  readonly cardCount: Signal<number>;
  readonly noteCount: Signal<number>;

  constructor(doc: Y.Doc) {
    const t = boardTypes(doc);
    this.columns = new KeyedSignals(t.columns, { project: readColumn });
    this.cards = new KeyedSignals(t.cards, { project: readCard });
    this.notes = new KeyedSignals(t.notes, { project: readNote });
    this.placements = new KeyedSignals(t.cards, {
      project: (m) => ({ id: m.get('id') as string, columnId: m.get('columnId') as string, rank: m.get('rank') as string }),
      fields: ['columnId', 'rank'],
      equal: placementEqual,
    });
    this.connectorsRef = ySignal(t.connectors as unknown as Y.AbstractType<unknown>, () => [...t.connectors.values()].map(readConnector));

    this.columnOrder = computed(() => [...this.columns.entries().values()].sort(compareRanked).map((c) => c.id), { equal: arrayEqual });
    this.cardIdsByColumn = computed(() => {
      const order = this.columnOrder();
      const known = new Set(order);
      const groups = new Map<string, Placement[]>(order.map((id) => [id, []]));
      for (const p of this.placements.entries().values()) {
        const target = known.has(p.columnId) ? p.columnId : order[0];
        if (target) groups.get(target)!.push(p);
      }
      return new Map([...groups].map(([id, list]) => [id, list.sort(compareRanked).map((p) => p.id)]));
    });
    this.noteIds = computed(() => [...this.notes.entries().values()].sort((a, b) => a.z - b.z || (a.id < b.id ? -1 : 1)).map((n) => n.id), { equal: arrayEqual });
    const noteIdSet = computed(() => new Set(this.noteIds()));
    this.connectors = computed(() => {
      const ids = noteIdSet();
      return this.connectorsRef.value().filter((c) => ids.has(c.from) && ids.has(c.to));
    });
    this.cardCount = this.placements.size;
    this.noteCount = this.notes.size;
  }

  card(id: string): Signal<Card | undefined> {
    return this.cards.get(id);
  }

  column(id: string): Signal<Column | undefined> {
    return this.columns.get(id);
  }

  note(id: string): Signal<Note | undefined> {
    return this.notes.get(id);
  }

  /** Stable per-column signal that only notifies when that column's order changes. */
  columnCardIds(columnId: string): Signal<readonly string[]> {
    let s = this.columnListCache.get(columnId);
    if (!s) {
      s = computed(() => this.cardIdsByColumn().get(columnId) ?? [], { equal: arrayEqual });
      this.columnListCache.set(columnId, s);
    }
    return s;
  }

  destroy(): void {
    this.columns.destroy();
    this.cards.destroy();
    this.notes.destroy();
    this.placements.destroy();
    this.connectorsRef.destroy();
  }
}
