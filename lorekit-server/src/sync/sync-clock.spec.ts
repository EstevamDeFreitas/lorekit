import { compareSyncClock } from './sync.service';

describe('compareSyncClock', () => {
  it('chooses the greatest modification timestamp', () => {
    const older = { modifiedAt: 1_000n, changeId: 'ffffffffffffffffffffffffffffffff' };
    const newer = { modifiedAt: 1_001n, changeId: '00000000000000000000000000000000' };

    expect(compareSyncClock(newer, older)).toBe(1);
    expect(compareSyncClock(older, newer)).toBe(-1);
  });

  it('uses changeId as a deterministic tie breaker', () => {
    const lower = { modifiedAt: 1_000n, changeId: '0000000000000000000000000000000a' };
    const higher = { modifiedAt: 1_000n, changeId: '0000000000000000000000000000000b' };

    expect(compareSyncClock(higher, lower)).toBe(1);
    expect(compareSyncClock(lower, higher)).toBe(-1);
    expect(compareSyncClock(lower, lower)).toBe(0);
  });

  it('keeps bigint precision for distant epoch values', () => {
    expect(compareSyncClock(
      { modifiedAt: 9_007_199_254_740_993n, changeId: '0'.repeat(32) },
      { modifiedAt: 9_007_199_254_740_992n, changeId: 'f'.repeat(32) },
    )).toBe(1);
  });
});
