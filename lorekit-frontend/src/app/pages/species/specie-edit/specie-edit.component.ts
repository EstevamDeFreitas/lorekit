import { EntityHistoryContextDirective } from '../../../directives/entity-history-context.directive';
import { HistoryFieldDirective } from '../../../directives/history-field.directive';
import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { DestroyRef, Component, computed, inject, input, OnInit } from '@angular/core';
import { FlushableDebounce } from '../../../utils/flushable-debounce';
import { ActivatedRoute, Router } from '@angular/router';
import { WorldService } from '../../../services/world.service';
import { SpecieService } from '../../../services/specie.service';
import { LocationService } from '../../../services/location.service';
import { Specie } from '../../../models/specie.model';
import { FormField } from '../../../components/form-overlay/form-overlay.component';
import { getPersonalizationValue } from '../../../models/personalization.model';
import { IconButtonComponent } from '../../../components/icon-button/icon-button.component';
import { PersonalizationButtonComponent } from '../../../components/personalization-button/personalization-button.component';
import { FormsModule } from '@angular/forms';
import { EditorComponent } from '../../../components/editor/editor.component';
import { EntityLateralMenuButtonComponent } from '../../../components/entity-lateral-menu-button/entity-lateral-menu-button.component';
import { SafeDeleteButtonComponent } from '../../../components/safe-delete-button/safe-delete-button.component';
import { LocationListComponent } from '../../locations/location-list/location-list.component';
import { SpecieListComponent } from "../specie-list/specie-list.component";
import { buildImageUrl, getImageByUsageKey } from '../../../models/image.model';
import { NavButtonComponent } from "../../../components/nav-button/nav-button.component";
import { UiFieldConfigButtonComponent } from '../../../components/ui-field-config-button/ui-field-config-button.component';
import { EntityConfiguredFieldsComponent } from '../../../components/entity-configured-fields/entity-configured-fields.component';
import { UiConfigPayload } from '../../../models/ui-field-config.model';
import { getSystemDefaultConfig, UiFieldConfigService } from '../../../services/ui-field-config.service';
import { EntityChangeService } from '../../../services/entity-change.service';
import { activeLayoutTabId, CurrentEntityPageStateService, layoutTabStateId, resolveEntityTab } from '../../../services/current-entity-page-state.service';
import { AssetUrlPipe } from '../../../pipes/asset-url.pipe';

@Component({
  selector: 'app-specie-edit',
  imports: [EntityHistoryContextDirective, HistoryFieldDirective, IconButtonComponent, PersonalizationButtonComponent, FormsModule, EditorComponent, EntityLateralMenuButtonComponent, SafeDeleteButtonComponent, SpecieListComponent, NavButtonComponent, UiFieldConfigButtonComponent, EntityConfiguredFieldsComponent, AssetUrlPipe],
  templateUrl: './specie-edit.component.html',
  styleUrl: './specie-edit.component.css',
})
export class SpecieEditComponent implements OnInit {
  dialogref = inject<DialogRef<any>>(DialogRef<any>, { optional: true });
  data = inject<any>(DIALOG_DATA, { optional: true });

  private dialog = inject(Dialog);
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private worldService = inject(WorldService);
  private specieService = inject(SpecieService);
  private entityChangeService = inject(EntityChangeService);
  private currentEntityPageStateService = inject(CurrentEntityPageStateService);
  private uiFieldConfigService = inject(UiFieldConfigService);
  private locationService = inject(LocationService);
  public getPersonalizationValue = getPersonalizationValue;
  public getImageByUsageKey = getImageByUsageKey;

  currentTab = layoutTabStateId('tab:properties');
  fieldLayout: UiConfigPayload = getSystemDefaultConfig('Species');
  readonly layoutTabStateId = layoutTabStateId;
  activeLayoutTabId(): string { return activeLayoutTabId(this.currentTab, this.fieldLayout); }

  isInDialog = computed(() => !!this.dialogref);

  protected readonly isRouteComponent = computed(() => {
    return this.router.routerState.root.firstChild?.component === SpecieEditComponent ||
      this.activatedRoute.component === SpecieEditComponent;
  });

  specieIdInput = input<string | null>(null);

  readonly specieId = computed(() => {
    const inputId = this.specieIdInput();
    if (inputId) {
      return inputId;
    }

    if (this.data?.id) {
      return this.data.id as string;
    }

    return this.activatedRoute.snapshot.paramMap.get('specieId') ?? '';
  });

