import { DestroyRef } from '@angular/core';
import { fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { FlushableDebounce } from './flushable-debounce';
import { DISCARD_PENDING_SAVES_EVENT, FLUSH_PENDING_SAVES_EVENT, flushPendingComponentSaves } from './pending-save-event';
import { WorkspaceTabContext } from '../models/workspace-tab-context';

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

  it('flushes only the tab requested by a workspace transition', fakeAsync(() => {
    const first = createDestroyRef();
    const second = createDestroyRef();
    const firstContext = new WorkspaceTabContext('tab-a');
    const secondContext = new WorkspaceTabContext('tab-b');
    firstContext.setActive(true);
    secondContext.setActive(true);
    const firstTask = jasmine.createSpy('firstTask');
    const secondTask = jasmine.createSpy('secondTask');
    const firstDebounce = new FlushableDebounce(first.destroyRef, 100, firstContext);
    const secondDebounce = new FlushableDebounce(second.destroyRef, 100, secondContext);
    firstDebounce.schedule(firstTask);
    secondDebounce.schedule(secondTask);

    void flushPendingComponentSaves('tab-a');
    flushMicrotasks();

    expect(firstTask).toHaveBeenCalledTimes(1);
    expect(secondTask).not.toHaveBeenCalled();
    secondDebounce.discard();
    first.destroy();
    second.destroy();
    tick(100);
  }));

  it('pauses a tab timer while detached and resumes it when activated', fakeAsync(() => {
    const { destroyRef, destroy } = createDestroyRef();
    const context = new WorkspaceTabContext('tab-a');
    const task = jasmine.createSpy('task');
    const debounce = new FlushableDebounce(destroyRef, 100, context);
    context.setActive(true);
    debounce.schedule(task);
    context.setActive(false);

    tick(150);
    expect(task).not.toHaveBeenCalled();

    context.setActive(true);
    tick(100);
    expect(task).toHaveBeenCalledTimes(1);
    destroy();
  }));
});
