// Deterministic shuffle keyed off a stable id (an Attempt's own primary key).
// The schema has no column to persist a shuffled question order, so instead
// of a migration, the "persisted" order is re-derived on every load from a
// seed that never changes (attempt.id) — same seed always produces the same
// permutation, so a reload never reshuffles, with zero extra stored state.

function hashStringToSeed(input: string): number {
  let hash = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    hash = Math.imul(hash ^ input.charCodeAt(i), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(items: T[], seed: string): T[] {
  const random = mulberry32(hashStringToSeed(seed));
  return items
    .map((item) => ({ item, sort: random() }))
    .sort((a, b) => a.sort - b.sort)
    .map((entry) => entry.item);
}
