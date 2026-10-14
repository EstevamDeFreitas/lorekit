import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { TemplateRef, viewChild } from '@angular/core';
import { NavButtonComponent } from '../../../components/nav-button/nav-button.component';
import { ComboBoxComponent } from '../../../components/combo-box/combo-box.component';
import { IrpwWalletComponent } from '../irpw-wallet/irpw-wallet.component';
import { CdkConnectedOverlay, CdkOverlayOrigin } from '@angular/cdk/overlay';
import { ButtonComponent } from '../../../components/button/button.component';
import { InputComponent } from '../../../components/input/input.component';
import { TextAreaComponent } from '../../../components/text-area/text-area.component';
import { AssetUrlPipe } from '../../../pipes/asset-url.pipe';
import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup, moveItemInArray } from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IrpwCharacterSheet } from '../../../models/irpw-character-sheet.model';
import {
  IRPW_ITEM_CATEGORIES,
  IRPW_ITEM_CATEGORY_LABEL,
  IrpwItemCategory,
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

@Component({
  selector: 'irpw-inventory',
  imports: [NavButtonComponent, ComboBoxComponent, IrpwWalletComponent, CdkConnectedOverlay, CdkOverlayOrigin, FormsModule, ButtonComponent, InputComponent, TextAreaComponent, AssetUrlPipe, CdkDrag, CdkDropList, CdkDropListGroup],
  templateUrl: './irpw-inventory.component.html',
  styleUrl: './irpw-inventory.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IrpwInventoryComponent {
  readonly characterId = input<string>('');
  readonly accentColor = input<string>('#eab308');
  private readonly dialog = inject(Dialog);
  readonly addModal = viewChild.required<TemplateRef<unknown>>('addModal');
  private addDialog: DialogRef<unknown> | undefined;
  readonly categoryOptions = IRPW_ITEM_CATEGORIES.map(value => ({ value, label: IRPW_ITEM_CATEGORY_LABEL[value] }));
  readonly protectionOptions = [{value: 'light', label: 'Leve (+1 PR)'}, {value: 'medium', label: 'Média (+2 PR)'}, {value: 'heavy', label: 'Pesada (+3 PR)'}];
  readonly handOptions = [{value: 1, label: 'Uma mão'}, {value: 2, label: 'Duas mãos'}];
  openAdd(): void {
    if (this.invalidInventory || this.addDialog) return;
    this.showAdd = true;
    this.addDialog = this.dialog.open(this.addModal(), { ariaLabel: 'Adicionar item à ficha', autoFocus: 'first-tabbable', maxWidth: 'calc(100vw - 2rem)' });
    this.addDialog.closed.subscribe(() => { this.showAdd = false; this.addDialog = undefined; });
  }
  closeAdd(): void { this.addDialog?.close(); }

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
  addMode: 'catalog' | 'create' = 'catalog';
  quickItem = this.catalog.createDraft();
  quickError = '';
  hoveredEntry: string | null = null;
  readonly categories = IRPW_ITEM_CATEGORIES;
  readonly categoryLabels = IRPW_ITEM_CATEGORY_LABEL;
  catalogSearch = '';
  backpackSearch = '';
  invalidInventory = false;
  private historyAddress: HistoryAddress | null = null;
  private unregisterHistory: (() => void) | undefined;
  private lastHistoryState = '';
  defense = parseIrpwDefensePoints(null);

  constructor() {
    this.destroyRef.onDestroy(() => { this.unregisterHistory?.(); this.closeAdd(); });
    effect(() => {
      this.catalog.changes();
      const selectedId = this.selectedEntry?.instanceId;
      const id = this.characterId();
      if (id) this.load(id);
      if (selectedId) this.selectedEntry = this.inventory.entries.find(entry => entry.instanceId === selectedId) ?? null;
    });
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
      ? IRPW_ITEM_CATEGORY_LABEL[item.snapshot.definition.category]
      : IRPW_ITEM_CATEGORY_LABEL[item.definition.category];
  }
  changeQuickCategory(category: IrpwItemCategory): void {
    const draft = this.catalog.createDraft(category);
    draft.name = this.quickItem.name; draft.description = this.quickItem.description; draft.effects = this.quickItem.effects;
    if (['weapon', 'protection', 'wearable'].includes(category)) { draft.definition.stackable = false; draft.definition.stackLimit = 1; }
    if (category === 'consumable') draft.definition.consumable = { subtype: 'utility', effect: '', actionCost: 1 };
    if (category === 'weapon') draft.definition.equipmentSlots = ['primary', 'secondary', 'reserve'];
    if (category === 'protection') draft.definition.equipmentSlots = ['armor'];
    if (category === 'wearable') draft.definition.equipmentSlots = ['accessory1', 'accessory2', 'accessory3'];
    this.quickItem = draft;
  }
  toggleQuickSlot(slot: IrpwEquipmentSlot, checked: boolean): void {
    this.quickItem.definition.equipmentSlots = this.quickItem.definition.equipmentSlots.filter(value => value !== slot);
    if (checked) this.quickItem.definition.equipmentSlots.push(slot);
  }
  createQuickItem(): void {
    if (this.invalidInventory || !this.sheet) return;
    try {
      const saved = this.catalog.saveItem(this.quickItem);
      this.catalogItems = this.catalog.getItems();
      this.addItem(saved);
      this.quickItem = this.catalog.createDraft(); this.quickError = ''; this.addMode = 'catalog';
    } catch (error) { this.quickError = error instanceof Error ? error.message : 'Não foi possível criar o item.'; }
  }
  itemEffects(entry: IrpwInventoryEntry): string {
    const definition = entry.snapshot.definition;
    return [...new Set([entry.snapshot.effects, definition.consumable?.effect, definition.protection?.effects, definition.weapon?.specialProperty, definition.narrativeEffect, ...definition.uniqueBenefits, ...definition.uniqueCosts.map(cost => 'Custo: ' + cost)].filter(Boolean))].join('\n') || 'Sem efeito adicional descrito.';
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
    if (this.invalidInventory || !this.sheet) return;
    const definition = structuredClone(item.definition);
    const entry: IrpwInventoryEntry = {
      instanceId: crypto.randomUUID(),
      sourceItemId: item.id,
      sourcePortableId: item.portableId,
      sourceRevision: item.revision ?? 1,
      snapshot: {
        name: item.name,
        description: item.description,
        effects: item.effects ?? null,
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
    this.closeAdd();
    this.selectedEntry = compatible || entry;
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
    if (entry.slot) this.inventory.equipment[entry.slot] = null;
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
  equipTo(entry: IrpwInventoryEntry, value: string): void {
    const slot = this.compatibleSlots(entry).find(slot => slot === value);
    if (slot) this.equip(entry, slot);
  }
  ifEmptyClose(popover: HTMLElement): void { if (!this.selectedEntry) popover.hidePopover(); }
  saveEntry(entry: IrpwInventoryEntry): void {
    const source = entry.sourceItemId ? this.catalog.getItem(entry.sourceItemId) : null;
    try {
      if (source) this.catalog.saveItem({ ...source, name: entry.snapshot.name, description: entry.snapshot.description, effects: entry.snapshot.effects });
      else if (!entry.snapshot.name.trim()) throw new Error('Informe um nome para o item.');
      this.quickError = '';
      this.saveQuantity(entry);
    } catch (error) { this.quickError = error instanceof Error ? error.message : 'Não foi possível salvar o item.'; }
  }
  saveQuantity(entry: IrpwInventoryEntry): void {
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
        entry.snapshot.effects,
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
    if (entry.slot && this.inventory.equipment[entry.slot] === entry.instanceId) this.inventory.equipment[entry.slot] = null;
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
    if (this.invalidInventory || !this.sheet || !this.characterId()) return;
    this.sheet = this.sheetService.getSheet(this.characterId()) ?? this.sheet;
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
