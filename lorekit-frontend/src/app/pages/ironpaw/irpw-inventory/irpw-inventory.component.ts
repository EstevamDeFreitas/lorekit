import { ButtonComponent } from '../../../components/button/button.component';
import { InputComponent } from '../../../components/input/input.component';
import { TextAreaComponent } from '../../../components/text-area/text-area.component';
import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup, moveItemInArray } from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IrpwCharacterSheet } from '../../../models/irpw-character-sheet.model';
import {
  IRPW_EQUIPMENT_SLOTS,
  IRPW_EQUIPMENT_SLOT_LABEL,
  IrpwEquipmentSlot,
  IrpwInventoryEntry,
  IrpwInventoryEnvelope,
  createEmptyInventory,
  parseIrpwDefensePoints,
  parseIrpwInventory,
  protectionContribution,
} from '../../../models/irpw-item.model';
import {
  IrpwCatalogItem,
  IrpwItemCatalogService,
} from '../../../services/irpw-item-catalog.service';
import { IrpwCharacterSheetService } from '../../../services/irpw-character-sheet.service';
import { CharacterService } from '../../../services/character.service';
import { HistoryAddress } from '../../../models/entity-history.model';
import { EntityHistoryService } from '../../../services/entity-history.service';

export interface IrpwCatalogUpdatePreview {
  entryId: string;
  changes: string[];
  nextStackLimit: number;
  splitCount: number;
  moveToBackpack: boolean;
}

