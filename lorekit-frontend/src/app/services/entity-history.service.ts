import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { EntityChangeService } from './entity-change.service';
import { DbProvider } from '../database/db-provider.service';
import { HistoryAddress, HistoryEditKind, HistoryEntity, HistoryStep, historyEntityKey, historyFieldKey } from '../models/entity-history.model';
import { EntityHistoryStore, normalizeHistoryValue } from './entity-history-store.service';
import { flushPendingComponentSaves } from '../utils/pending-save-event';

interface FieldState {
  address: HistoryAddress;
  value: string;
  persisted: string;
}
interface EntityHistory {
  steps: HistoryStep[];
  cursor: number;
  fields: Map<string, FieldState>;
}
export interface HistoryControl {
  address: HistoryAddress;
  flush?(): Promise<void> | void;
  apply(value: string): Promise<void> | void;
}

@Injectable({ providedIn: 'root' })
export class EntityHistoryService {
  private readonly store = inject(EntityHistoryStore);
  private readonly entityChanges = inject(EntityChangeService);
  private readonly histories = new Map<string, EntityHistory>();
  private readonly controls = new Set<HistoryControl>();
  private readonly revision = signal(0);
  private pending: Promise<void> = Promise.resolve();
  private epoch = 0;
  private group = 0;
  private lastAddress = '';
  private readonly captureErrors = new Map<string, unknown>();
  private readonly lifecycles = new Set<Promise<void>>();
  readonly active = signal<HistoryEntity | null>(null);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly applying = signal(false);
  readonly undoStep = computed(() => { this.revision(); const h = this.current(); return h?.steps[(h?.cursor ?? 0) - 1] ?? null; });
  readonly redoStep = computed(() => { this.revision(); const h = this.current(); return h?.steps[h.cursor] ?? null; });
  readonly canUndo = computed(() => !this.busy() && !!this.undoStep());
  readonly canRedo = computed(() => !this.busy() && !!this.redoStep());

  constructor() {
    const db = inject(DbProvider, { optional: true });
    let validationQueued = false;
    const unsubscribe = typeof db?.subscribeToMutations === 'function' ? db.subscribeToMutations(() => {
      if (validationQueued) return;
      validationQueued = true;
      queueMicrotask(() => {
        validationQueued = false;
        if (!db.ready()) return;
        for (const h of [...this.histories.values()]) {
          for (const state of h.fields.values()) {
            try { this.store.read(state.address); }
            catch { this.invalidate(state.address.entity); break; }
          }
        }
      });
    }) : undefined;
    inject(DestroyRef).onDestroy(() => unsubscribe?.());
    const subscription = this.entityChanges.changes$.subscribe(event => {
      if (event.action === 'delete') this.invalidate({ table: event.table, id: event.id }, false);
    });
    inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
  }

  trackLifecycle(operation: Promise<void>): void {
    this.lifecycles.add(operation);
    void operation.finally(() => this.lifecycles.delete(operation)).catch(error => {
      this.message.set('Não foi possível salvar o campo ao sair da edição.');
      console.error('Falha ao concluir edição.', error);
    });
  }

  async persistDraft(address: HistoryAddress): Promise<void> {
    const epoch = this.epoch;
    await this.pending;
    if (epoch !== this.epoch) return;
    const state = this.histories.get(historyEntityKey(address.entity))?.fields.get(historyFieldKey(address.field));
    if (!state) return;
    const stored = this.store.read(address);
    if (stored !== state.persisted && stored !== state.value) { this.invalidate(address.entity); return; }
    for (const listener of this.restoredListeners) await listener(address, state.value);
    if (stored !== state.value) this.store.write(address, state.value);
    await this.store.flush();
    state.persisted = state.value;
  }

  activate(entity: HistoryEntity | null): void {
    if (JSON.stringify(entity) === JSON.stringify(this.active())) return;
    this.boundary();
    this.active.set(entity?.id ? entity : null);
  }

  boundary(): void { this.group++; }

