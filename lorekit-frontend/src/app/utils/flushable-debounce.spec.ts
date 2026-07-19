import { DestroyRef } from '@angular/core';
import { fakeAsync, tick } from '@angular/core/testing';
import { FlushableDebounce } from './flushable-debounce';

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
    const { destroyRef } = createDestroyRef();
    const debounce = new FlushableDebounce(destroyRef, 100);
    const first = jasmine.createSpy('first');
    const second = jasmine.createSpy('second');

    debounce.schedule(first);
    debounce.schedule(second);
    tick(100);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
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
});