/**
 * Transaction origins. Yjs passes the origin through to observers, the UndoManager and
 * providers, which is how we scope undo to "my own edits" and avoid echoing updates.
 */
export const LOCAL_ORIGIN = Symbol('local-user');
export const HISTORY_ORIGIN = Symbol('history-recorder');
export const SYSTEM_ORIGIN = Symbol('system');
