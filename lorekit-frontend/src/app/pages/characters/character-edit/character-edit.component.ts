import { EntityHistoryContextDirective } from '../../../directives/entity-history-context.directive';
import { HistoryFieldDirective } from '../../../directives/history-field.directive';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { DestroyRef, Component, computed, inject, input, OnInit } from '@angular/core';
import { FlushableDebounce } from '../../../utils/flushable-debounce';
import { ActivatedRoute, Router } from '@angular/router';
import { WorldService } from '../../../services/world.service';
import { SpecieService } from '../../../services/specie.service';
import { getPersonalizationValue } from '../../../models/personalization.model';
import { getImageByUsageKey } from '../../../models/image.model';
import { CharacterService } from '../../../services/character.service';
import { Character } from '../../../models/character.model';
import { FormField } from '../../../components/form-overlay/form-overlay.component';
import { World } from '../../../models/world.model';
import { Specie } from '../../../models/specie.model';
import { FormsModule } from '@angular/forms';
import { EditorComponent } from '../../../components/editor/editor.component';
import { EntityLateralMenuButtonComponent } from '../../../components/entity-lateral-menu-button/entity-lateral-menu-button.component';
import { IconButtonComponent } from '../../../components/icon-button/icon-button.component';
import { PersonalizationButtonComponent } from '../../../components/personalization-button/personalization-button.component';
import { SafeDeleteButtonComponent } from '../../../components/safe-delete-button/safe-delete-button.component';
import { LocationListComponent } from '../../locations/location-list/location-list.component';
import { SpecieListComponent } from '../../species/specie-list/specie-list.component';
import { NavButtonComponent } from "../../../components/nav-button/nav-button.component";
import { UiFieldConfigButtonComponent } from '../../../components/ui-field-config-button/ui-field-config-button.component';
import { EntityConfiguredFieldsComponent } from '../../../components/entity-configured-fields/entity-configured-fields.component';
import { UiConfigPayload } from '../../../models/ui-field-config.model';
import { getSystemDefaultConfig, UiFieldConfigService } from '../../../services/ui-field-config.service';
import { EntityChangeService } from '../../../services/entity-change.service';
import { activeLayoutTabId, CurrentEntityPageStateService, layoutTabStateId, resolveEntityTab } from '../../../services/current-entity-page-state.service';
import { AssetUrlPipe } from '../../../pipes/asset-url.pipe';
import { TabManagerService } from '../../../services/tab-manager.service';

@Component({
  selector: 'app-character-edit',
  imports: [EntityHistoryContextDirective, HistoryFieldDirective, IconButtonComponent, PersonalizationButtonComponent, FormsModule, EditorComponent, EntityLateralMenuButtonComponent, SafeDeleteButtonComponent, NavButtonComponent, UiFieldConfigButtonComponent, EntityConfiguredFieldsComponent, AssetUrlPipe],
  templateUrl: './character-edit.component.html',
  styleUrl: './character-edit.component.css',
})
export class CharacterEditComponent implements OnInit {
  dialogref = inject<DialogRef<any>>(DialogRef<any>, { optional: true });
  data = inject<any>(DIALOG_DATA, { optional: true });

  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private worldService = inject(WorldService);
  private specieService = inject(SpecieService);
  private characterService = inject(CharacterService);
  private entityChangeService = inject(EntityChangeService);
  private currentEntityPageStateService = inject(CurrentEntityPageStateService);
  private uiFieldConfigService = inject(UiFieldConfigService);
  private tabManager = inject(TabManagerService);
  public getPersonalizationValue = getPersonalizationValue;
  public getImageByUsageKey = getImageByUsageKey;

  currentTab = layoutTabStateId('tab:properties');
  fieldLayout: UiConfigPayload = getSystemDefaultConfig('Character');
  readonly layoutTabStateId = layoutTabStateId;
  activeLayoutTabId(): string { return activeLayoutTabId(this.currentTab, this.fieldLayout); }

