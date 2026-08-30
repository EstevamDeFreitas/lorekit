import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ButtonComponent } from '../../../components/button/button.component';
import { IconButtonComponent } from '../../../components/icon-button/icon-button.component';
import { InputComponent } from '../../../components/input/input.component';
import { PersonalizationButtonComponent } from '../../../components/personalization-button/personalization-button.component';
import { TextAreaComponent } from '../../../components/text-area/text-area.component';
import { ConfirmService } from '../../../components/confirm-dialog/confirm-dialog.component';
import { Age } from '../../../models/age.model';
import { AgeService } from '../../../services/age.service';
interface AgeDialogData {
  id?: string;
  timelineId: string;
  defaultStartDate: number;
}
@Component({
  selector: 'app-age-edit',
  imports: [ButtonComponent, IconButtonComponent, InputComponent, PersonalizationButtonComponent, TextAreaComponent],
  template: `
    <div class="w-full max-w-[36rem] max-h-[82vh] overflow-y-auto scrollbar-dark pr-1 flex flex-col gap-4">
      <div class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 class="text-lg font-bold">{{ age.id ? 'Editar Era' : 'Nova Era' }}</h2>
          <p class="text-sm text-zinc-400">As eras podem se sobrepor e organizar o contexto visual da timeline.</p>
        </div>
        <div class="flex shrink-0 flex-wrap items-center gap-2">
          @if (age.id) {
            <app-personalization-button [entityId]="age.id" [entityTable]="'Age'" [size]="'lg'"></app-personalization-button>
          }
          <app-icon-button icon="fa-solid fa-xmark" buttonType="secondary" size="lg" (click)="dialogRef.close()"></app-icon-button>
        </div>
      </div>
      <app-input label="Nome" [(value)]="age.name"></app-input>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <app-input label="Início (ano)" type="number" [(value)]="age.startDate"></app-input>
        <app-input label="Fim (ano)" type="number" [(value)]="age.endDate"></app-input>
      </div>
      <app-text-area label="Descrição" [(value)]="age.description" height="h-28"></app-text-area>
      <p class="text-xs text-zinc-500">Use &#123;AutoGenDate&#125;, &#123;AutoGenStartDate&#125; e &#123;AutoGenEndDate&#125; no nome ou na descrição.</p>
      <div class="flex flex-wrap justify-between gap-3 pt-2">
        <div>
          @if (age.id) {
            <app-button label="Excluir" buttonType="danger" size="sm" (click)="deleteAge()"></app-button>
          }
        </div>
        <div class="flex gap-2">
          <app-button label="Cancelar" buttonType="secondary" size="sm" (click)="dialogRef.close()"></app-button>
          <app-button label="Salvar" buttonType="primary" size="sm" (click)="saveAge()"></app-button>
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Default,
})
export class AgeEditComponent {
  readonly dialogRef = inject<DialogRef<any>>(DialogRef<any>);
  readonly data = inject<AgeDialogData>(DIALOG_DATA);
  private readonly ageService = inject(AgeService);
  private readonly confirm = inject(ConfirmService);
  age = new Age('', '', '', this.data.defaultStartDate, this.data.defaultStartDate);
  constructor() {
    if (this.data.id) {
      const storedAge = this.ageService.getAgeById(this.data.id);
      if (storedAge) this.age = storedAge;
    }
  }
  saveAge() {
    if (!this.age.name.trim()) return;
    this.age.description ||= '';
    const savedAge = this.ageService.saveAge(this.age, this.data.timelineId);
    this.dialogRef.close({ saved: true, ageId: savedAge.id });
  }
  deleteAge() {
    this.confirm.ask(`Tem certeza que deseja excluir a era ${this.age.name}?`).then(confirmed => {
      if (!confirmed) return;
      this.ageService.deleteAge(this.age.id, false);
      this.dialogRef.close({ deleted: true });
    });
  }
}
