/**
 * Fractional indexing for ordering items inside a CRDT map.
 *
 * Each item stores a `rank` string; order is lexicographic by (rank, id). Moving an item is a
 * single LWW write of its own `rank` (and `columnId`), so concurrent moves of the same item
 * converge to one position, and concurrent moves of different items never duplicate or lose
 * anything — unlike delete+insert "moves" in a Y.Array, which duplicate on concurrent moves.
 *
 * Algorithm: midpoint between two base-36 fractions (after rocicorp/fractional-indexing,
 * without the integer part). Ranks never end in '0', so a midpoint always exists.
 */
const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';
const ZERO = DIGITS[0];

function midpoint(a: string, b: string | null): string {
  if (b !== null) {
    let n = 0;
    while ((a[n] ?? ZERO) === b[n]) n++;
    if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n));
  }
  const digitA = a ? DIGITS.indexOf(a[0]) : 0;
  const digitB = b !== null ? DIGITS.indexOf(b[0]) : DIGITS.length;
  if (digitB - digitA > 1) return DIGITS[Math.round((digitA + digitB) / 2)];
  if (b !== null && b.length > 1) return b.slice(0, 1);
  return DIGITS[digitA] + midpoint(a.slice(1), null);
}

function isValid(rank: string): boolean {
  return rank.length > 0 && !rank.endsWith(ZERO) && [...rank].every((c) => DIGITS.includes(c));
}

/** A rank strictly between `a` and `b` (null = open end). Requires a < b. */
export function rankBetween(a: string | null, b: string | null): string {
  if (a !== null && !isValid(a)) throw new Error(`Invalid rank "${a}"`);
  if (b !== null && !isValid(b)) throw new Error(`Invalid rank "${b}"`);
  if (a !== null && b !== null && a >= b) throw new Error(`rankBetween: "${a}" >= "${b}"`);
  return midpoint(a ?? '', b);
}

/** `count` evenly spread, short ranks — for seeding and bulk generation. */
export function spreadRanks(count: number): string[] {
  const width = Math.max(1, Math.ceil(Math.log(count + 1) / Math.log(36)) + 1);
  const space = 36 ** width;
  return Array.from({ length: count }, (_, i) => {
    const s = Math.floor(((i + 1) * space) / (count + 1))
      .toString(36)
      .padStart(width, '0')
      .replace(/0+$/, '');
    return s || 'i';
  });
}

export interface Ranked {
  readonly id: string;
  readonly rank: string;
}

export function compareRanked(a: Ranked, b: Ranked): number {
  return a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export interface RankPlacement {
  readonly rank: string;
  /** Siblings that must be re-ranked (rare: only after concurrent inserts produced equal ranks). */
  readonly repairs: readonly { id: string; rank: string }[];
}

/**
 * Rank for inserting at `index` into `siblings` (already sorted, WITHOUT the moved item).
 * Equal neighbour ranks (two replicas inserted at the same spot while offline) are repaired
 * in the same transaction so the new item lands exactly where the user dropped it.
 */
export function rankForIndex(siblings: readonly Ranked[], index: number): RankPlacement {
  const i = Math.max(0, Math.min(index, siblings.length));
  const prev = siblings[i - 1]?.rank ?? null;
  const next = siblings[i]?.rank ?? null;
  if (prev === null || next === null || prev < next) return { rank: rankBetween(prev, next), repairs: [] };

  let j = i;
  while (j < siblings.length && siblings[j].rank <= prev) j++;
  const bound = siblings[j]?.rank ?? null;
  const rank = rankBetween(prev, bound);
  const repairs: { id: string; rank: string }[] = [];
  let lo = rank;
  for (let k = i; k < j; k++) {
    lo = rankBetween(lo, bound);
    repairs.push({ id: siblings[k].id, rank: lo });
  }
  return { rank, repairs };
}
