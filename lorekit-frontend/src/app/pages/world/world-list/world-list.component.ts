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

@Component({
  selector: 'app-world-list',
  imports: [CommonModule, RouterLink, ButtonComponent, NgClass, OverlayModule, InputComponent, FormOverlayDirective],
  template: `
  <div class="flex flex-col relative" >
    <div class="flex flex-row justify-between items-center mb-4 sticky top-0 z-50 bg-zinc-950 py-2">
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
          <!-- <button label="Criar Novo Mundo" routerLink="/app/world/edit" class="mt-4"></button> -->
        </div>
      } @else{
        <div class=" grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          @for (world of worlds; track world.id) {
            @let img = getImageByUsageKey(world.Images, 'default');
              <div (click)="onWorldSelected(world.id)" [ngClass]="[
                  'rounded-md flex flex-col gap-1 cursor-pointer selectable-jump border border-zinc-800 p-3 mb-2',

                ]" [ngStyle]="img ? buildCardBgStyle(img?.filePath) : {'background-color': getPersonalizationValue(world, 'color') || 'var(--color-zinc-800)'}">
                <div class="flex h-35 flex-row gap-2 items-top">
                  <div class="flex-1 flex flex-col overflow-hidden justify-between" [ngClass]="getTextClass(getPersonalizationValue(world, 'color'))">
                    <div class="flex flex-row items-center gap-2">
                      <i class="fa" [ngClass]="getPersonalizationValue(world, 'icon') || 'fa-paw'"></i>
                      <div class="text-base font-bold">{{ world.name }}</div>
                    </div>
                    <div class="text-xs font-bold overflow-hidden text-ellipsis text-justify line-clamp-3">{{world.concept}}</div>
                    <div class="flex flex-row gap-1">

                    </div>
                  </div>
                </div>
              </div>
          }
        </div>
      }
    </div>


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


  worlds: World[] = [];

  private imageService = inject(ImageService);
  worldsWithImages: { [key: string]: string | undefined } = {};

  constructor(private worldService: WorldService, private worldStateService : WorldStateService, private router:Router) { }

  ngOnInit() {
    this.worldStateService.clearWorld();
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

    this.worldStateService.setWorld(world);

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


}
