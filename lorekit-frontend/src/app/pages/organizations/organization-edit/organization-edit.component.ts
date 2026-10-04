import { EntityHistoryContextDirective } from '../../../directives/entity-history-context.directive';
import { HistoryFieldDirective } from '../../../directives/history-field.directive';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { DestroyRef, Component, computed, inject, input, OnInit } from '@angular/core';
import { FlushableDebounce } from '../../../utils/flushable-debounce';
import { Router, ActivatedRoute } from '@angular/router';
import { getImageByUsageKey } from '../../../models/image.model';
import { getPersonalizationValue } from '../../../models/personalization.model';
import { LocationService } from '../../../services/location.service';
import { OrganizationService } from '../../../services/organization.service';
import { WorldService } from '../../../services/world.service';
import { CultureEditComponent } from '../../cultures/culture-edit/culture-edit.component';
import { Organization, OrganizationType } from '../../../models/organization.model';
import { World } from '../../../models/world.model';
import { Location } from '../../../models/location.model';
import { FormField } from '../../../components/form-overlay/form-overlay.component';
import { Culture } from '../../../models/culture.model';
import { FormsModule } from '@angular/forms';
import { EditorComponent } from '../../../components/editor/editor.component';
import { EntityLateralMenuButtonComponent } from '../../../components/entity-lateral-menu-button/entity-lateral-menu-button.component';
import { IconButtonComponent } from '../../../components/icon-button/icon-button.component';
import { PersonalizationButtonComponent } from '../../../components/personalization-button/personalization-button.component';
import { SafeDeleteButtonComponent } from '../../../components/safe-delete-button/safe-delete-button.component';
import { OrganizationTypeService } from '../../../services/organization-type.service';
import { NavButtonComponent } from "../../../components/nav-button/nav-button.component";
import { UiFieldConfigButtonComponent } from '../../../components/ui-field-config-button/ui-field-config-button.component';
import { EntityConfiguredFieldsComponent } from '../../../components/entity-configured-fields/entity-configured-fields.component';
import { EntityChangeService } from '../../../services/entity-change.service';
import { CurrentEntityPageStateService, activeLayoutTabId, layoutTabStateId, resolveEntityTab } from '../../../services/current-entity-page-state.service';
import { AssetUrlPipe } from '../../../pipes/asset-url.pipe';
import { UiConfigPayload } from '../../../models/ui-field-config.model';
import { UiFieldConfigService, getSystemDefaultConfig } from '../../../services/ui-field-config.service';

@Component({
  selector: 'app-organization-edit',
  imports: [EntityHistoryContextDirective, HistoryFieldDirective, IconButtonComponent, PersonalizationButtonComponent, FormsModule, EditorComponent, EntityLateralMenuButtonComponent, SafeDeleteButtonComponent, NavButtonComponent, UiFieldConfigButtonComponent, EntityConfiguredFieldsComponent, AssetUrlPipe],
  templateUrl: './organization-edit.component.html',
  styleUrl: './organization-edit.component.css',
})
export class OrganizationEditComponent implements OnInit{
  dialogref = inject<DialogRef<any>>(DialogRef<any>, { optional: true });
  data = inject<any>(DIALOG_DATA, { optional: true });

  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private worldService = inject(WorldService);
  private locationService = inject(LocationService);
  private organizationService = inject(OrganizationService);
  private entityChangeService = inject(EntityChangeService);
  private currentEntityPageStateService = inject(CurrentEntityPageStateService);
  private uiFieldConfigService = inject(UiFieldConfigService);
  private organizationTypeService = inject(OrganizationTypeService);
  public getPersonalizationValue = getPersonalizationValue;
  public getImageByUsageKey = getImageByUsageKey;

  currentTab: string = 'description';
  fieldLayout: UiConfigPayload = getSystemDefaultConfig('Organization');
  readonly layoutTabStateId = layoutTabStateId;
  activeLayoutTabId = () => activeLayoutTabId(this.currentTab, this.fieldLayout);

  isInDialog = computed(() => !!this.dialogref);

