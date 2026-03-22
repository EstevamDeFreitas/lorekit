import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ButtonComponent } from "../../../components/button/button.component";
import { IconButtonComponent } from "../../../components/icon-button/icon-button.component";
import { InputComponent } from "../../../components/input/input.component";
import { PersonalizationButtonComponent } from "../../../components/personalization-button/personalization-button.component";
import { TextAreaComponent } from "../../../components/text-area/text-area.component";
import { ConfirmService } from '../../../components/confirm-dialog/confirm-dialog.component';
import { GreatMark } from '../../../models/great-mark.model';
import { GreatMarkService } from '../../../services/great-mark.service';

interface GreatMarkDialogData {
  id?: string;
  timelineId: string;
  defaultSortOrder: number;
}

@Component({
  selector: 'app-great-mark-edit',
  standalone: true,
  imports: [ButtonComponent, IconButtonComponent, InputComponent, PersonalizationButtonComponent, TextAreaComponent],
  template: `
    <div class="w-[36rem] max-w-[92vw] rounded-xl border border-zinc-800 bg-zinc-900 p-4 flex flex-col gap-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-bold">{{ mark.id ? 'Editar Grande Marco' : 'Novo Grande Marco' }}</h2>
          <p class="text-sm text-zinc-400">Os grandes marcos dividem as seções visuais da timeline quando você quiser usar.</p>
        </div>
        <div class="flex items-center gap-2">
          @if (mark.id) {
            <app-personalization-button [entityId]="mark.id" [entityTable]="'GreatMark'" [size]="'lg'"></app-personalization-button>
          }
          <app-icon-button icon="fa-solid fa-xmark" buttonType="secondary" size="lg" (click)="dialogRef.close()"></app-icon-button>
        </div>
      </div>

      <app-input label="Nome" [(value)]="mark.name"></app-input>
      <app-input label="Conceito" [(value)]="mark.concept"></app-input>
      <app-text-area label="Descrição" [(value)]="mark.description" height="h-28"></app-text-area>

      <div class="flex justify-between gap-2 pt-2">
        <div>
          @if (mark.id) {
            <app-button label="Excluir" buttonType="danger" size="sm" (click)="deleteMark()"></app-button>
          }
        </div>
        <div class="flex gap-2">
          <app-button label="Cancelar" buttonType="secondary" size="sm" (click)="dialogRef.close()"></app-button>
          <app-button label="Salvar" buttonType="primary" size="sm" (click)="saveMark()"></app-button>
        </div>
      </div>
    </div>
  `,
  styleUrl: './great-mark-edit.component.css',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class GreatMarkEditComponent {
  readonly dialogRef = inject<DialogRef<any>>(DialogRef<any>);
  readonly data = inject<GreatMarkDialogData>(DIALOG_DATA);
  private readonly greatMarkService = inject(GreatMarkService);
  private readonly confirm = inject(ConfirmService);

  mark = new GreatMark('', '', '', this.data.defaultSortOrder);

  constructor() {
    if (this.data.id) {
      this.mark = this.greatMarkService.getGreatMarkById(this.data.id);
    } else {
      this.mark.sortOrder = this.data.defaultSortOrder;
    }
  }

  saveMark() {
    if (!this.mark.name.trim()) {
      return;
    }

    if (!this.mark.description) {
      this.mark.description = '';
    }

    const savedMark = this.greatMarkService.saveGreatMark(this.mark, this.data.timelineId);
    this.dialogRef.close({ saved: true, markId: savedMark.id });
  }

  deleteMark() {
    this.confirm.ask(`Tem certeza que deseja excluir o grande marco ${this.mark.name}?`).then(confirmed => {
      if (!confirmed) {
        return;
      }

      this.greatMarkService.deleteGreatMark(this.mark.id, false);
      this.dialogRef.close({ deleted: true });
    });
  }
}