  specie: Specie = {} as Specie;

  selectedParentLocationId: string | null = null;
  selectedWorldId: string | null = null;
  selectedMainSpecieId: string | null = null;

  fields: FormField[] = [];

  isLoading = true;

  private readonly saveTask = new FlushableDebounce(inject(DestroyRef), 500);

  selectTab(tab: string): void {
    this.currentTab = tab;
    this.currentEntityPageStateService.setCurrentTab('Species', this.specieId(), tab);
  }

  private restoreCurrentTab(): void {
    this.currentTab = this.currentEntityPageStateService.getCurrentTab('Species', this.specieId(), 'properties');
  }

  ngOnInit(): void {
    this.restoreCurrentTab();
    this.getSpecie();
  }

  getSpecie(){
    this.specie = this.specieService.getSpecie(this.specieId());
    this.fieldLayout = this.uiFieldConfigService.getResolvedConfig('Species', this.specie.id);
    this.currentTab = resolveEntityTab(this.currentTab, this.fieldLayout, ['details', 'subspecies']);

    this.selectedParentLocationId = this.specie.ParentLocation ? this.specie.ParentLocation.id : '';
    this.selectedWorldId = this.specie.ParentWorld ? this.specie.ParentWorld.id : '';
    this.selectedMainSpecieId = this.specie.ParentSpecies ? this.specie.ParentSpecies.id : '';

    this.buildFields();
    this.isLoading = false;
  }

  private buildFields() {

    let specieOptions = this.specieService.getSpecies(null, this.specie.ParentWorld ? this.specie.ParentWorld.id : '').filter(s => s.id !== this.specie.id && !s.ParentSpecies);

    this.fields = [
      // { key: 'concept', label: 'Conceito', value: this.specie.concept || '', type: 'text-area' },
      { key: 'parentLocationId', label: 'Local de Origem', value: this.selectedParentLocationId ?? '', options: this.locationService.getLocations(), optionCompareProp: 'id', optionDisplayProp: 'name', clearable: true },
      { key: 'parentWorldId', label: 'Mundo', value: this.selectedWorldId ?? '', options: this.worldService.getWorlds(), optionCompareProp: 'id', optionDisplayProp: 'name', clearable: true },
      { key: 'mainSpecieId', label: 'Espécie Principal', value: this.selectedMainSpecieId ?? '', options: specieOptions, optionCompareProp: 'id', optionDisplayProp: 'name', clearable: true },
    ];
  }

  getColor(specie: Specie): string {
    const color = this.getPersonalizationValue(specie, 'color');
    return color ? `bg-${color}-500 text-zinc-900` : 'bg-zinc-900 border-zinc-700';
  }

  saveSpecie() {
    this.saveTask.schedule(() => {
      this.specieService.saveSpecie(this.specie, this.selectedWorldId, this.selectedParentLocationId, this.selectedMainSpecieId);
      this.entityChangeService.notifySave('Species', this.specie.id);
    });
  }

  onEditorSave($event: any, field: keyof Specie) {
    (this.specie[field] as any) = JSON.stringify($event);

    this.saveSpecie();
  }

  onFieldsSave(formData: Record<string, string>) {
    //ignore save if no changes
    if (formData['concept'] === this.specie.concept &&
        formData['parentLocationId'] === (this.specie.ParentLocation ? this.specie.ParentLocation.id : '') &&
        formData['parentWorldId'] === (this.specie.ParentWorld ? this.specie.ParentWorld.id : '') &&
        formData['mainSpecieId'] === (this.specie.ParentSpecies ? this.specie.ParentSpecies.id : '')
    ) {
      return;
    }

    this.specie.concept = formData['concept'];
    this.selectedParentLocationId = formData['parentLocationId'];
    this.selectedWorldId = formData['parentWorldId'];
    this.selectedMainSpecieId = formData['mainSpecieId'];


    this.saveSpecie();
  }

  async openIrpwSpecieConfig() {
    const { IrpwSpecieConfigComponent } = await import('../../ironpaw/irpw-specie-config/irpw-specie-config.component');
    this.dialog.open(IrpwSpecieConfigComponent, {
      data: { id: this.specie.id },
      panelClass: ['screen-dialog', 'ironpaw-dialog', 'max-w-none', 'max-h-none', 'overflow-hidden'],
      height: '80vh',
      width: '80vw',
      autoFocus: false,
      restoreFocus: false,
    });
  }

}