  protected readonly isRouteComponent = computed(() => {
    return this.router.routerState.root.firstChild?.component === OrganizationEditComponent ||
      this.activatedRoute.component === OrganizationEditComponent;
  });

  organizationIdInput = input<string | null>(null);

  readonly organizationId = computed(() => {
    const inputId = this.organizationIdInput();
    if (inputId) {
      return inputId;
    }

    if (this.data?.id) {
      return this.data.id as string;
    }

    return this.activatedRoute.snapshot.paramMap.get('organizationId') ?? '';
  });

  organization : Organization = {} as Organization;

  selectedWorldId: string | null = null;
  selectedLocationId: string | null = null;
  selectedOrganizationTypeId: string | null = null;
  availableOrganizationTypes : OrganizationType[] = [];

  isLoading = true;

  private readonly saveTask = new FlushableDebounce(inject(DestroyRef), 500);

  availableWorlds : World[] = [];
  availableLocations : Location[] = [];

  selectTab(tab: string): void {
    this.currentTab = tab;
    this.currentEntityPageStateService.setCurrentTab('Organization', this.organizationId(), tab);
  }

  private restoreCurrentTab(): void {
    this.currentTab = this.currentEntityPageStateService.getCurrentTab('Organization', this.organizationId(), 'description');
  }

  ngOnInit(): void {
    this.restoreCurrentTab();
    this.getOrganization();
    this.getWorldsAndLocations();
    this.isLoading = false;
  }

  getOrganization(){
    this.organization = this.organizationService.getOrganization(this.organizationId());
    this.fieldLayout = this.uiFieldConfigService.getResolvedConfig('Organization', this.organizationId());
    this.currentTab = resolveEntityTab(this.currentTab, this.fieldLayout, ['description']);

    this.selectedLocationId = this.organization.ParentLocation ? this.organization.ParentLocation.id : null;
    this.selectedWorldId = this.organization.ParentWorld ? this.organization.ParentWorld.id : null;
    this.selectedOrganizationTypeId = this.organization.OrganizationType ? this.organization.OrganizationType.id : null;
  }

  getWorldsAndLocations(){
    this.availableWorlds = this.worldService.getWorlds();
    this.availableLocations = this.locationService.getLocationByWorldId(this.selectedWorldId || '');
    this.availableOrganizationTypes = this.organizationTypeService.getOrganizationTypes();
  }

  saveOrganization() {
    this.saveTask.schedule(() => {
      this.organizationService.saveOrganization(this.organization, this.selectedWorldId, this.selectedLocationId, this.selectedOrganizationTypeId);
      this.entityChangeService.notifySave('Organization', this.organization.id);
    });
  }

  onEditorSave($event: any, field : any) {
    this.organization[field as keyof Organization] = JSON.stringify($event) as any;

    this.saveOrganization();
  }

  onFieldsSave(formData: Record<string, string>) {
    this.organization.concept = formData['concept'];
    this.selectedWorldId = formData['world'];
    this.selectedLocationId = formData['location'];
    this.selectedOrganizationTypeId = formData['organizationType'];

    this.saveOrganization();
  }

  getFormFields(): FormField[] {
    return [
      // { key: 'concept', label: 'Conceito', value: this.organization.concept || '', type: 'text-area' },
      { key: 'organizationType', label: 'Tipo de Organização', value: this.organization.OrganizationType ? this.organization.OrganizationType.id : '', options: this.availableOrganizationTypes, optionCompareProp: 'id', optionDisplayProp: 'name' },
      { key: 'world', label: 'Mundo', value: this.organization.ParentWorld ? this.organization.ParentWorld.id : '', options: this.availableWorlds, optionCompareProp: 'id', optionDisplayProp: 'name' },
      { key: 'location', label: 'Local de Origem', value: this.organization.ParentLocation ? this.organization.ParentLocation.id : '', options: this.availableLocations, optionCompareProp: 'id', optionDisplayProp: 'name' },

    ];
  }

  getColor(organization: Organization): string {
    const color = this.getPersonalizationValue(organization, 'color');
    return color ? `bg-${color}-500 text-zinc-900` : 'bg-zinc-900 border-zinc-700';
  }

}