  observe(address: HistoryAddress, value: string): void {
    if (!address.entity.id) return;
    const h = this.history(address.entity);
    const key = historyFieldKey(address.field);
    const existing = h.fields.get(key);
    if (existing) return;
    let persisted: string;
    try { persisted = this.store.read(address); } catch { persisted = normalizeHistoryValue(value, address.field); }
    h.fields.set(key, { address: structuredClone(address), value: persisted, persisted });
  }

  register(control: HistoryControl): () => void {
    this.controls.add(control);
    return () => { this.controls.delete(control); };
  }

  /** Reserve ordering now; capture completion order never determines undo order. */
  capture(address: HistoryAddress, before: string, after: string | Promise<string>, kind: HistoryEditKind = 'typing'): Promise<void> {
    if (!address.entity.id || this.applying()) return Promise.resolve();
    this.observe(address, before);
    const owner = this.histories.get(historyEntityKey(address.entity));
    const key = historyEntityKey(address.entity) + historyFieldKey(address.field);
    if (key !== this.lastAddress || kind !== 'typing') this.boundary();
    this.lastAddress = key;
    const group = this.group;
    const epoch = this.epoch;
    const time = Date.now();
    // Attach the rejection handler immediately, including while earlier captures are pending.
    const result = Promise.resolve(after).then(value => ({ value }), error => ({ error }));
    this.pending = this.pending.then(async () => {
      const resolved = await result;
      if (epoch !== this.epoch || this.histories.get(historyEntityKey(address.entity)) !== owner) return;
      if ('error' in resolved) throw resolved.error;
      this.record(address, resolved.value, kind, group, time);
      this.captureErrors.delete(key);
    }).catch(error => { this.captureErrors.set(key, error); this.message.set('Não foi possível capturar a edição. Tente salvar o campo novamente.'); });
    if (kind !== 'typing') this.boundary();
    return this.pending;
  }

  async settle(): Promise<void> {
    await Promise.all([...this.lifecycles]);
    await Promise.all([...this.controls].map(control => control.flush?.()));
    await this.pending;
    if (this.captureErrors.size) throw this.captureErrors.values().next().value;
  }

  async undo(): Promise<void> { await this.move(-1); }
  async redo(): Promise<void> { await this.move(1); }

  clear(): void {
    this.epoch++;
    this.histories.clear();
    this.captureErrors.clear();
    this.active.set(null);
    this.message.set('');
    this.boundary();
    this.touch();
  }

  invalidate(entity: HistoryEntity, notify = true): void {
    const key = historyEntityKey(entity);
    const hadSteps = !!this.histories.get(key)?.steps.length;
    this.histories.delete(key);
    for (const fieldKey of this.captureErrors.keys()) if (fieldKey.startsWith(key)) this.captureErrors.delete(fieldKey);
    if (notify && hadSteps) this.message.set('O histórico foi reiniciado porque a entidade ou seus campos foram alterados fora desta edição.');
    this.touch();
  }

  validateExternal(): void {
    for (const h of [...this.histories.values()]) {
      for (const state of h.fields.values()) {
        try {
          if (this.store.read(state.address) === state.value) { state.persisted = state.value; continue; }
        } catch { /* Entity or field removed. */ }
        this.invalidate(state.address.entity);
        break;
      }
    }
  }

  hasAssetReference(reference: string): boolean {
    for (const history of this.histories.values()) {
      for (const state of history.fields.values()) {
        if (state.value.includes(reference) || state.persisted.includes(reference)) return true;
      }
      if (history.steps.some(step => step.before.includes(reference) || step.after.includes(reference))) return true;
    }
    return false;
  }

