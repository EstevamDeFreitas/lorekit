import { DatabasePersistenceCoordinator } from './database.helper';

describe('DatabasePersistenceCoordinator', () => {
  it('coalesces synchronous requests into one write', async () => {
    const db = {};
    const writer = jasmine.createSpy('writer').and.resolveTo();
    const coordinator = new DatabasePersistenceCoordinator(db, writer);

    for (let index = 0; index < 10; index++) {
      coordinator.requestPersist();
    }

    await coordinator.flush();

    expect(writer).toHaveBeenCalledTimes(1);
    expect(writer).toHaveBeenCalledWith(db);
  });

  it('serializes a follow-up write requested while another write is active', async () => {
    const resolvers: Array<() => void> = [];
    let activeWrites = 0;
    let maxActiveWrites = 0;
    let writeCount = 0;

    const writer = async () => {
      writeCount++;
      activeWrites++;
      maxActiveWrites = Math.max(maxActiveWrites, activeWrites);
      await new Promise<void>(resolve => resolvers.push(resolve));
      activeWrites--;
    };

    const coordinator = new DatabasePersistenceCoordinator({}, writer);
    coordinator.requestPersist();

    await Promise.resolve();
    expect(writeCount).toBe(1);

    coordinator.requestPersist();
    coordinator.requestPersist();
    resolvers.shift()?.();

    await Promise.resolve();
    await Promise.resolve();
    expect(writeCount).toBe(2);

    resolvers.shift()?.();
    await coordinator.flush();

    expect(writeCount).toBe(2);
    expect(maxActiveWrites).toBe(1);
  });
});