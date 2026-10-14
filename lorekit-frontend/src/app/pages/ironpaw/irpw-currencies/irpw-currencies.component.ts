import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IrpwCurrency } from '../../../models/irpw-currency.model';
import { IrpwCurrencyService } from '../../../services/irpw-currency.service';

@Component({
  selector: 'irpw-currencies',
  imports: [FormsModule],
  templateUrl: './irpw-currencies.component.html',
  styleUrl: './irpw-currencies.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IrpwCurrenciesComponent {
  private readonly service = inject(IrpwCurrencyService);
  readonly currencies = computed(() => { this.service.changes(); return this.service.getCurrencies(); });
  readonly draft = signal<IrpwCurrency | null>(null);
  readonly notice = signal('');
  select(currency: IrpwCurrency): void { this.draft.set(structuredClone(currency)); this.notice.set(''); }
  create(): void {
    this.draft.set({ id: '', name: '', description: '', units: [{ id: crypto.randomUUID(), name: '', convertAt: null }] });
    this.notice.set('');
  }
  addUnit(): void {
    this.draft.update(draft => draft ? { ...draft, units: [...draft.units, { id: crypto.randomUUID(), name: '', convertAt: null }] } : null);
  }
  removeUnit(index: number): void {
    this.draft.update(draft => {
      if (!draft) return null;
      const units = draft.units.filter((_, i) => i !== index);
      if (units.length) units[units.length - 1].convertAt = null;
      return { ...draft, units };
    });
  }
  save(): void {
    const draft = this.draft();
    if (!draft) return;
    try { this.draft.set(this.service.saveCurrency(draft)); this.notice.set('Configuração salva. Disponível nas fichas.'); }
    catch (error) { this.notice.set(error instanceof Error ? error.message : 'Não foi possível salvar.'); }
  }
}
