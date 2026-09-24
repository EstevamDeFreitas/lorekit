import { ComboBoxComponent } from '../../../components/combo-box/combo-box.component';
import { ButtonComponent } from '../../../components/button/button.component';
import { InputComponent } from '../../../components/input/input.component';
import { TextAreaComponent } from '../../../components/text-area/text-area.component';
import { IconSelectorComponent } from '../../../components/icon-selector/icon-selector.component';
import { HexColorPickerComponent } from '../../../components/hex-color-picker/hex-color-picker.component';
import { ImageUploaderComponent } from '../../../components/ImageUploader/image-uploader.component';
import { AssetUrlPipe } from '../../../pipes/asset-url.pipe';
import { Dialog } from '@angular/cdk/dialog';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Injector,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IrpwItemCatalogService,
  IrpwCatalogItem,
} from '../../../services/irpw-item-catalog.service';
import {
  IrpwItemImportPlan,
  IrpwItemPortabilityService,
} from '../../../services/irpw-item-portability.service';
import {
  IRPW_DAMAGE_LABEL,
  IRPW_EQUIPMENT_SLOTS,
  IRPW_EQUIPMENT_SLOT_LABEL,
  IRPW_ITEM_CATEGORIES,
  IRPW_ITEM_CATEGORY_LABEL,
  IRPW_RARITIES,
  IRPW_RARITY_LABEL,
  IRPW_WEAPON_PROPERTY_LABEL,
  IrpwDamageDescriptor,
  IrpwItemCategory,
  IrpwItemRarity,
  IrpwEquipmentSlot,
  IrpwWeaponProperty,
  normalizeIrpwItemDefinition,
} from '../../../models/irpw-item.model';
import { ImageService } from '../../../services/image.service';
@Component({
  selector: 'irpw-content-manager',
  imports: [
    FormsModule,
    ButtonComponent,
    InputComponent,
    TextAreaComponent,
    IconSelectorComponent,
    HexColorPickerComponent,
    ComboBoxComponent,
    AssetUrlPipe,
  ],
  templateUrl: './irpw-content-manager.component.html',
  styleUrl: './irpw-content-manager.component.css',
  host: { '(input)': 'onEditorInput($event)', '(change)': 'onEditorChange($event)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IrpwContentManagerComponent implements OnInit, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);
  editorSection: 'general' | 'rules' = 'general';
  readonly categoryOptions = IRPW_ITEM_CATEGORIES.map((value) => ({
    value,
    label: IRPW_ITEM_CATEGORY_LABEL[value],
  }));
  readonly rarityOptions = IRPW_RARITIES.map((value) => ({
    value,
    label: IRPW_RARITY_LABEL[value],
  }));
  changeCategory(value: IrpwItemCategory | null): void {
    if (!value || !this.selectedItem) return;
    this.selectedItem.definition.category = value;
    this.onCategoryChange();
    this.scheduleAutoSave();
  }
  private readonly catalog = inject(IrpwItemCatalogService);
  private readonly portability = inject(IrpwItemPortabilityService);
  private readonly injector = inject(Injector);
  private readonly dialog = inject(Dialog);
  readonly categories = IRPW_ITEM_CATEGORIES;
  readonly rarities = IRPW_RARITIES;
  readonly categoryLabel = IRPW_ITEM_CATEGORY_LABEL;
  readonly rarityLabel = IRPW_RARITY_LABEL;
  readonly weaponProperties = Object.keys(
    IRPW_WEAPON_PROPERTY_LABEL,
  ) as IrpwWeaponProperty[];
  readonly weaponPropertyLabel = IRPW_WEAPON_PROPERTY_LABEL;
  readonly damageLabel = IRPW_DAMAGE_LABEL;
  readonly equipmentSlots = IRPW_EQUIPMENT_SLOTS;
  readonly equipmentSlotLabel = IRPW_EQUIPMENT_SLOT_LABEL;
  items: IrpwCatalogItem[] = [];
  filteredItems: IrpwCatalogItem[] = [];
  selectedItem: IrpwCatalogItem | null = null;
  searchTerm = '';
  categoryFilter: IrpwItemCategory | 'all' = 'all';
  rarityFilter: IrpwItemRarity | 'all' = 'all';
  includeArchived = false;
  notice = '';
  noticeType: 'info' | 'error' = 'info';
  importPlan: IrpwItemImportPlan | null = null;
  importChoice: 'keep' | 'update' | 'copy' = 'update';
  private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  ngOnDestroy(): void {
    this.clearAutoSave();
  }
  ngOnInit(): void {
    this.reload();
  }
  reload(): void {
    this.items = this.catalog.getItems(this.includeArchived);
    this.applyFilter();
  }
  applyFilter(): void {
    const term = this.searchTerm.trim().toLocaleLowerCase();
    this.filteredItems = this.items.filter(
      (item) =>
        (!term ||
          `${item.name} ${item.description} ${item.definition.tags.join(' ')}`
            .toLocaleLowerCase()
            .includes(term)) &&
        (this.categoryFilter === 'all' ||
          item.definition.category === this.categoryFilter) &&
        (this.rarityFilter === 'all' ||
          item.definition.rarity === this.rarityFilter),
    );
  }
  selectItem(item: IrpwCatalogItem): void {
    this.clearAutoSave();
    this.selectedItem = {
      ...item,
      definition: structuredClone(normalizeIrpwItemDefinition(item.definition)),
    };
    this.notice = '';
  }
  newItem(): void {
    this.clearAutoSave();
    this.editorSection = 'general';
    this.selectedItem = this.catalog.createDraft();
    this.notice = '';
  }
  onCategoryChange(): void {
    if (!this.selectedItem) return;
    this.selectedItem.definition = normalizeIrpwItemDefinition({
      ...this.selectedItem.definition,
      category: this.selectedItem.definition.category,
    });
    const definition = this.selectedItem.definition;
    if (definition.category === 'consumable' && !definition.consumable)
      definition.consumable = { subtype: 'utility', effect: '', actionCost: 1 };
    if (definition.category === 'protection' && !definition.protection)
      definition.protection = { tier: 'light', effects: '' };
  }
  save(showNotice = true): void {
    this.clearAutoSave();
    if (!this.selectedItem) return;
    try {
      const saved = this.catalog.saveItem(this.selectedItem);
      this.selectedItem = saved;
      this.noticeType = 'info';
      if (showNotice) this.notice = 'Item salvo.';
      this.reload();
      this.cdr.markForCheck();
    } catch (error) {
      this.noticeType = 'error';
      this.notice =
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar o item.';
    }
  }
  duplicate(): void {
    if (!this.selectedItem?.id) return;
    try {
      this.selectedItem = this.catalog.duplicateItem(this.selectedItem);
      this.reload();
      this.notice = 'Cópia criada.';
    } catch (error) {
      this.noticeType = 'error';
      this.notice =
        error instanceof Error
          ? error.message
          : 'Não foi possível duplicar o item.';
    }
  }
  archive(): void {
    if (!this.selectedItem?.id) return;
    this.catalog.archiveItem(this.selectedItem.id);
    this.selectedItem = { ...this.selectedItem, archived: 1 };
    this.reload();
    this.notice = 'Item arquivado; posses existentes permanecem intactas.';
  }
  toggleSlot(slot: IrpwEquipmentSlot, checked: boolean): void {
    if (!this.selectedItem) return;
    const slots = this.selectedItem.definition.equipmentSlots.filter(
      (item) => item !== slot,
    );
    if (checked) slots.push(slot);
    this.selectedItem.definition.equipmentSlots = slots;
    this.scheduleAutoSave();
  }
  toggleWeaponProperty(property: IrpwWeaponProperty, checked: boolean): void {
    if (!this.selectedItem?.definition.weapon) return;
    const properties = this.selectedItem.definition.weapon.properties.filter(
      (item) => item !== property,
    );
    if (checked) properties.push(property);
    this.selectedItem.definition.weapon.properties = properties;
    this.scheduleAutoSave();
  }
  damageTypes(item: IrpwCatalogItem): string[] {
    return (
      item.definition.weapon?.damageTypes.map(
        (type) => this.damageLabel[type],
      ) ?? []
    );
  }
  setDamageTypes(item: IrpwCatalogItem, value: string): void {
    if (!item.definition.weapon) return;
    const map: Record<string, IrpwDamageDescriptor> = {
      cortante: 'cutting',
      perfurante: 'piercing',
      concussivo: 'blunt',
    };
    item.definition.weapon.damageTypes = value
      .split(',')
      .map((part) => map[part.trim().toLocaleLowerCase()])
      .filter((type): type is IrpwDamageDescriptor => !!type);
    this.scheduleAutoSave();
  }
  setRarity(value: IrpwItemRarity | null): void {
    if (!this.selectedItem) return;
    this.selectedItem.definition.rarity = value;
    this.scheduleAutoSave();
  }
  setIcon(icon: { iconCode: string }): void {
    if (!this.selectedItem) return;
    this.selectedItem.definition.icon = 'fa-solid ' + icon.iconCode;
    this.scheduleAutoSave();
  }
  setItemColor(color: string | undefined): void {
    if (!this.selectedItem) return;
    this.selectedItem.definition.color = color ?? null;
    this.scheduleAutoSave();
  }
  setBackgroundColor(color: string | undefined): void {
    if (!this.selectedItem) return;
    this.selectedItem.definition.backgroundColor = color ?? null;
    this.scheduleAutoSave();
  }
  openItemImageUploader(): void {
    if (!this.selectedItem) return;

    const dialogRef = this.dialog.open<string>(ImageUploaderComponent, {
      data: {
        usageKey: 'default',
        aspectRatio: 1,
        standalone: true,
        directory: 'ironpaw-items',
      },
      panelClass: 'screen-dialog',
      width: '30rem',
      maxWidth: '95vw',
    });

    dialogRef.closed.subscribe(reference => {
      if (reference) {
        void this.persistItemImage(reference);
      }
    });
  }

  private async persistItemImage(reference: string): Promise<void> {
    if (!this.selectedItem) {
      await this.deleteItemAsset(reference);
      return;
    }

    const previousReference = this.selectedItem.definition.imageReference;
    const previousHash = this.selectedItem.definition.imageAssetSha256;
    let persisted = false;
    this.clearAutoSave();
    try {
      this.selectedItem.definition.imageReference = reference;
      this.selectedItem.definition.imageAssetSha256 = null;
      const saved = this.catalog.saveItem(this.selectedItem);
      persisted = true;
      this.selectedItem = saved;
      this.reload();
      if (previousReference && previousReference !== reference) {
        await this.deleteItemAsset(previousReference);
      }
      this.noticeType = 'info';
      this.notice = 'Imagem do item salva.';
    } catch (error) {
      await this.deleteItemAsset(reference);
      if (!persisted && this.selectedItem) {
        this.selectedItem.definition.imageReference = previousReference;
        this.selectedItem.definition.imageAssetSha256 = previousHash;
      }
      this.noticeType = 'error';
      this.notice = error instanceof Error ? error.message : 'Não foi possível salvar a imagem.';
    } finally {
      this.cdr.markForCheck();
    }
  }
  async removeItemImage(): Promise<void> {
    if (!this.selectedItem?.definition.imageReference) return;
    const previousReference = this.selectedItem.definition.imageReference;
    const previousHash = this.selectedItem.definition.imageAssetSha256;
    let persisted = false;
    this.clearAutoSave();
    try {
      this.selectedItem.definition.imageReference = null;
      this.selectedItem.definition.imageAssetSha256 = null;
      const saved = this.catalog.saveItem(this.selectedItem);
      persisted = true;
      this.selectedItem = saved;
      this.reload();
      await this.deleteItemAsset(previousReference);
      this.noticeType = 'info';
      this.notice = 'Imagem removida.';
    } catch (error) {
      if (!persisted && this.selectedItem) {
        this.selectedItem.definition.imageReference = previousReference;
        this.selectedItem.definition.imageAssetSha256 = previousHash;
      }
      this.noticeType = 'error';
      this.notice = error instanceof Error ? error.message : 'Não foi possível remover a imagem.';
    } finally {
      this.cdr.markForCheck();
    }
  }
  private async deleteItemAsset(reference: string): Promise<void> {
    try {
      await this.injector.get(ImageService).deleteAssetReference(reference).catch(() => undefined);
    } catch {
      // Test doubles and lightweight embedded contexts may not register asset storage.
    }
  }
  onEditorInput(event: Event): void {
    this.scheduleFromEditorEvent(event);
  }
  onEditorChange(event: Event): void {
    this.scheduleFromEditorEvent(event);
  }
  private scheduleFromEditorEvent(event: Event): void {
    const target = event.target;
    if (!(target instanceof Element) || !target.closest('.editor-fields')) return;
    if (target instanceof HTMLInputElement && target.type === 'file') return;
    if (target.closest('app-combo-box, app-hex-color-picker')) return;
    this.scheduleAutoSave();
  }
  private scheduleAutoSave(): void {
    if (!this.selectedItem || typeof this.catalog.saveItem !== 'function') return;
    if (!this.selectedItem.name.trim() && !this.selectedItem.id) return;
    this.clearAutoSave();
    this.autoSaveTimer = setTimeout(() => {
      this.autoSaveTimer = null;
      this.save(false);
    }, 300);
  }
  private clearAutoSave(): void {
    if (this.autoSaveTimer !== null) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }
  exportCatalog(): void {
    void this.exportCatalogAsync(true);
  }
  exportCatalogWithoutImages(): void {
    void this.exportCatalogAsync(false);
  }
  private async exportCatalogAsync(includeImages: boolean): Promise<void> {
    try {
      const payload = await this.portability.exportItems(this.items, 'Itens Ironpaw', { includeImages });
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = 'ironpaw-items.json';
      link.click();
      URL.revokeObjectURL(url);
      this.noticeType = 'info';
      this.notice = 'Catálogo exportado.';
    } catch (error) {
      this.noticeType = 'error';
      this.notice =
        error instanceof Error
          ? error.message
          : 'Não foi possível exportar o catálogo.';
    }
  }
  onImportFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        this.importPlan = this.portability.prepareImport(
          String(reader.result ?? ''),
        );
        this.noticeType = 'info';
        this.notice = 'Pacote validado. Revise a prévia antes de aplicar.';
      } catch (error) {
        this.importPlan = null;
        this.noticeType = 'error';
        this.notice =
          error instanceof Error
            ? error.message
            : 'Não foi possível validar o pacote.';
      }
      input.value = '';
      this.cdr.markForCheck();
    };
    reader.readAsText(file);
  }
  applyImport(plan: IrpwItemImportPlan): void {
    void this.portability
      .applyImport(plan, this.importChoice)
      .then(() => {
        this.importPlan = null;
        this.reload();
        this.noticeType = 'info';
        this.notice = 'Importação aplicada.';
        this.cdr.markForCheck();
      })
      .catch((error) => {
        this.noticeType = 'error';
        this.notice =
          error instanceof Error
            ? error.message
            : 'A importação falhou e nenhuma alteração foi aplicada.';
        this.cdr.markForCheck();
      });
  }
  splitTags(value: string): string[] {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  splitLines(value: string): string[] {
    return value
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
  }
}
