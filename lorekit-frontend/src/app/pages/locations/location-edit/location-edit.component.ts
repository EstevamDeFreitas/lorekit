import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IconButtonComponent } from "../../../components/icon-button/icon-button.component";
import { Location, LocationCategory } from '../../../models/location.model';
import { PersonalizationButtonComponent } from "../../../components/personalization-button/personalization-button.component";
import { FormsModule } from '@angular/forms';
import { LocationService } from '../../../services/location.service';
import { EditorComponent } from "../../../components/editor/editor.component";
import { EntityLateralMenuComponent } from "../../../components/entity-lateral-menu/entity-lateral-menu.component";
import { LocationCategoriesService } from '../../../services/location-categories.service';
import { FormField } from '../../../components/form-overlay/form-overlay.component';

@Component({
  selector: 'app-location-edit',
  imports: [IconButtonComponent, PersonalizationButtonComponent, NgClass, FormsModule, EditorComponent, EntityLateralMenuComponent],
  template: `
    <div class="flex flex-col h-screen" [ngClass]="{'h-screen': !isInDialog(), 'h-[80vh]': isInDialog()}">
      <div class="flex flex-row items-center">
        @if (isRouteComponent()){
          <app-icon-button class="me-5" buttonType="whiteActive" icon="fa-solid fa-angle-left" size="2xl" title="Voltar" route="/app/location"></app-icon-button>
        }
        <input type="text" (blur)="saveLocation()" class="flex-5 text-2xl font-bold bg-transparent border-0 focus:ring-0 focus:outline-0" [(ngModel)]="location.name" />
        <app-personalization-button [entityId]="location.id" [entityTable]="'location'" [size]="'xl'"></app-personalization-button>
        <div class="flex-2"></div>
      </div>
      <div class="flex flex-row gap-4 mt-10 h-full">
        <div class="flex-4 flex flex-col h-[calc(100%-8rem)] overflow-y-auto scrollbar-dark">
          <div class="p-4 rounded-lg mt-2 flex flex-col">
            @if (!isLoading) {
              <app-editor [document]="location.description || ''" (saveDocument)="onDocumentSave($event)" class="w-full"></app-editor>
            }
          </div>
        </div>
        <div class="w-70">
          @if (!isLoading){
            <div class="p-4 rounded-lg bg-zinc-900">
              <app-entity-lateral-menu [fields]="getFields()" (onSave)="onDocumentFieldsSave($event)" entityTable="world" [entityId]="location.id"></app-entity-lateral-menu>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styleUrl: './location-edit.component.css',
  changeDetection: ChangeDetectionStrategy.Default
})
export class LocationEditComponent implements OnInit {

  dialogref = inject<DialogRef<any>>(DialogRef<any>, { optional: true });
  data = inject<any>(DIALOG_DATA, { optional: true });

  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private locationService = inject(LocationService);
  private cdr = inject(ChangeDetectorRef);
  private locationCategoryService = inject(LocationCategoriesService);

  isInDialog = computed(() => !!this.dialogref);

  protected readonly isRouteComponent = computed(() => {
    return this.router.routerState.root.firstChild?.component === LocationEditComponent ||
      this.activatedRoute.component === LocationEditComponent;
  });

  readonly locationId = computed(() => {
    if (this.data?.id) {
      return this.data.id as string;
    }

    return this.activatedRoute.snapshot.paramMap.get('locationId') ?? '';
  });

  location : Location = {} as Location;
  isLoading = true;

  locationCategories: LocationCategory[] = [];

  ngOnInit(): void {
    this.getLocation();
    this.getCategories();
  }

  getCategories() {
    this.locationCategoryService.getLocationCategories().subscribe({
      next: (categories) => {
        this.locationCategories = categories;
      },
      error: (error) => {
        console.error('Erro ao buscar categorias de localidade:', error);
      }
    });
  }

  getLocation(){
    this.locationService.getLocationById(this.locationId()).subscribe({
      next: (location) => {
        this.location = location;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading location:', err);
      }
    });
  }

  saveLocation() {
    this.locationService.saveLocation(this.location).subscribe({
      next: (location) => {
      },
      error: (err) => {
        console.error('Error saving location name:', err);
      }
    });
  }

  onDocumentSave($event: any) {
    this.location.description = JSON.stringify($event);
    this.saveLocation();
  }

  onDocumentFieldsSave(formData: Record<string, string>) {
    this.location.concept = formData['concept'];
    this.location.categoryId = formData['categoryId'];
    this.saveLocation();
  }

  getFields() : FormField[] {
    return [
      { key: 'concept', label: 'Conceito', value: this.location.concept || '', type: 'text-area' },
      { key: 'categoryId', label: 'Categoria', value: this.location.categoryId || '', options: this.locationCategories, optionCompareProp: 'id', optionDisplayProp: 'name' }
    ];
  }


}
