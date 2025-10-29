import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';
import { InputComponent } from "../input/input.component";
import { ButtonComponent } from "../button/button.component";
import { FormsModule } from '@angular/forms';
import { WorldService } from '../../services/world.service';
import { DocumentService } from '../../services/document.service';
import { LocationService } from '../../services/location.service';

@Component({
  imports: [InputComponent, ButtonComponent, FormsModule],
  template: `
    <div class="flex flex-col">
      <h2 class="text-lg font-bold">Excluir "{{ dialogData.entityName }}"</h2>
      <br>
      <!-- <div class="flex flex-row gap-1">
        <input type="checkbox" id="relatedItems" [(ngModel)]="removeRelatedItems"/>
        <p>Excluir items relacionados</p>
      </div> -->
      <br>
      <div>
        <app-input [label]="'Escreva o nome para confirmar:'" [(value)]="inputValue"></app-input>
      </div>
      <br>
      <div class="flex flex-row gap-2">
        <app-button [label]="'Excluir'" buttonType="danger" [disabled]="!namesMatch()" (click)="onDelete()"></app-button>
        <app-button [label]="'Cancelar'" buttonType="secondary"></app-button>
      </div>
    </div>
  `,
  styleUrl: './safe-delete.component.css',
})
export class SafeDeleteComponent {
  dialogref = inject<DialogRef<any>>(DialogRef<any>);
  dialogData = inject<any>(DIALOG_DATA);

  //services
  worldService = inject<WorldService>(WorldService);
  documentService = inject<DocumentService>(DocumentService);
  locationService = inject<LocationService>(LocationService);

  inputValue: string = '';
  removeRelatedItems: boolean = false;

  namesMatch(): boolean {
    return this.inputValue.trimEnd() === this.dialogData.entityName.trimEnd();
  }

  onDelete() {
    if (this.namesMatch()) {
      switch (this.dialogData.entityTable) {
        case 'World':
          this.worldService.deleteWorld(this.dialogData.entityId, this.removeRelatedItems);
          this.dialogref.close(true);
          break;
        case 'Location':
          this.locationService.deleteLocation(this.dialogData.entityId, this.removeRelatedItems);
          this.dialogref.close(true);
          break;
        case 'Document':
          this.documentService.deleteDocument(this.dialogData.entityId, this.removeRelatedItems);
          this.dialogref.close(true);
          break;
        default:
          console.error('Unknown entity table:', this.dialogData.entityTable);
          this.dialogref.close(false);
      }
    }
  }

}
