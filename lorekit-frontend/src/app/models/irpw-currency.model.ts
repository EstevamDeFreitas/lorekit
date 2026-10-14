export interface IrpwCurrencyUnit {
  id: string;
  name: string;
  /** Number of this unit exchanged for one of the next unit; null means independent. */
  convertAt: number | null;
}
export interface IrpwCurrency {
  id: string;
  name: string;
  description: string;
  units: IrpwCurrencyUnit[];
}
export interface IrpwWallet {
  version: 1;
  accounts: { currencyId: string; balances: Record<string, number> }[];
}
export function validateCurrency(currency: IrpwCurrency): string[] {
  const errors: string[] = [];
  if (!currency.name.trim()) errors.push('Informe o nome da configuração.');
  if (!currency.units.length) errors.push('Adicione ao menos uma unidade.');
  if (new Set(currency.units.map(unit => unit.id)).size !== currency.units.length) errors.push('As unidades precisam de identificadores diferentes.');
  for (const [index, unit] of currency.units.entries()) {
    if (!unit.id.trim()) errors.push('As unidades precisam de um identificador.');
    if (!unit.name.trim()) errors.push('Informe o nome de cada unidade.');
    if (unit.convertAt !== null && (!Number.isSafeInteger(unit.convertAt) || unit.convertAt < 2 || index === currency.units.length - 1)) errors.push('A conversão deve ser um inteiro a partir de 2 e ter uma próxima unidade.');
  }
  return errors;
}
export function normalizeCurrencyBalances(currency: IrpwCurrency, balances: Record<string, number>): Record<string, number> {
  const result = { ...balances };
  for (const [index, unit] of currency.units.entries()) {
    const amount = result[unit.id] ?? 0;
    if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('Use quantidades inteiras, positivas ou zero, dentro do limite numérico.');
    result[unit.id] = amount;
    if (unit.convertAt !== null && index < currency.units.length - 1) {
      const next = currency.units[index + 1].id;
      result[next] = (result[next] ?? 0) + Math.floor(amount / unit.convertAt);
      result[unit.id] = amount % unit.convertAt;
    }
  }
  return result;
}
export function parseWallet(raw: string | null | undefined): IrpwWallet | null {
  if (!raw?.trim()) return { version: 1, accounts: [] };
  try {
    const value = JSON.parse(raw) as IrpwWallet;
    if (value.version !== 1 || !Array.isArray(value.accounts)) return null;
    if (value.accounts.some(account => !account || typeof account.currencyId !== 'string' || !account.balances || Array.isArray(account.balances) || Object.values(account.balances).some(amount => !Number.isSafeInteger(amount) || amount < 0))) return null;
    return value;
  } catch { return null; }
}
