import { EntityHistoryContextDirective } from '../../../directives/entity-history-context.directive';
import { HistoryFieldDirective } from '../../../directives/history-field.directive';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { NgComponentOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IconButtonComponent } from "../../../components/icon-button/icon-button.component";
import { Location, LocationCategory } from '../../../models/location.model';
import { PersonalizationButtonComponent } from "../../../components/personalization-button/personalization-button.component";
import { FormsModule } from '@angular/forms';
import { LocationService } from '../../../services/location.service';
import { EditorComponent } from "../../../components/editor/editor.component";
import { EntityLateralMenuButtonComponent } from "../../../components/entity-lateral-menu-button/entity-lateral-menu-button.component";
import { LocationCategoriesService } from '../../../services/location-categories.service';
import { FormField } from '../../../components/form-overlay/form-overlay.component';
import { SafeDeleteButtonComponent } from "../../../components/safe-delete-button/safe-delete-button.component";
import { environment } from '../../../../enviroments/environment';
import { WorldService } from '../../../services/world.service';
import { getPersonalizationValue } from '../../../models/personalization.model';
import { getImageByUsageKey } from '../../../models/image.model';
import { NavButtonComponent } from "../../../components/nav-button/nav-button.component";
import { UiFieldConfigButtonComponent } from '../../../components/ui-field-config-button/ui-field-config-button.component';
import { EntityConfiguredFieldsComponent } from '../../../components/entity-configured-fields/entity-configured-fields.component';
import { EntityChangeService } from '../../../services/entity-change.service';
import { CurrentEntityPageStateService, activeLayoutTabId, layoutTabStateId, resolveEntityTab } from '../../../services/current-entity-page-state.service';
import { AssetUrlPipe } from '../../../pipes/asset-url.pipe';
import { UiConfigPayload } from '../../../models/ui-field-config.model';
import { UiFieldConfigService, getSystemDefaultConfig } from '../../../services/ui-field-config.service';

@Component({
  selector: 'app-location-edit',
  imports: [EntityHistoryContextDirective, HistoryFieldDirective, IconButtonComponent, PersonalizationButtonComponent, FormsModule, EditorComponent, EntityLateralMenuButtonComponent, SafeDeleteButtonComponent, NavButtonComponent, UiFieldConfigButtonComponent, EntityConfiguredFieldsComponent, AssetUrlPipe],
  templateUrl: './location-edit.component.html',
  styleUrl: './location-edit.component.css',
  changeDetection: ChangeDetectionStrategy.Default
})
export class LocationEditComponent implements OnInit {

  dialogref = inject<DialogRef<any>>(DialogRef<any>, { optional: true });
  data = inject<any>(DIALOG_DATA, { optional: true });

  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private locationService = inject(LocationService);
  private entityChangeService = inject(EntityChangeService);
  private currentEntityPageStateService = inject(CurrentEntityPageStateService);
  private uiFieldConfigService = inject(UiFieldConfigService);
  private worldService = inject(WorldService);
  private locationCategoryService = inject(LocationCategoriesService);
  public getPersonalizationValue = getPersonalizationValue;
  public getImageByUsageKey = getImageByUsageKey;

  isInDialog = computed(() => !!this.dialogref);

  currentTab : string = 'details';
  fieldLayout: UiConfigPayload = getSystemDefaultConfig('Location');
  readonly layoutTabStateId = layoutTabStateId;
  activeLayoutTabId = () => activeLayoutTabId(this.currentTab, this.fieldLayout);
  locationListComponent: any = null;

  protected readonly isRouteComponent = computed(() => {
    return this.router.routerState.root.firstChild?.component === LocationEditComponent ||
      this.activatedRoute.component === LocationEditComponent;
  });

  readonly locationId = computed(() => {
    const inputId = this.locationIdInput();
    if (inputId) {
      return inputId;
    }

    if (this.data?.id) {
      return this.data.id as string;
    }

    return this.activatedRoute.snapshot.paramMap.get('locationId') ?? '';
  });

  locationIdInput = input<string | null>(null);
  showLateralMenu = input<boolean>(true);

  location : Location = {} as Location;
  isLoading = true;

  locationCategories: LocationCategory[] = [];

  selectedCategoryId: string = '';
  selectedParentLocationId?: string;
  selectedWorldId?: string;

  fields: FormField[] = [];

  selectTab(tab: string): void {
    this.currentTab = tab;
    this.currentEntityPageStateService.setCurrentTab('Location', this.locationId(), tab);
  }

  private restoreCurrentTab(): void {
    this.currentTab = this.currentEntityPageStateService.getCurrentTab('Location', this.locationId(), 'details');
  }

  ngOnInit(): void {
    this.restoreCurrentTab();
    this.getLocation();
    this.getCategories();
  }

  getCategories() {
    this.locationCategories = this.locationCategoryService.getLocationCategories();
    this.buildFields();
  }

  getLocation(){
    this.location = this.locationService.getLocationById(this.locationId());
    this.fieldLayout = this.uiFieldConfigService.getResolvedConfig('Location', this.locationId());
    this.currentTab = resolveEntityTab(this.currentTab, this.fieldLayout, ['details']);
    this.selectedCategoryId = this.location.LocationCategory ? this.location.LocationCategory.id : '';
    this.selectedParentLocationId = this.location.ParentLocation ? this.location.ParentLocation.id : undefined;
    this.selectedWorldId = this.location.ParentWorld ? this.location.ParentWorld.id : undefined;
    this.isLoading = false;

    this.buildFields();
  }

  saveLocation() {
    this.locationService.saveLocation(this.location, this.selectedCategoryId, this.selectedWorldId || undefined, this.selectedParentLocationId || undefined);
    this.entityChangeService.notifySave('Location', this.location.id);
  }

  onDocumentSave($event: any) {
    this.location.description = JSON.stringify($event);
    this.saveLocation();
  }

  onFieldsSave(formData: Record<string, string>) {
    this.location.concept = formData['concept'];
    this.selectedCategoryId = formData['categoryId'];
    this.selectedParentLocationId = formData['parentLocationId'];
    this.selectedWorldId = formData['parentWorldId'];

    this.saveLocation();
  }

  openLocalitiesTab() {
    this.selectTab('localities');

    if (this.locationListComponent) {
      return;
    }

    import('../location-list/location-list.component').then(({ LocationListComponent }) => {
      this.locationListComponent = LocationListComponent;
    });
  }

  private buildFields() {

    this.fields = [
      // { key: 'concept', label: 'Conceito', value: this.location.concept || '', type: 'text-area' },
      { key: 'categoryId', label: 'Categoria', value: this.selectedCategoryId || '', options: this.locationCategories, optionCompareProp: 'id', optionDisplayProp: 'name' },
      { key: 'parentLocationId', label: 'Localidade Pai', value: this.location.ParentLocation ? this.location.ParentLocation.id : '', options: this.locationService.getLocations(), optionCompareProp: 'id', optionDisplayProp: 'name' },
      { key: 'parentWorldId', label: 'Mundo', value: this.location.ParentWorld ? this.location.ParentWorld.id : '', options: this.worldService.getWorlds(), optionCompareProp: 'id', optionDisplayProp: 'name' },
    ];

  }

  getColor(item: any): string {
    const color = this.getPersonalizationValue(item, 'color');
    return color ? `bg-${color}-500 text-zinc-900` : '';
  }


}
