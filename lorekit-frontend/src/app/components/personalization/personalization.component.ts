import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Personalization, WeakRelationship } from '../../models/personalization.model';
import { InputComponent } from "../input/input.component";
import { PersonalizationService } from '../../services/personalization.service';
import { ButtonComponent } from "../button/button.component";
import { PaletteSelectorComponent } from "../palette-selector/palette-selector.component";
import { ImageService } from '../../services/image.service';
import { Image } from '../../models/image.model';
import { ImageUploaderComponent } from '../ImageUploader/image-uploader.component';
import { FormsModule } from '@angular/forms';



@Component({
  selector: 'app-personalization',
  imports: [InputComponent, ButtonComponent, PaletteSelectorComponent, FormsModule],
  template: `
    <div class="p-4 bg-zinc-900 rounded-md border border-zinc-800 w-90">
      <h2 class="text-lg mb-4">Personalização</h2>
      <p>Aparência</p>
      <div class="flex flex-col border border-zinc-800 rounded-md mt-2">
        <div class="flex flex-row justify-between items-center p-2 border-b border-zinc-800">
          <p>Cor</p>
          <div class="flex flex-row items-center gap-2">
            <input
              type="color"
              class="h-8 w-10 rounded border border-zinc-700 bg-transparent"
              [(ngModel)]="personalizationContent['color']"
              (ngModelChange)="onColorChange($event)"
            />
            <app-input
              class="w-30"
              [placeholder]="'#RRGGBB'"
              [type]="'text'"
              [(value)]="personalizationContent['color']"
              (valueChange)="onHexInput($event)"
            ></app-input>
          </div>
        </div>
        <div class="flex flex-row justify-between items-center p-2 border-b border-zinc-800">
          <p>Ícone</p>
          <app-input [(value)]="personalizationContent['icon']"></app-input>
        </div>

        <div class="flex flex-col gap-2 p-2 border-b border-zinc-800">
          <p>Imagem de Fundo</p>
          <div
            class="w-full max-h-[12.5rem]"
            [style.aspect-ratio]="backgroundAspectRatio"
            (click)="openImageUploader('default', backgroundAspectRatio)"
          >
            @if (backgroundImage) {
              <img
                class="w-full h-full object-contain cursor-pointer hover:opacity-50 rounded-md transition bg-zinc-800"
                [src]="backgroundImage.filePath"
                alt=""
              >
            } @else {
              <div class="w-full h-full bg-zinc-800 flex items-center justify-center rounded-md cursor-pointer hover:opacity-50">
                <span class="text-zinc-500">Nenhuma imagem definida</span>
              </div>
            }
          </div>
        </div>

        @if (relationshipInfo.entityTable == 'Species'){
          <div class="flex flex-col gap-2 p-2 border-b border-zinc-800">
            <p>Imagem da Espécie</p>
            <div
              class="w-full max-h-[12.5rem]"
              [style.aspect-ratio]="fullBodyAspectRatio"
              (click)="openImageUploader('fullBody', fullBodyAspectRatio)"
            >
              @if (fullBodyImage) {
                <img
                  class="w-full h-full object-contain cursor-pointer hover:opacity-50 rounded-md transition bg-zinc-800"
                  [src]="fullBodyImage.filePath"
                  alt=""
                >
              } @else {
                <div class="w-full h-full bg-zinc-800 flex items-center justify-center rounded-md cursor-pointer hover:opacity-50">
                  <span class="text-zinc-500">Nenhuma imagem definida</span>
                </div>
              }
            </div>
          </div>
        }

        @if (relationshipInfo.entityTable == 'Character'){
          <div class="flex flex-col gap-2 p-2 border-b border-zinc-800">
            <p>Imagem do Personagem</p>
            <div
              class="w-full max-h-[12.5rem]"
              [style.aspect-ratio]="profileAspectRatio"
              (click)="openImageUploader('profile', profileAspectRatio)"
            >
              @if (profileImage) {
                <img
                  class="w-full h-full object-contain cursor-pointer hover:opacity-50 rounded-md transition bg-zinc-800"
                  [src]="profileImage.filePath"
                  alt=""
                >
              } @else {
                <div class="w-full h-full bg-zinc-800 flex items-center justify-center rounded-md cursor-pointer hover:opacity-50">
                  <span class="text-zinc-500">Nenhuma imagem definida</span>
                </div>
              }
            </div>
          </div>
        }

        @if (relationshipInfo.entityTable == 'Organization'){
          <div class="flex flex-col gap-2 p-2 border-b border-zinc-800">
            <p>Imagem da Organização</p>
            <div
              class="w-full max-h-[12.5rem]"
              [style.aspect-ratio]="profileAspectRatio"
              (click)="openImageUploader('profile', profileAspectRatio)"
            >
              @if (profileImage) {
                <img
                  class="w-full h-full object-contain cursor-pointer hover:opacity-50 rounded-md transition bg-zinc-800"
                  [src]="profileImage.filePath"
                  alt=""
                >
              } @else {
                <div class="w-full h-full bg-zinc-800 flex items-center justify-center rounded-md cursor-pointer hover:opacity-50">
                  <span class="text-zinc-500">Nenhuma imagem definida</span>
                </div>
              }
            </div>
          </div>
        }

      </div>
      <div class="flex flex-row justify-end gap-2 mt-4">
        <app-button label="Salvar" (click)="savePersonalization()"></app-button>
        <app-button label="Cancelar" buttonType="secondary" (click)="dialogref.close()"></app-button>
      </div>
    </div>
  `,
  styleUrl: './personalization.component.css',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class PersonalizationComponent {
  dialogref = inject<DialogRef<any>>(DialogRef<any>);
  relationshipInfo = inject<WeakRelationship>(DIALOG_DATA);

  personalizationData : Personalization = new Personalization();
  personalizationContent : any = {};

  dialog = inject(Dialog);

  private imageService = inject(ImageService);
  backgroundImage : Image | null = null;
  profileImage : Image | null = null;
  fullBodyImage : Image | null = null;

  backgroundAspectRatio = 10 / 1;

  hasProfileImage = false;
  profileAspectRatio = 1 / 1;
  hasFullBodyImage = false;
  fullBodyAspectRatio = 20 / 35;

  constructor(private personalizationService: PersonalizationService) {
    this.loadPersonalization();

  }

  processPersonalizationContent() {
    this.personalizationContent = JSON.parse(this.personalizationData.contentJson || '{}');
  }

  loadPersonalization() {

    this.personalizationData = this.personalizationService.getPersonalization(this.relationshipInfo.entityTable, this.relationshipInfo.entityId);

    this.personalizationData = this.personalizationData || new Personalization(undefined, '{}');

    this.processPersonalizationContent();
    this.loadImages();
  }

  savePersonalization() {
    this.personalizationData.contentJson = JSON.stringify(this.personalizationContent);
    this.personalizationService.savePersonalization(this.personalizationData, this.relationshipInfo.entityTable, this.relationshipInfo.entityId);
    this.dialogref.close();
  }

  loadImages() {
    this.backgroundImage = this.imageService.getImage(this.relationshipInfo.entityTable, this.relationshipInfo.entityId, "default");
    this.profileImage = this.imageService.getImage(this.relationshipInfo.entityTable, this.relationshipInfo.entityId, "profile");
    this.fullBodyImage = this.imageService.getImage(this.relationshipInfo.entityTable, this.relationshipInfo.entityId, "fullBody");
  }

  openImageUploader(usageKey:string, aspectRatio?:number) {
    var dialogRef = this.dialog.open(ImageUploaderComponent, {
      data: { entityTable: this.relationshipInfo.entityTable, entityId: this.relationshipInfo.entityId, usageKey: usageKey, aspectRatio: aspectRatio },
      panelClass: 'screen-dialog',
      height: '20rem',
      width: '30rem',
    });

    dialogRef.closed.subscribe(() => {
      this.loadImages();
    });
  }

  onColorChange(hex: string) {
    this.personalizationContent['color'] = this.normalizeHex(hex, this.personalizationContent['color']);
  }

  onHexInput(val: string) {
    this.personalizationContent['color'] = this.normalizeHex(val, this.personalizationContent['color']);
  }

  private normalizeHex(value: string, fallback: string = '#000000'): string {
    if (!value) return fallback || '#000000';
    let v = value.trim().toUpperCase();
    if (!v.startsWith('#')) v = `#${v}`;
    // Expande #RGB -> #RRGGBB
    const short = /^#([0-9A-F]{3})$/i;
    if (short.test(v)) {
      v = v.replace(short, (_m, g) => {
        const [r, g1, b] = g;
        return `#${r}${r}${g1}${g1}${b}${b}`.toUpperCase();
      });
    }
    // Valida #RRGGBB
    return /^#([0-9A-F]{6})$/i.test(v) ? v : (fallback || '#000000');
  }

}