@Component({
  selector: 'irpw-inventory',
  imports: [FormsModule, ButtonComponent, InputComponent, TextAreaComponent, CdkDrag, CdkDropList, CdkDropListGroup],
  templateUrl: './irpw-inventory.component.html',
  styleUrl: './irpw-inventory.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IrpwInventoryComponent implements OnInit {
  readonly characterId = input<string>('');
  private readonly sheetService = inject(IrpwCharacterSheetService);
  private readonly catalog = inject(IrpwItemCatalogService);
  private readonly characterService = inject(CharacterService);
  private readonly history = inject(EntityHistoryService);
  private readonly destroyRef = inject(DestroyRef);
  readonly slots = IRPW_EQUIPMENT_SLOTS;
  readonly slotLabel = IRPW_EQUIPMENT_SLOT_LABEL;
  inventory: IrpwInventoryEnvelope = createEmptyInventory();
  readonly emptyDropList: IrpwInventoryEntry[] = [];
  sheet: IrpwCharacterSheet | null = null;
  catalogItems: IrpwCatalogItem[] = [];
  selectedEntry: IrpwInventoryEntry | null = null;
  selectedSlot: IrpwEquipmentSlot | null = null;
  draggedEntry: IrpwInventoryEntry | null = null;
  showAdd = false;
  catalogSearch = '';
  backpackSearch = '';
  invalidInventory = false;
  catalogUpdatePreview: IrpwCatalogUpdatePreview | null = null;
  private historyAddress: HistoryAddress | null = null;
  private unregisterHistory: (() => void) | undefined;
  private lastHistoryState = '';
  defense = parseIrpwDefensePoints(null);

  constructor() {
    this.destroyRef.onDestroy(() => this.unregisterHistory?.());
    effect(() => {
      const id = this.characterId();
      if (id) this.load(id);
    });
  }
  ngOnInit(): void {
    if (this.characterId()) this.load(this.characterId());
  }
  load(characterId: string): void {
    this.catalogItems = this.catalog.getItems();
    this.sheet = this.sheetService.getSheet(characterId);
    this.inventory =
      parseIrpwInventory(this.sheet?.inventory) ?? createEmptyInventory();
    this.invalidInventory =
      !!this.sheet?.inventory && !parseIrpwInventory(this.sheet.inventory);
    const vocationContribution = this.vocationContributionFor(characterId);
    const protection = protectionContribution(this.inventory);
    this.defense = parseIrpwDefensePoints(
      this.sheet?.defensepoints,
      vocationContribution,
      protection,
    );
    this.defense.vocationContribution = vocationContribution;
    this.defense.protectionContribution = protection;
    if (this.defense.currentPoints !== null) {
      this.defense.currentPoints = Math.min(this.defense.currentPoints, this.defenseMax);
    }
    if (this.sheet && this.sheet.defensepoints !== JSON.stringify(this.defense)) {
      this.sheet.defensepoints = JSON.stringify(this.defense);
      this.sheet = this.sheetService.saveSheet(characterId, this.sheet);
    }
    this.lastHistoryState = this.sheet?.inventory || this.historyState();
    this.bindHistory(characterId);
    this.selectedEntry = null;
  }
  categoryLabel(item: IrpwCatalogItem | IrpwInventoryEntry): string {
    return 'snapshot' in item
      ? item.snapshot.definition.category
      : item.definition.category;
  }
  visibleCatalogItems(): IrpwCatalogItem[] {
    const term = this.catalogSearch.trim().toLocaleLowerCase();
    return this.catalogItems.filter(
      (item) =>
        !term ||
        `${item.name} ${item.description}`.toLocaleLowerCase().includes(term),
    );
  }
  visibleEntries(): IrpwInventoryEntry[] {
    const term = this.backpackSearch.trim().toLocaleLowerCase();
    return this.inventory.backpackOrder
      .map((id) =>
        this.inventory.entries.find((entry) => entry.instanceId === id),
      )
      .filter(
        (entry): entry is IrpwInventoryEntry =>
          !!entry &&
          (!term ||
            `${entry.snapshot.name} ${entry.snapshot.description}`
              .toLocaleLowerCase()
              .includes(term)),
      );
  }
  entryForSlot(slot: IrpwEquipmentSlot): IrpwInventoryEntry | null {
    const id = this.inventory.equipment[slot];
    return id
      ? (this.inventory.entries.find((entry) => entry.instanceId === id) ??
          null)
      : null;
  }
  compatibleSlots(entry: IrpwInventoryEntry): IrpwEquipmentSlot[] {
    return entry.snapshot.definition.equipmentSlots.filter(
      (slot) => slot !== 'secondary' || !this.secondaryBlocked,
    );
  }
  startDrag(entry: IrpwInventoryEntry): void {
    this.draggedEntry = entry;
  }
  endDrag(): void {
    this.draggedEntry = null;
  }
  isSlotCompatible(slot: IrpwEquipmentSlot): boolean {
    return !!this.draggedEntry && this.compatibleSlots(this.draggedEntry).includes(slot);
  }
  selectSlot(slot: IrpwEquipmentSlot): void {
    this.selectedSlot = slot;
    if (this.selectedEntry) this.equip(this.selectedEntry, slot);
  }
  addItem(item: IrpwCatalogItem): void {
    const definition = JSON.parse(JSON.stringify(item.definition));
    const entry: IrpwInventoryEntry = {
      instanceId: crypto.randomUUID(),
      sourceItemId: item.id,
      sourcePortableId: item.portableId,
      sourceRevision: item.revision ?? 1,
      snapshot: {
        name: item.name,
        description: item.description,
        definition,
        icon: definition.icon,
      },
      quantity: 1,
      notes: '',
      location: 'backpack',
      slot: null,
    };
    const compatible = definition.stackable && this.inventory.entries.find(
      (candidate) =>
        candidate.location === 'backpack' &&
        candidate.sourcePortableId === item.portableId &&
        JSON.stringify(candidate.snapshot.definition) ===
          JSON.stringify(definition) &&
        candidate.quantity < definition.stackLimit,
    );
    if (compatible) compatible.quantity += 1;
    else {
      this.inventory.entries.push(entry);
      this.inventory.backpackOrder.push(entry.instanceId);
    }
    this.showAdd = false;
    this.selectedEntry = compatible ?? entry;
    this.persist();
  }
  equip(entry: IrpwInventoryEntry, slot: IrpwEquipmentSlot): void {
    if (!entry.snapshot.definition.equipmentSlots.includes(slot)) return;
    if (slot === 'secondary' && this.secondaryBlocked) return;
    if (entry.quantity > 1) {
      entry.quantity -= 1;
      entry = { ...entry, instanceId: crypto.randomUUID(), quantity: 1 };
      this.inventory.entries.push(entry);
    }
    this.removeFromBackpack(entry.instanceId);
    const displaced = this.entryForSlot(slot);
    if (displaced && displaced.instanceId !== entry.instanceId)
      this.toBackpack(displaced);
    if (entry.snapshot.definition.weapon?.hands === 2 && slot === 'primary') {
      const secondary = this.entryForSlot('secondary');
      if (secondary) this.toBackpack(secondary);
      this.inventory.equipment.secondary = null;
    }
    entry.location = 'equipment';
    entry.slot = slot;
    this.inventory.equipment[slot] = entry.instanceId;
    this.selectedEntry = entry;
    this.persist();
  }
  unequip(slot: IrpwEquipmentSlot): void {
    const entry = this.entryForSlot(slot);
    if (!entry) return;
    this.inventory.equipment[slot] = null;
    this.toBackpack(entry);
    this.selectedSlot = null;
    this.persist();
  }
  removeEntry(entry: IrpwInventoryEntry): void {
    if (entry.location === 'equipment' && entry.slot)
      this.inventory.equipment[entry.slot] = null;
    this.inventory.entries = this.inventory.entries.filter(
      (item) => item.instanceId !== entry.instanceId,
    );
    this.inventory.backpackOrder = this.inventory.backpackOrder.filter(
      (id) => id !== entry.instanceId,
    );
    if (this.selectedEntry?.instanceId === entry.instanceId)
      this.selectedEntry = null;
    this.persist();
  }
  useEntry(entry: IrpwInventoryEntry): void {
    if (entry.snapshot.definition.category !== 'consumable') return;
    entry.quantity -= 1;
    if (entry.quantity <= 0) this.removeEntry(entry);
    else this.persist();
  }
  splitEntry(entry: IrpwInventoryEntry): void {
    if (entry.location === 'equipment' || entry.quantity <= 1) return;
    entry.quantity -= 1;
    const copy: IrpwInventoryEntry = {
      ...entry,
      instanceId: crypto.randomUUID(),
      quantity: 1,
      snapshot: {
        ...entry.snapshot,
        definition: JSON.parse(JSON.stringify(entry.snapshot.definition)),
      },
    };
    this.inventory.entries.push(copy);
    const index = this.inventory.backpackOrder.indexOf(entry.instanceId);
    this.inventory.backpackOrder.splice(
      index < 0 ? this.inventory.backpackOrder.length : index + 1,
      0,
      copy.instanceId,
    );
    this.selectedEntry = copy;
    this.persist();
  }
  combineEntry(entry: IrpwInventoryEntry): void {
    if (entry.location === 'equipment' || !entry.snapshot.definition.stackable)
      return;
    const other = this.inventory.entries.find(
      (candidate) =>
        candidate.instanceId !== entry.instanceId &&
        candidate.location === 'backpack' &&
        candidate.sourcePortableId === entry.sourcePortableId &&
        candidate.notes === entry.notes &&
        JSON.stringify(candidate.snapshot.definition) ===
          JSON.stringify(entry.snapshot.definition) &&
        candidate.snapshot.name === entry.snapshot.name,
    );
    if (!other) return;
    const room = Math.max(
      0,
      entry.snapshot.definition.stackLimit - entry.quantity,
    );
    const amount = Math.min(room, other.quantity);
    if (!amount) return;
    entry.quantity += amount;
    other.quantity -= amount;
    if (other.quantity <= 0) this.removeEntry(other);
    else this.persist();
  }
  saveEntry(entry: IrpwInventoryEntry): void {
    entry.quantity =
      entry.location === 'equipment'
        ? 1
        : Math.max(
            1,
            Math.min(
              entry.snapshot.definition.stackLimit,
              Math.trunc(Number(entry.quantity) || 1),
            ),
          );
    this.persist();
  }
  hasCatalogUpdate(entry: IrpwInventoryEntry): boolean {
    const source = entry.sourceItemId
      ? this.catalogItems.find((item) => item.id === entry.sourceItemId)
      : undefined;
    return !!source && (source.revision ?? 1) > (entry.sourceRevision ?? 0);
  }
  previewCatalogUpdate(entry: IrpwInventoryEntry): void {
    const source = entry.sourceItemId
      ? this.catalogItems.find((item) => item.id === entry.sourceItemId)
      : undefined;
    if (!source) return;
    const nextDefinition = JSON.parse(JSON.stringify(source.definition));
    const changes: string[] = [];
    if (entry.snapshot.name !== source.name) {
      changes.push(`Nome: ${entry.snapshot.name || 'sem nome'} → ${source.name || 'sem nome'}`);
    }
    if (entry.snapshot.description !== source.description) changes.push('Descrição atualizada.');
    if (JSON.stringify(entry.snapshot.definition) !== JSON.stringify(nextDefinition)) {
      changes.push('Características e compatibilidade atualizadas.');
    }
    const nextStackLimit = nextDefinition.stackable ? nextDefinition.stackLimit : 1;
    const splitCount = entry.location === 'backpack' && entry.quantity > nextStackLimit
      ? Math.ceil(entry.quantity / nextStackLimit) - 1
      : 0;
    if (splitCount) changes.push(`A pilha será dividida em ${splitCount + 1} grupos para respeitar o novo limite.`);
    const moveToBackpack = entry.location === 'equipment' && !!entry.slot && !nextDefinition.equipmentSlots.includes(entry.slot);
    if (moveToBackpack) changes.push(`O item deixará ${this.slotLabel[entry.slot!]} porque o espaço não é mais compatível.`);
    this.catalogUpdatePreview = { entryId: entry.instanceId, changes, nextStackLimit, splitCount, moveToBackpack };
  }
  applyCatalogUpdate(entry: IrpwInventoryEntry): void {
    const preview = this.catalogUpdatePreview;
    if (!preview || preview.entryId !== entry.instanceId) return;
    const source = entry.sourceItemId
      ? this.catalogItems.find((item) => item.id === entry.sourceItemId)
      : undefined;
    if (!source) return;
    const nextDefinition = JSON.parse(JSON.stringify(source.definition));
    const wasEquipped = entry.location === 'equipment';
    const slot = entry.slot;
    entry.snapshot = {
      name: source.name,
      description: source.description,
      definition: nextDefinition,
      icon: nextDefinition.icon,
    };
    entry.sourceRevision = source.revision ?? 1;
    if (wasEquipped && slot && !nextDefinition.equipmentSlots.includes(slot)) {
      this.inventory.equipment[slot] = null;
      this.toBackpack(entry);
    }
    if (!wasEquipped && entry.quantity > preview.nextStackLimit) {
      let remaining = entry.quantity;
      entry.quantity = Math.min(remaining, preview.nextStackLimit);
      remaining -= entry.quantity;
      while (remaining > 0) {
        const quantity = Math.min(remaining, preview.nextStackLimit);
        const copy: IrpwInventoryEntry = {
          ...entry,
          instanceId: crypto.randomUUID(),
          quantity,
          snapshot: { ...entry.snapshot, definition: JSON.parse(JSON.stringify(entry.snapshot.definition)) },
        };
        this.inventory.entries.push(copy);
        const index = this.inventory.backpackOrder.indexOf(entry.instanceId);
        this.inventory.backpackOrder.splice(index < 0 ? this.inventory.backpackOrder.length : index + 1, 0, copy.instanceId);
        remaining -= quantity;
      }
    }
    this.catalogUpdatePreview = null;
    this.persist();
  }
  dropOnSlot(event: CdkDragDrop<IrpwInventoryEntry[]>, slot: IrpwEquipmentSlot): void {
    const entry = event.item.data as IrpwInventoryEntry | undefined;
    if (!entry || !this.inventory.entries.some((candidate) => candidate.instanceId === entry.instanceId)) return;
    this.equip(entry, slot);
  }
  dropEntry(event: CdkDragDrop<IrpwInventoryEntry[]>): void {
    const visible = this.visibleEntries();
    const dragged = (event.item.data as IrpwInventoryEntry | undefined) ?? visible[event.previousIndex];
    if (!dragged) return;
    if (dragged.location === 'equipment') {
      this.toBackpack(dragged);
      this.persist();
      return;
    }
    const target = visible[Math.min(event.currentIndex, Math.max(visible.length - 1, 0))];
    const order = [...this.inventory.backpackOrder];
    const fromIndex = order.indexOf(dragged.instanceId);
    const toIndex = target ? order.indexOf(target.instanceId) : order.length - 1;
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
    moveItemInArray(order, fromIndex, toIndex);
    this.inventory.backpackOrder = order;
    this.persist();
  }
  activateReserve(entry: IrpwInventoryEntry): void {
    if (entry.slot !== 'reserve') return;
    const primary = this.entryForSlot('primary');
    if (primary && primary.instanceId !== entry.instanceId)
      this.toBackpack(primary);
    this.inventory.equipment.reserve = null;
    this.removeFromBackpack(entry.instanceId);
    entry.location = 'equipment';
    entry.slot = 'primary';
    this.inventory.equipment.primary = entry.instanceId;
    if (entry.snapshot.definition.weapon?.hands === 2) {
      const secondary = this.entryForSlot('secondary');
      if (secondary) this.toBackpack(secondary);
      this.inventory.equipment.secondary = null;
    }
    this.persist();
  }
  moveEntry(entry: IrpwInventoryEntry): void {
    if (entry.location !== 'backpack') return;
    this.inventory.backpackOrder = [
      ...this.inventory.backpackOrder.filter((id) => id !== entry.instanceId),
      entry.instanceId,
    ];
    this.persist();
  }
  get vocationContribution(): number {
    return this.defense.vocationContribution;
  }
  get manualAdjustment(): number {
    return this.defense.manualAdjustment;
  }
  get equippedEffects(): string[] {
    const effects = this.inventory.entries
      .filter((entry) => entry.location === 'equipment')
      .flatMap((entry) => [
        entry.snapshot.definition.protection?.effects,
        entry.snapshot.definition.weapon?.specialProperty,
        entry.snapshot.definition.narrativeEffect,
        ...entry.snapshot.definition.uniqueBenefits,
      ])
      .map((value) => value?.trim())
      .filter((value): value is string => !!value);
    return [...new Set(effects)];
  }
  get protection(): number {
    return protectionContribution(this.inventory);
  }
  get defenseMax(): number {
    return Math.max(
      0,
      this.defense.vocationContribution +
        this.defense.manualAdjustment +
        this.protection,
    );
  }
  setManualAdjustment(value: number | string): void {
    this.defense.manualAdjustment = Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : 0;
    this.persist();
  }
  get equipment(): Partial<Record<IrpwEquipmentSlot, string | null>> {
    return this.inventory.equipment;
  }
  get secondaryBlocked(): boolean {
    return (
      this.entryForSlot('primary')?.snapshot.definition.weapon?.hands === 2
    );
  }
  private toBackpack(entry: IrpwInventoryEntry): void {
    entry.location = 'backpack';
    entry.slot = null;
    if (!this.inventory.backpackOrder.includes(entry.instanceId))
      this.inventory.backpackOrder.push(entry.instanceId);
  }
  private removeFromBackpack(id: string): void {
    this.inventory.backpackOrder = this.inventory.backpackOrder.filter(
      (entryId) => entryId !== id,
    );
  }
  private vocationContributionFor(characterId: string): number {
    try {
      const value = Number(this.characterService.getCharacter(characterId)?.ParentIRPWVocation?.basedefense);
      return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
    } catch {
      return 0;
    }
  }
  private bindHistory(characterId: string): void {
    this.unregisterHistory?.();
    if (!this.sheet) {
      this.historyAddress = null;
      return;
    }
    this.historyAddress = {
      entity: { table: 'IRPWCharacterSheet', id: characterId },
      field: { column: 'inventory', label: 'Inventário e PR' },
    };
    this.history.observe(this.historyAddress, this.lastHistoryState);
    this.unregisterHistory = this.history.register({
      address: this.historyAddress,
      apply: (value) => this.applyHistoryState(value),
    });
  }
  private historyState(): string {
    return JSON.stringify({ ...this.inventory, defensepoints: this.defense });
  }
  private applyHistoryState(value: string): void {
    const parsed = parseIrpwInventory(value);
    if (!parsed || !this.sheet || !this.characterId()) return;
    let rawDefense: string | null = this.sheet.defensepoints ?? null;
    try {
      const raw = JSON.parse(value) as { defensepoints?: unknown };
      if (raw.defensepoints) rawDefense = JSON.stringify(raw.defensepoints);
    } catch {
      // A legacy inventory history step can omit the composite PR payload.
    }
    this.inventory = parsed;
    this.defense = parseIrpwDefensePoints(rawDefense, this.vocationContributionFor(this.characterId()), protectionContribution(this.inventory));
    this.sheet.inventory = value;
    this.sheet.defensepoints = JSON.stringify(this.defense);
    this.sheet = this.sheetService.saveSheet(this.characterId(), this.sheet);
    this.lastHistoryState = value;
  }
  private persist(): void {
    if (!this.sheet || !this.characterId()) return;
    this.defense.protectionContribution = this.protection;
    if (this.defense.currentPoints !== null)
      this.defense.currentPoints = Math.min(this.defense.currentPoints, this.defenseMax);
    const before = this.lastHistoryState || this.sheet.inventory || this.historyState();
    const after = this.historyState();
    if (before !== after && !this.history.applying() && this.historyAddress) {
      this.history.activate(this.historyAddress.entity);
      void this.history.capture(this.historyAddress, before, after, 'change');
    }
    this.sheet.inventory = after;
    this.sheet.defensepoints = JSON.stringify(this.defense);
    this.sheet = this.sheetService.saveSheet(this.characterId(), this.sheet);
    this.lastHistoryState = after;
  }
}