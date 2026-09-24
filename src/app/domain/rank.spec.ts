import { compareRanked, rankBetween, rankForIndex, spreadRanks } from './rank';

describe('rank (fractional indexing)', () => {
  it('produces keys strictly between the bounds', () => {
    expect(rankBetween(null, null)).toBe('i');
    const a = rankBetween(null, 'i');
    const b = rankBetween('i', null);
    expect(a < 'i' && 'i' < b).toBe(true);
    const m = rankBetween(a, 'i');
    expect(a < m && m < 'i').toBe(true);
  });

  it('keeps finding room between adjacent keys', () => {
    let lo = 'a';
    const hi = 'b';
    for (let i = 0; i < 200; i++) {
      const mid = rankBetween(lo, hi);
      expect(lo < mid && mid < hi).toBe(true);
      expect(mid.endsWith('0')).toBe(false);
      lo = mid;
    }
  });

  it('rejects inverted or malformed bounds', () => {
    expect(() => rankBetween('b', 'a')).toThrow();
    expect(() => rankBetween('a0', null)).toThrow();
    expect(() => rankBetween('A', null)).toThrow();
  });

  it('spreads short, sorted, unique ranks', () => {
    for (const n of [1, 5, 36, 250, 1000]) {
      const ranks = spreadRanks(n);
      expect(new Set(ranks).size).toBe(n);
      expect([...ranks].sort()).toEqual(ranks);
      expect(ranks.every((r) => !r.endsWith('0') && r.length <= 4)).toBe(true);
    }
  });

  it('places items by index, including the ends', () => {
    const sib = spreadRanks(3).map((rank, i) => ({ id: `c${i}`, rank }));
    for (let idx = 0; idx <= 3; idx++) {
      const { rank, repairs } = rankForIndex(sib, idx);
      expect(repairs).toEqual([]);
      const all = [...sib, { id: 'new', rank }].sort(compareRanked);
      expect(all.findIndex((x) => x.id === 'new')).toBe(idx);
    }
  });

  it('repairs equal neighbour ranks so the item lands where it was dropped', () => {
    // Two offline replicas both inserted "at the top" and picked the same rank.
    const sib = [
      { id: 'a', rank: 'i' },
      { id: 'b', rank: 'i' },
      { id: 'c', rank: 'r' },
    ];
    const { rank, repairs } = rankForIndex(sib, 1);
    const patched = sib.map((s) => ({ ...s, rank: repairs.find((r) => r.id === s.id)?.rank ?? s.rank }));
    const all = [...patched, { id: 'new', rank }].sort(compareRanked);
    expect(all.map((x) => x.id)).toEqual(['a', 'new', 'b', 'c']);
  });
});
