import { BoardContent, Card } from '../../domain/model';

export type ReportKind = 'lww' | 'delete-wins' | 'both-kept' | 'text-merge' | 'one-sided';

export interface ReportLine {
  readonly kind: ReportKind;
  readonly cardId: string;
  readonly text: string;
}

const q = (s: string) => `“${s}”`;

/**
 * Explains, after a merge, how each concurrent edit was resolved — computed by diffing the
 * common base, both replicas before reconnecting and the merged result (not hard-coded).
 */
export function mergeReport(base: BoardContent, a: BoardContent, b: BoardContent, merged: BoardContent): ReportLine[] {
  const index = (c: BoardContent) => new Map(c.cards.map((card) => [card.id, card]));
  const [B0, A, Bm, M] = [index(base), index(a), index(b), index(merged)];
  const colName = (id: string | undefined) => merged.columns.find((c) => c.id === id)?.title ?? base.columns.find((c) => c.id === id)?.title ?? '?';
  const lines: ReportLine[] = [];
  const ids = new Set([...B0.keys(), ...A.keys(), ...Bm.keys()]);

  for (const id of ids) {
    const [o, ca, cb, m] = [B0.get(id), A.get(id), Bm.get(id), M.get(id)];
    if (!o) {
      const who = ca ? 'A' : 'B';
      lines.push({ kind: 'both-kept', cardId: id, text: `${who} added ${q((ca ?? cb)!.title)} — kept. Concurrent inserts never overwrite each other; order comes from fractional ranks (ties broken by id).` });
      continue;
    }
    if (!ca || !cb) {
      const deleter = !ca ? 'A' : 'B';
      const other = !ca ? cb : ca;
      const otherName = deleter === 'A' ? 'B' : 'A';
      const changed = other && changes(o, other);
      lines.push({
        kind: changed ? 'delete-wins' : 'one-sided',
        cardId: id,
        text: changed
          ? `${deleter} deleted ${q(o.title)} while ${otherName} ${changed} → the delete wins: writes into a deleted Y.Map are discarded, so nothing is resurrected or duplicated.`
          : `${deleter} deleted ${q(o.title)} — applied.`,
      });
      continue;
    }
    if (!m) continue;
    if (ca.title !== o.title && cb.title !== o.title && ca.title !== cb.title) {
      const winner = m.title === ca.title ? 'A' : 'B';
      lines.push({ kind: 'lww', cardId: id, text: `Both renamed ${q(o.title)}: kept ${q(m.title)} from ${winner}. Same field written concurrently → last-writer-wins; for truly concurrent writes Yjs breaks the tie by client id, identically on every replica.` });
    }
    const movedA = ca.columnId !== o.columnId || ca.rank !== o.rank;
    const movedB = cb.columnId !== o.columnId || cb.rank !== o.rank;
    if (movedA && movedB && (ca.columnId !== cb.columnId || ca.rank !== cb.rank)) {
      const winner = m.columnId === ca.columnId && m.rank === ca.rank ? 'A' : 'B';
      lines.push({ kind: 'lww', cardId: id, text: `Both moved ${q(m.title)} (A → ${colName(ca.columnId)}, B → ${colName(cb.columnId)}): it ends in ${colName(m.columnId)} (${winner}’s move). A move is one write of columnId + rank, so the card exists exactly once.` });
    }
    if (ca.description !== o.description && cb.description !== o.description) {
      lines.push({ kind: 'text-merge', cardId: id, text: `Both edited the text of ${q(m.title)}: merged character by character (Y.Text) → ${q(m.description)}.` });
    }
  }
  const order: ReportKind[] = ['lww', 'delete-wins', 'text-merge', 'both-kept', 'one-sided'];
  return lines.sort((x, y) => order.indexOf(x.kind) - order.indexOf(y.kind));
}

function changes(o: Card, c: Card): string | null {
  if (c.columnId !== o.columnId || c.rank !== o.rank) return 'moved it';
  if (c.title !== o.title) return 'renamed it';
  if (c.description !== o.description) return 'edited it';
  return null;
}
