import { computed, Signal, signal, WritableSignal } from '@angular/core';
import * as Y from 'yjs';

/**
 * The Yjs ⇄ Angular signals adapter.
 *
 * Yjs types are mutable and emit events; Angular templates want immutable values in signals.
 * These helpers observe Yjs deeply and push *new* immutable projections into signals only for
 * the parts that actually changed, so editing one card re-renders one card component.
 */

export interface YSignalRef<T> {
  readonly value: Signal<T>;
  destroy(): void;
}

/** Whole-type projection. Good for small types (board meta, connectors). */
export function ySignal<T>(type: Y.AbstractType<unknown>, project: () => T, equal?: (a: T, b: T) => boolean): YSignalRef<T> {
  const value = signal(project(), equal ? { equal } : undefined);
  const handler = () => value.set(project());
  type.observeDeep(handler);
  return { value: value.asReadonly(), destroy: () => type.unobserveDeep(handler) };
}

export interface KeyedSignalsOptions<V> {
  /** Builds the immutable value for one entry. */
  readonly project: (entry: Y.Map<unknown>, key: string) => V;
  /**
   * Only react to changes of these top-level fields of an entry (plus adds/removes of
   * entries). E.g. a "placement" view of cards only cares about `columnId` and `rank`.
   */
  readonly fields?: readonly string[];
  /** Skip notifying when the new projection equals the previous one. */
  readonly equal?: (a: V, b: V) => boolean;
}

/**
 * Keyed projection of a `Y.Map<Y.Map>`: one signal per entry, recomputed only for entries
 * touched by a transaction (derived from event paths), plus a lazily materialised map of
 * all entries.
 */
export class KeyedSignals<V> {
  private readonly values = new Map<string, V>();
  private readonly perKey = new Map<string, WritableSignal<V | undefined>>();
  private readonly version = signal(0);
  private readonly handler = (events: Y.YEvent<Y.AbstractType<unknown>>[]) => this.onEvents(events);
  /** How many entry projections ran — lets tests prove recomputation is minimal. */
  projections = 0;

  /** All entries. Materialised on read only, O(n) per change — use `get()` in hot paths. */
  readonly entries: Signal<ReadonlyMap<string, V>> = computed(() => {
    this.version();
    return new Map(this.values);
  });
  readonly size = computed(() => {
    this.version();
    return this.values.size;
  });

  constructor(
    private readonly map: Y.Map<Y.Map<unknown>>,
    private readonly options: KeyedSignalsOptions<V>,
  ) {
    for (const [key, entry] of map) this.values.set(key, this.project(entry, key));
    map.observeDeep(this.handler);
  }

  /** Signal of one entry (undefined once deleted). Signals are created lazily and cached. */
  get(key: string): Signal<V | undefined> {
    let s = this.perKey.get(key);
    if (!s) {
      s = signal(this.values.get(key));
      this.perKey.set(key, s);
    }
    return s.asReadonly();
  }

  peek(key: string): V | undefined {
    return this.values.get(key);
  }

  destroy(): void {
    this.map.unobserveDeep(this.handler);
    this.perKey.clear();
  }

  private project(entry: Y.Map<unknown>, key: string): V {
    this.projections++;
    return this.options.project(entry, key);
  }

  private onEvents(events: Y.YEvent<Y.AbstractType<unknown>>[]): void {
    const dirty = new Set<string>();
    const fields = this.options.fields;
    for (const event of events) {
      if (event.target === this.map) {
        for (const key of event.changes.keys.keys()) dirty.add(key);
        continue;
      }
      const [key, field] = event.path as [string, string | undefined];
      if (fields) {
        const touched = field !== undefined ? [field] : [...event.changes.keys.keys()];
        if (!touched.some((f) => fields.includes(f))) continue;
      }
      dirty.add(key);
    }
    let changed = false;
    for (const key of dirty) {
      const entry = this.map.get(key);
      if (!entry) {
        if (this.values.delete(key)) changed = true;
        this.perKey.get(key)?.set(undefined);
        continue;
      }
      const prev = this.values.get(key);
      const next = this.project(entry, key);
      if (prev !== undefined && this.options.equal?.(prev, next)) continue;
      this.values.set(key, next);
      this.perKey.get(key)?.set(next);
      changed = true;
    }
    if (changed) this.version.update((v) => v + 1);
  }
}

export function arrayEqual<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
