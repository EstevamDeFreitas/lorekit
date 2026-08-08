import {
  compareSyncClock,
  rateLimitRetryDelay,
  SYNC_MUTATION_DEBOUNCE_MS,
} from './sync-engine.service';

describe('sync engine timing', () => {
  it('waits 15 seconds after local mutations', () => {
    expect(SYNC_MUTATION_DEBOUNCE_MS).toBe(15_000);
  });

  it('waits at least 15 seconds after a 429 response', () => {
    const error = {
      status: 429,
      headers: { get: () => '3' },
    };
    expect(rateLimitRetryDelay(error)).toBe(15_000);
  });

  it('honors a longer Retry-After response', () => {
    const error = {
      status: 429,
      headers: { get: () => '20' },
    };
    expect(rateLimitRetryDelay(error)).toBe(20_000);
  });

  it('does not impose a rate-limit delay on other errors', () => {
    expect(rateLimitRetryDelay({ status: 500 })).toBeNull();
  });

  it('chooses the newest modification regardless of arrival order', () => {
    const older = { modifiedAt: '1000', changeId: 'ffffffffffffffffffffffffffffffff' };
    const newer = { modifiedAt: '1001', changeId: '00000000000000000000000000000000' };
    expect(compareSyncClock(newer, older)).toBe(1);
    expect(compareSyncClock(older, newer)).toBe(-1);
  });

  it('breaks millisecond ties lexicographically and deterministically', () => {
    const lower = { modifiedAt: '1000', changeId: '0000000000000000000000000000000a' };
    const higher = { modifiedAt: '1000', changeId: '0000000000000000000000000000000b' };
    expect(compareSyncClock(higher, lower)).toBeGreaterThan(0);
    expect(compareSyncClock(lower, higher)).toBeLessThan(0);
    expect(compareSyncClock(lower, lower)).toBe(0);
  });

  it('compares epoch values as bigint instead of floating point numbers', () => {
    expect(compareSyncClock(
      { modifiedAt: '9007199254740993', changeId: '0'.repeat(32) },
      { modifiedAt: '9007199254740992', changeId: 'f'.repeat(32) },
    )).toBe(1);
  });
});
