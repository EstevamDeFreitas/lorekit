import { EntityHistoryContextDirective } from '../../../directives/entity-history-context.directive';
import { HistoryFieldDirective } from '../../../directives/history-field.directive';
import { inject, DestroyRef, ChangeDetectionStrategy, Component, computed, effect, input, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WorldStateService } from '../../../services/world-state.service';
import { World } from '../../../models/world.model';
import { Router, ActivatedRoute } from '@angular/router';
import { NgClass, NgComponentOutlet, NgStyle } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from "../../../components/button/button.component";
import { WorldService } from '../../../services/world.service';
import { IconButtonComponent } from "../../../components/icon-button/icon-button.component";
import { EditorComponent } from "../../../components/editor/editor.component";
import { Dialog } from '@angular/cdk/dialog';
import { PersonalizationComponent } from '../../../components/personalization/personalization.component';
import { PersonalizationButtonComponent } from "../../../components/personalization-button/personalization-button.component";
import { EntityLateralMenuButtonComponent } from "../../../components/entity-lateral-menu-button/entity-lateral-menu-button.component";
import { SafeDeleteButtonComponent } from "../../../components/safe-delete-button/safe-delete-button.component";
import { ImageUploaderComponent } from "../../../components/ImageUploader/image-uploader.component";
import { getImageByUsageKey, Image } from '../../../models/image.model';
import { ImageService } from '../../../services/image.service';
import { FormField } from '../../../components/form-overlay/form-overlay.component';
import { getPersonalizationValue } from '../../../models/personalization.model';
import { DynamicFieldsComponent } from "../../../components/DynamicFields/DynamicFields.component";
import { DynamicFieldService } from '../../../services/dynamic-field.service';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { NavButtonComponent } from "../../../components/nav-button/nav-button.component";
import { UiFieldConfigButtonComponent } from '../../../components/ui-field-config-button/ui-field-config-button.component';
import { EntityConfiguredFieldsComponent } from '../../../components/entity-configured-fields/entity-configured-fields.component';
import { CurrentEntityPageStateService, activeLayoutTabId, layoutTabStateId, resolveEntityTab } from '../../../services/current-entity-page-state.service';
import { AssetUrlPipe } from '../../../pipes/asset-url.pipe';
import { UiConfigPayload } from '../../../models/ui-field-config.model';
import { UiFieldConfigService, getSystemDefaultConfig } from '../../../services/ui-field-config.service';

@Component({
  selector: 'app-world-info',
  imports: [EntityHistoryContextDirective, HistoryFieldDirective, NgClass, NgStyle, NgComponentOutlet, FormsModule, IconButtonComponent, EditorComponent, PersonalizationButtonComponent, EntityLateralMenuButtonComponent, SafeDeleteButtonComponent, NavButtonComponent, UiFieldConfigButtonComponent, EntityConfiguredFieldsComponent, AssetUrlPipe],
  templateUrl: './world-info.component.html',
  styleUrl: './world-info.component.css',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class WorldInfoComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly currentEntityPageStateService = inject(CurrentEntityPageStateService);
  private readonly uiFieldConfigService = inject(UiFieldConfigService);
  dialogref = inject<DialogRef<any>>(DialogRef<any>, { optional: true });
  data = inject<any>(DIALOG_DATA, { optional: true });
  worldIdInput = input<string>('');

  currentWorld: World = new World();
  currentWorldId: string | null = null;
  currentMainWorldId = '';

  public getPersonalizationValue = getPersonalizationValue;
  public getImageByUsageKey = getImageByUsageKey;

  currentTab : string = 'details';
  fieldLayout: UiConfigPayload = getSystemDefaultConfig('World');
  readonly layoutTabStateId = layoutTabStateId;
  activeLayoutTabId = () => activeLayoutTabId(this.currentTab, this.fieldLayout);
  locationListComponent: any = null;

  isLoading: boolean = false;

  fields: FormField[] = [];

  protected readonly isRouteComponent = computed(() => {
    return this.router.routerState.root.firstChild?.component === WorldInfoComponent ||
      this.currentRoute.component === WorldInfoComponent;
  });

  readonly worldId = computed(() => {
    if(this.worldIdInput()) {
      return this.worldIdInput();
    }

    if (this.data?.id) {
      return this.data.id as string;
    }

    return this.currentRoute.snapshot.paramMap.get('worldId') ?? this.currentWorldId ?? '';
  });

  constructor(private router:Router, private currentRoute : ActivatedRoute, private worldService : WorldService, private worldStateService: WorldStateService) {
    this.isLoading = true;

    effect(() => {
      const inputWorldId = this.worldIdInput();

      if (!inputWorldId) {
        return;
      }

      if (this.currentWorld?.id === inputWorldId) {
        return;
      }

      this.currentWorldId = inputWorldId;
      this.getWorld();
    });

    if (this.data?.id) {
      this.currentWorldId = this.data.id;
      this.getWorld();
    }
    else if (this.worldIdInput()) {
      this.currentWorldId = this.worldIdInput();
      this.getWorld();
    }
    else {
      this.currentRoute.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
        this.currentWorldId = params['worldId'];
        this.getWorld();
      });
    }
  }

  ngOnInit() {
    this.worldStateService.currentWorld$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(world => {
      this.currentMainWorldId = world?.id ?? '';
    });

    const restoredTab = this.currentEntityPageStateService.getCurrentTab('World', this.worldId(), 'details');
    if (restoredTab === 'localities') {
      this.openLocalitiesTab();
      return;
    }

    this.currentTab = restoredTab;
  }

  selectTab(tab: string): void {
    this.currentTab = tab;
    this.currentEntityPageStateService.setCurrentTab('World', this.worldId(), tab);
  }

  getWorld() {
    const id = this.worldId();
    if (!id) {
      this.isLoading = false;
      return;
    }

    this.currentWorldId = id;
    this.currentWorld = this.worldService.getWorldById(id);
    this.buildFields();
    this.fieldLayout = this.uiFieldConfigService.getResolvedConfig('World', id);
    this.currentTab = resolveEntityTab(this.currentTab, this.fieldLayout, ['details', 'localities']);

    this.isLoading = false;
  }

  saveWorldName() {
  if (!this.currentWorld.name || !this.currentWorldId) return;
    this.worldService.updateWorld(this.currentWorld.id, this.currentWorld);
  }

  onDocumentSave(document: any) {
    if (!this.currentWorldId) return;

    this.currentWorld.description = JSON.stringify(document);

    this.worldService.updateWorld(this.currentWorldId, this.currentWorld)
  }

  onWorldSave(formData: Record<string, string>) {
    this.currentWorld.concept = formData['concept'];

    this.worldService.updateWorld(this.currentWorld.id, this.currentWorld);
  }

  toggleMainWorld() {
    if (!this.currentWorld.id) return;

    if (this.currentMainWorldId === this.currentWorld.id) {
      this.worldStateService.clearWorld();
      return;
    }

    this.worldStateService.setWorld(this.currentWorld);
  }

  private buildFields() {
    this.fields = [
      // { key: 'concept', label: 'Conceito', value: this.currentWorld.concept || '', type: 'text-area' },
    ];
  }

  openLocalitiesTab() {
    this.selectTab('localities');

    if (this.locationListComponent) {
      return;
    }

    import('../../locations/location-list/location-list.component').then(({ LocationListComponent }) => {
      this.locationListComponent = LocationListComponent;
    });
  }

}
