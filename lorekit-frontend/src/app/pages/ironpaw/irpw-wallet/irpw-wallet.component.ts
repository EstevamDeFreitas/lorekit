import { ComboBoxComponent } from '../../../components/combo-box/combo-box.component';
import { InputComponent } from '../../../components/input/input.component';
import { ButtonComponent } from '../../../components/button/button.component';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IrpwCurrencyService } from '../../../services/irpw-currency.service';
import { IrpwCharacterSheetService } from '../../../services/irpw-character-sheet.service';
import { IrpwCurrency, IrpwWallet, normalizeCurrencyBalances, parseWallet } from '../../../models/irpw-currency.model';

@Component({
  selector: 'irpw-wallet', imports: [FormsModule, ComboBoxComponent, InputComponent, ButtonComponent],
  templateUrl: './irpw-wallet.component.html', styleUrl: './irpw-wallet.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IrpwWalletComponent {
  readonly characterId = input.required<string>();
  private readonly currencyService = inject(IrpwCurrencyService);
  private readonly sheets = inject(IrpwCharacterSheetService);
  readonly wallet = signal<IrpwWallet | null>({ version: 1, accounts: [] });
  readonly currencies = computed(() => { this.currencyService.changes(); return this.currencyService.getCurrencies(); });
  readonly notice = signal('');
  selectedCurrency = '';
  readonly configuring = signal(false);
  readonly availableCurrencies = computed(() => this.currencies().filter(currency => !this.wallet()?.accounts.some(account => account.currencyId === currency.id)));
  constructor() { effect(() => { this.wallet.set(parseWallet(this.sheets.getSheet(this.characterId())?.wallet)); this.notice.set(''); }); }
  currency(id: string): IrpwCurrency | undefined { return this.currencies().find(currency => currency.id === id); }
  add(): void {
    const currency = this.currency(this.selectedCurrency);
    const wallet = this.wallet();
    if (!currency || !wallet || wallet.accounts.some(account => account.currencyId === currency.id)) return;
    this.persist({ ...wallet, accounts: [...wallet.accounts, { currencyId: currency.id, balances: {} }] });
    this.selectedCurrency = ''; this.configuring.set(false);
  }
  setBalance(currencyId: string, unitId: string, raw: string | number): void {
    const wallet = this.wallet(); const currency = this.currency(currencyId);
    if (!wallet || !currency || !String(raw).trim()) { this.notice.set('Informe uma quantidade inteira, positiva ou zero.'); return; }
    try {
      const accounts = wallet.accounts.map(account => account.currencyId === currencyId ? { ...account, balances: normalizeCurrencyBalances(currency, { ...account.balances, [unitId]: Number(raw) }) } : account);
      this.persist({ ...wallet, accounts });
    } catch (error) { this.notice.set(error instanceof Error ? error.message : 'Não foi possível atualizar o saldo.'); }
  }
  convert(currencyId: string): void {
    const wallet = this.wallet(); const currency = this.currency(currencyId);
    if (!wallet || !currency) return;
    try { this.persist({ ...wallet, accounts: wallet.accounts.map(account => account.currencyId === currencyId ? { ...account, balances: normalizeCurrencyBalances(currency, account.balances) } : account) }); }
    catch (error) { this.notice.set(error instanceof Error ? error.message : 'Não foi possível converter.'); }
  }
  remove(currencyId: string): void {
    const wallet = this.wallet();
    const account = wallet?.accounts.find(account => account.currencyId === currencyId);
    if (!wallet || !account) return;
    if (Object.values(account.balances).some(value => value > 0)) { this.notice.set('Zere ou transfira os saldos antes de remover esta configuração da ficha.'); return; }
    this.persist({ ...wallet, accounts: wallet.accounts.filter(account => account.currencyId !== currencyId) });
  }
  private persist(wallet: IrpwWallet): void {
    const sheet = this.sheets.getSheet(this.characterId());
    if (!sheet) return;
    try { this.sheets.saveSheet(this.characterId(), { ...sheet, wallet: JSON.stringify(wallet) }); this.wallet.set(wallet); this.notice.set('Saldos salvos.'); }
    catch { this.notice.set('Não foi possível salvar. Tente novamente.'); }
  }
}
