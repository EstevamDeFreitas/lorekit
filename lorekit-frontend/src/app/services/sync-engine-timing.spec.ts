import {
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
});