  private record(address: HistoryAddress, after: string, kind: HistoryEditKind, group: number, time: number): void {
    const h = this.history(address.entity);
    const key = historyFieldKey(address.field);
    const state = h.fields.get(key);
    if (!state) return;
    const previous = state.value;
    const next = normalizeHistoryValue(after, address.field);
    if (previous === next) return;
    h.steps.splice(h.cursor);
    const last = h.steps.at(-1);
    if (kind === 'typing' && last?.kind === 'typing' && last.group === group && historyFieldKey(last.field) === key && time - last.time <= 600) {
      last.after = next;
      last.time = time;
      if (last.before === next) h.steps.pop();
    } else {
      h.steps.push({ ...structuredClone(address), before: previous, after: next, kind, group, time });
    }
    state.value = next;
    h.cursor = h.steps.length;
    this.touch();
  }

  private async move(direction: -1 | 1): Promise<void> {
    const entity = this.active();
    if (!entity || this.busy()) return;
    this.busy.set(true);
    const epoch = this.epoch;
    this.message.set('');
    let rollback: { step: HistoryStep; value: string } | null = null;
    try {
      await this.settle();
      await flushPendingComponentSaves();
      await this.pending;
      this.boundary();
      if (epoch !== this.epoch) return;
      const h = this.histories.get(historyEntityKey(entity));
      if (!h) return;
      const step = h.steps[direction === -1 ? h.cursor - 1 : h.cursor];
      if (!step) return;
      // Flush unsaved textual drafts only if the persisted base is still compatible.
      for (const state of h.fields.values()) {
        let stored: string;
        try { stored = this.store.read(state.address); } catch { this.invalidate(entity); return; }
        if (stored !== state.persisted && stored !== state.value) { this.invalidate(entity); return; }
      }
      for (const state of h.fields.values()) {
        if (this.store.read(state.address) !== state.value) this.store.write(state.address, state.value);
        state.persisted = state.value;
      }
      await this.store.flush();
      if (epoch !== this.epoch) return;
      const value = direction === -1 ? step.before : step.after;
      rollback = { step, value: direction === -1 ? step.after : step.before };
      this.applying.set(true);
      await this.applyControls(step, value);
      await flushPendingComponentSaves();
      this.store.write(step, value);
      await this.store.flush();
      if (epoch !== this.epoch) return;
      const state = h.fields.get(historyFieldKey(step.field))!;
      state.value = state.persisted = value;
      h.cursor += direction;
      rollback = null;
      this.touch();
      this.entityChanges.notifySave(entity.table, entity.id);
    } catch (error) {
      if (rollback && epoch === this.epoch) {
        try {
          await this.applyControls(rollback.step, rollback.value);
          await flushPendingComponentSaves();
          this.store.write(rollback.step, rollback.value);
          await this.store.flush();
        } catch { /* Keep cursor unchanged and the persistence coordinator dirty for retry. */ }
      }
      this.message.set('Não foi possível restaurar a edição. O histórico foi mantido; tente novamente.');
      console.error('Falha ao restaurar histórico da entidade.', error);
    } finally {
      this.applying.set(false);
      this.busy.set(false);
    }
  }

  private async applyControls(address: HistoryAddress, value: string): Promise<void> {
    for (const control of [...this.controls]) {
      if (historyEntityKey(control.address.entity) === historyEntityKey(address.entity) &&
          historyFieldKey(control.address.field) === historyFieldKey(address.field)) {
        await control.apply(value);
      }
    }
    for (const listener of this.restoredListeners) await listener(address, value);
  }

  private readonly restoredListeners = new Set<(address: HistoryAddress, value: string) => void | Promise<void>>();
  onRestore(listener: (address: HistoryAddress, value: string) => void | Promise<void>): () => void {
    this.restoredListeners.add(listener);
    return () => { this.restoredListeners.delete(listener); };
  }

  private history(entity: HistoryEntity): EntityHistory {
    const key = historyEntityKey(entity);
    let h = this.histories.get(key);
    if (!h) { h = { steps: [], cursor: 0, fields: new Map() }; this.histories.set(key, h); }
    return h;
  }
  private current(): EntityHistory | undefined { const entity = this.active(); return entity ? this.histories.get(historyEntityKey(entity)) : undefined; }
  private touch(): void { this.revision.update(value => value + 1); }
}