  isInDialog = computed(() => !!this.dialogref);

  protected readonly isRouteComponent = computed(() => {
    return this.router.routerState.root.firstChild?.component === CharacterEditComponent ||
      this.activatedRoute.component === CharacterEditComponent;
  });

  characterIdInput = input<string | null>(null);

  readonly characterId = computed(() => {
    const inputId = this.characterIdInput();
    if (inputId) {
      return inputId;
    }

    if (this.data?.id) {
      return this.data.id as string;
    }

    return this.activatedRoute.snapshot.paramMap.get('characterId') ?? '';
  });

  character : Character = {} as Character;

  selectedWorldId: string | null = null;
  selectedSpecieId: string | null = null;

  isLoading = true;

  private readonly saveTask = new FlushableDebounce(inject(DestroyRef), 500);

  availableWorlds : World[] = [];
  availableSpecies : Specie[] = [];

  openIronpawSheet(): void {
    const characterId = this.character.id || this.characterId();
    if (!characterId) return;

    const icon = getPersonalizationValue(this.character, 'icon') || 'fa-solid fa-scroll';
    this.tabManager.openTab('CharacterSheet', characterId, `Ficha: ${this.character.name || 'Personagem'}`, icon);
  }

  selectTab(tab: string): void {
    this.currentTab = tab;
    this.currentEntityPageStateService.setCurrentTab('Character', this.characterId(), tab);
  }

  private restoreCurrentTab(): void {
    this.currentTab = this.currentEntityPageStateService.getCurrentTab('Character', this.characterId(), 'properties');
  }

  ngOnInit(): void {
    this.restoreCurrentTab();
    this.getCharacter();
    this.getWorldsAndSpecies();
    this.isLoading = false;
  }

  getCharacter(){
    this.character = this.characterService.getCharacter(this.characterId());
    this.fieldLayout = this.uiFieldConfigService.getResolvedConfig('Character', this.character.id);
    this.currentTab = resolveEntityTab(this.currentTab, this.fieldLayout, ['backstory']);

    this.selectedSpecieId = this.character.ParentSpecies ? this.character.ParentSpecies.id : null;
    this.selectedWorldId = this.character.ParentWorld ? this.character.ParentWorld.id : null;
  }

  getWorldsAndSpecies(){
    this.availableWorlds = this.worldService.getWorlds();
    this.availableSpecies = this.specieService.getSpecies(null, this.character.ParentWorld ? this.character.ParentWorld.id : null);
  }

  getFormFields(): FormField[] {
    return [
      // { key: 'concept', label: 'Conceito', value: this.character.concept || '', type: 'text-area' },
      { key: 'world', label: 'Mundo', value: this.character.ParentWorld ? this.character.ParentWorld.id : '', options: this.availableWorlds, optionCompareProp: 'id', optionDisplayProp: 'name' },
      { key: 'specie', label: 'Espécie', value: this.character.ParentSpecies ? this.character.ParentSpecies.id : '', options: this.availableSpecies, optionCompareProp: 'id', optionDisplayProp: 'name' },

    ];
  }

  getColor(specie: Specie): string {
    const color = this.getPersonalizationValue(specie, 'color');
    return color ? `bg-${color}-500 text-zinc-900` : 'bg-zinc-900 border-zinc-700';
  }

  saveCharacter() {
    this.saveTask.schedule(() => {
      this.characterService.saveCharacter(this.character, this.selectedWorldId, this.selectedSpecieId);
      this.entityChangeService.notifySave('Character', this.character.id);
    });
  }

  onEditorSave($event: any, field: keyof Character) {
    (this.character[field] as any) = JSON.stringify($event);

    this.saveCharacter();
  }

  onFieldsSave(formData: Record<string, string>) {
    this.character.concept = formData['concept'];
    this.selectedWorldId = formData['world'];
    this.selectedSpecieId = formData['specie'];

    console.log("Fields Saved: ", formData);


    this.saveCharacter();
  }
}
