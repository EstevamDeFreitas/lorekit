import { DestroyRef } from '@angular/core';
import { fakeAsync, tick } from '@angular/core/testing';
import { FlushableDebounce } from './flushable-debounce';
import { DISCARD_PENDING_SAVES_EVENT, FLUSH_PENDING_SAVES_EVENT } from './pending-save-event';

describe('FlushableDebounce', () => {
  function createDestroyRef() {
    let destroyCallback = () => {};

    const destroyRef = {
      onDestroy: (callback: () => void) => {
        destroyCallback = callback;
        return () => {};
      },
    } as unknown as DestroyRef;

    return {
      destroyRef,
      destroy: () => destroyCallback(),
    };
  }

  it('keeps only the latest scheduled task', fakeAsync(() => {
    const { destroyRef, destroy } = createDestroyRef();
    const debounce = new FlushableDebounce(destroyRef, 100);
    const first = jasmine.createSpy('first');
    const second = jasmine.createSpy('second');

    debounce.schedule(first);
    debounce.schedule(second);
    tick(100);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    destroy();
  }));

  it('flushes a pending task during teardown without running it twice', fakeAsync(() => {
    const { destroyRef, destroy } = createDestroyRef();
    const debounce = new FlushableDebounce(destroyRef, 100);
    const task = jasmine.createSpy('task');

    debounce.schedule(task);
    destroy();

    expect(task).toHaveBeenCalledTimes(1);
    tick(100);
    expect(task).toHaveBeenCalledTimes(1);
  }));

  it('flushes pending tasks when the workspace requests a safe refresh', fakeAsync(() => {
    const { destroyRef, destroy } = createDestroyRef();
    const debounce = new FlushableDebounce(destroyRef, 100);
    const task = jasmine.createSpy('task');

    debounce.schedule(task);
    window.dispatchEvent(new Event(FLUSH_PENDING_SAVES_EVENT));

    expect(task).toHaveBeenCalledTimes(1);
    destroy();
    tick(100);
    expect(task).toHaveBeenCalledTimes(1);
  }));

  it('discards stale pending tasks before a remote refresh teardown', fakeAsync(() => {
    const { destroyRef, destroy } = createDestroyRef();
    const debounce = new FlushableDebounce(destroyRef, 100);
    const task = jasmine.createSpy('task');

    debounce.schedule(task);
    window.dispatchEvent(new Event(DISCARD_PENDING_SAVES_EVENT));
    destroy();
    tick(100);

    expect(task).not.toHaveBeenCalled();
  }));
});