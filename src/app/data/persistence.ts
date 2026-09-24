import { IndexeddbPersistence } from 'y-indexeddb';
import * as Y from 'yjs';

/** IndexedDB database names. One database per Y.Doc, as y-indexeddb expects. */
export const WORKSPACE_DB = 'cb-workspace';
export const boardDbName = (id: string) => `cb-board-${id}`;
export const boardChannelName = (id: string) => `cb-board-${id}`;

/** Loads a board doc from IndexedDB without syncing (for export/duplicate from the list page). */
export async function loadBoardDoc(id: string, doc: Y.Doc): Promise<void> {
  const persistence = new IndexeddbPersistence(boardDbName(id), doc);
  await persistence.whenSynced;
  await persistence.destroy();
}

/**
 * Writes a freshly built doc to IndexedDB. y-indexeddb stores the full state on first open,
 * and IDBDatabase.close() lets pending transactions finish, so destroy() after sync is safe.
 */
export async function persistNewBoardDoc(id: string, doc: Y.Doc): Promise<void> {
  const persistence = new IndexeddbPersistence(boardDbName(id), doc);
  await persistence.whenSynced;
  await persistence.destroy();
}

export function deleteBoardDb(id: string): void {
  try {
    // If another tab still has the board open, deletion is "blocked" until it closes it.
    indexedDB.deleteDatabase(boardDbName(id));
  } catch {
    /* IndexedDB unavailable */
  }
}
