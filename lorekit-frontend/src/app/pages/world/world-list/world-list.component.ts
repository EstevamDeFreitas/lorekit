import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { WorldService } from '../../../services/world.service';
import { World } from '../../../models/world.model';
import { CommonModule, NgClass } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { WorldStateService } from '../../../services/world-state.service';
import { ButtonComponent } from "../../../components/button/button.component";
import {OverlayModule} from '@angular/cdk/overlay';
import { InputComponent } from "../../../components/input/input.component";
import { ImageService } from '../../../services/image.service';
import { environment } from '../../../../enviroments/environment';
import { buildImageUrl, getImageByUsageKey } from '../../../models/image.model';
import { getPersonalizationValue, getTextClass } from '../../../models/personalization.model';
import { FormField, FormOverlayDirective } from '../../../components/form-overlay/form-overlay.component';
import { IconButtonComponent } from '../../../components/icon-button/icon-button.component';

@Component({
  selector: 'app-world-list',
  imports: [CommonModule, RouterLink, ButtonComponent, IconButtonComponent, NgClass, OverlayModule, InputComponent, FormOverlayDirective],
  template: `
  <div class="flex flex-col relative" >
    <div class="flex flex-row gap-4">
      <div class="transition-all duration-300 overflow-clip shrink-0" [ngClass]="showsidebar ? 'w-80' : 'w-0'">
        <div class="w-80 bg-zinc-925 p-3 sticky top-0 h-[calc(100vh-2.5rem)] overflow-y-auto scrollbar-dark border-r border-zinc-800">
          <div class="flex flex-row justify-between mb-6">
            <h2 class="text-base mb-4">Mundos</h2>
            <app-icon-button
              size="sm"
              buttonType="secondary"
              icon="fa-solid fa-plus"
              appFormOverlay
              [title]="'Criar Mundo'"
              [fields]="getFormFields()"
              (onSave)="createWorld($event)"
              ></app-icon-button>
          </div>
          <div class="flex flex-row items-center gap-1 mb-4 w-full">
            <div class="flex flex-col gap-3 w-full">
              @for (world of worlds; track world.id) {
                <div class="grid w-full" style="grid-template-columns: 1fr 1.5rem;" (click)="selectEntity(world.id)">
                  <button  class="cursor-pointer whitespace-nowrap overflow-hidden overflow-ellipsis flex flex-row hover:font-bold items-center gap-2" [ngClass]="[getTextClass(getPersonalizationValue(world, 'color')), currentWorldId === world.id ? 'text-yellow-300' : 'text-zinc-400']" >
                    <div class="flex flex-row items-center">
                      <i class="fa-solid " [ngClass]="getPersonalizationValue(world, 'icon') || 'fa-earth'"></i>
                    </div>
                    <h2 [title]="world.name" class=" text-xs">{{ world.name }}</h2>
                  </button>
                  <app-icon-button [title]="currentWorldId === world.id ? 'Mundo Padrão' : 'Definir como Mundo Padrão'" size="xs" [buttonType]="currentWorldId === world.id ? 'primary' : 'secondary'" icon="fa-solid fa-star" (click)="setWorldAsDefault(world)"></app-icon-button>
                </div>
              }
            </div>

          </div>
        </div>
      </div>
        <small class="border fixed z-10 rounded-2xl transition-all duration-300 border-zinc-700 bg-zinc-900 px-1 py-0.25 top-12 hover:bg-zinc-800 hover:cursor-pointer" [ngClass]="[showsidebar ? 'start-92' : 'start-12']" (click)="showsidebar = !showsidebar">
          <i class="fa-solid text-zinc-400" [ngClass]="[showsidebar ? 'fa-angles-left' : 'fa-angles-right']"></i>
        </small>

      <div class="flex-1 min-h-[60vh]">
          @if (selectedEntityId && showEntityEditor) {
            <div class="rounded-md px-2">
              @if (showEntityEditor && worldInfoComponent) {
                <ng-container *ngComponentOutlet="worldInfoComponent; inputs: { worldIdInput: selectedEntityId }"></ng-container>
              }
              @else {
                <div class="h-full rounded-md  flex items-center justify-center text-zinc-500">
                  Carregando mundo...
                </div>
              }
            </div>
          }
          @else {
            <div class="h-full rounded-md  flex items-center justify-center text-zinc-500">
              Selecione uma localidade na árvore para editar
            </div>
          }
        </div>
    </div>
    <!-- <div class="flex flex-row justify-between items-center mb-4 sticky top-0 z-50 bg-zinc-950 py-2">
      <h3 class="text-xl font-bold">Mundos</h3>
      <app-button buttonType="white" label="Novo"
          appFormOverlay
          size="sm"
          [title]="'Criar Mundo'"
          [fields]="getFormFields()"
          (onSave)="createWorld($event)"
        ></app-button>
    </div>

    <div class="">
      <br>
      @if (worlds.length === 0){
        <div class="text-center">
          <p>Nenhum mundo disponível.</p>
        </div>
      } @else{
        <div class=" grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          @for (world of worlds; track world.id) {
            @let img = getImageByUsageKey(world.Images, 'default');
              <div (click)="onWorldSelected(world.id)" [ngClass]="[
                  'rounded-md flex flex-col gap-1 cursor-pointer selectable-jump border  p-3 mb-2',
                  currentWorldId === world.id ? 'border-yellow-500' : 'border-zinc-800'
                ]" [ngStyle]="img ? buildCardBgStyle(img?.filePath) : {'background-color': getPersonalizationValue(world, 'color') || 'var(--color-zinc-800)'}">
                <div class="flex h-35 flex-row gap-2 items-top">
                  <div class="flex-1 flex flex-col overflow-hidden justify-between" [ngClass]="getTextClass(getPersonalizationValue(world, 'color'))">
                    <div class="flex flex-row items-center gap-2">
                      <i class="fa" [ngClass]="getPersonalizationValue(world, 'icon') || 'fa-paw'"></i>
                      <div class="text-base font-bold">{{ world.name }}</div>
                    </div>
                    <div class="text-xs font-bold overflow-hidden text-ellipsis text-justify line-clamp-3">{{world.concept}}</div>
                    <div class="flex flex-row gap-1">
                      <app-button [label]="currentWorldId === world.id ?'Desfixar como Mundo Padrão' :'Fixar como Mundo Padrão'" [buttonType]="currentWorldId === world.id ? 'primary' : 'white'" size="xs" (click)="$event.stopPropagation(); setWorldAsDefault(world)"></app-button>
                    </div>
                  </div>
                </div>
              </div>
          }
        </div>
      }
    </div> -->


  </div>

  `,
  styleUrl: './world-list.component.css',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class WorldListComponent {
  worldCreationOpen = false;
  newWorldName = '';

  public buildImageUrl = buildImageUrl;
  public getPersonalizationValue = getPersonalizationValue;
  public getTextClass = getTextClass;
  public getImageByUsageKey = getImageByUsageKey;
  showsidebar = true;

  worlds: World[] = [];

  private imageService = inject(ImageService);
  worldsWithImages: { [key: string]: string | undefined } = {};

  currentWorldId = '';
  selectedEntityId = '';
  showEntityEditor = false;
  worldInfoComponent: any = null;

  constructor(private worldService: WorldService, private worldStateService : WorldStateService, private router:Router) { }

  ngOnInit() {
    this.worldStateService.currentWorld$.subscribe(world => {
      this.currentWorldId = world ? world.id : '';
    })
    this.loadWorlds();
  }

  trackById(index: number, world: World) {
    return world.id;
  }

  loadWorlds() {
    this.worlds = this.worldService.getWorlds();
  }

  onWorldSelected(worldId : string) {
    const world = this.worlds.find(w => w.id === worldId);

    if (!world) {
      return;
    }

    this.router.navigate(['/app/world/info', worldId]);
  }

  getWorldColor(world: World): string {
    const color = this.getPersonalizationValue(world, 'color');
    return color ? `bg-${color}-500 text-zinc-900` : 'bg-zinc-900 border-zinc-700';
  }

  createWorld(formData: Record<string, string>) {
    if (formData['name'].trim() === '') {
      return;
    }

    const newWorld: World = {
      id: '',
      name: formData['name'],
      description: ''
    };

    this.worldService.createWorld(newWorld);
    this.worldCreationOpen = false;
    this.loadWorlds();
  }

  getFormFields(): FormField[] {
    return [
      { key: 'name', label: 'Nome', value: '' },
    ];
  }

  async selectEntity(entityId: string) {
    if (this.selectedEntityId === entityId) {
      return;
    }

    this.showEntityEditor = false;
    this.selectedEntityId = '';

    if (!this.worldInfoComponent) {
      const { WorldInfoComponent } = await import('../world-info/world-info.component');
      this.worldInfoComponent = WorldInfoComponent;
    }

    setTimeout(() => {
      this.selectedEntityId = entityId;
      this.showEntityEditor = true;
    }, 0);
  }

  buildCardBgStyle(filePath?: string | null) {
    const url = this.buildImageUrl(filePath);
    return url
      ? {
          'background-image':
            `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(${url})`,
          'background-size': 'cover',
          'background-position': 'center',
        }
      : null;
  }

  setWorldAsDefault(world: World) {
    if (this.currentWorldId === world.id) {
      this.worldStateService.clearWorld();
      return;
    }
    this.worldStateService.setWorld(world);
  }

}
