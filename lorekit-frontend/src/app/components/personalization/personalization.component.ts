import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Personalization, WeakRelationship } from '../../models/personalization.model';
import { InputComponent } from "../input/input.component";
import { PersonalizationService } from '../../services/personalization.service';
import { ButtonComponent } from "../button/button.component";
import { PaletteSelectorComponent } from "../palette-selector/palette-selector.component";



@Component({
  selector: 'app-personalization',
  imports: [InputComponent, ButtonComponent, PaletteSelectorComponent],
  template: `
    <div class="p-4 bg-zinc-900 rounded-md border border-zinc-800 w-90">
      <h2 class="text-lg mb-4">Personalização</h2>
      <p>Aparência</p>
      <div class="flex flex-col border border-zinc-800 rounded-md mt-2">
        <div class="flex flex-row justify-between items-center p-2 border-b border-zinc-800">
          <p>Cor</p>
          <app-palette-selector [(selectedColor)]="personalizationContent['color']"></app-palette-selector>
        </div>
        <div class="flex flex-row justify-between items-center p-2 border-b border-zinc-800">
          <p>Ícone</p>
          <app-input [(value)]="personalizationContent['icon']"></app-input>
        </div>
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

  constructor(private personalizationService: PersonalizationService) {
    this.loadPersonalization();
  }

  processPersonalizationContent() {
    this.personalizationContent = JSON.parse(this.personalizationData.contentJson || '{}');
  }

  loadPersonalization() {
    this.personalizationService.getPersonalization(this.relationshipInfo.entityTable, this.relationshipInfo.entityId).subscribe({
      next: (data) => {
        this.personalizationData = data;
        this.processPersonalizationContent();
      },
      error: (error) => {
        this.personalizationData = new Personalization();
        this.personalizationData.entityTable = this.relationshipInfo.entityTable;
        this.personalizationData.entityId = this.relationshipInfo.entityId;
        this.personalizationData.contentJson = '{}';
        this.processPersonalizationContent();
      }
    });
  }

  savePersonalization() {
    this.personalizationData.contentJson = JSON.stringify(this.personalizationContent);
    this.personalizationService.savePersonalization(this.personalizationData).subscribe({
      next: (data) => {
        this.dialogref.close();
      },
      error: (error) => {
        console.error('Error saving personalization', error);
      }
    });
  }

}
