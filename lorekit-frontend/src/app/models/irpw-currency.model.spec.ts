import { IrpwCurrency, normalizeCurrencyBalances, parseWallet, validateCurrency } from './irpw-currency.model';

describe('Ironpaw money', () => {
  const currency: IrpwCurrency = { id: 'realm', name: 'Moedas', description: '', units: [
    { id: 'copper', name: 'Cobre', convertAt: 100 }, { id: 'silver', name: 'Prata', convertAt: 100 }, { id: 'gold', name: 'Ouro', convertAt: null },
  ] };
  it('carries through multiple denominations without losing value', () => {
    const balances = { copper: 250, silver: 199, gold: 3 };
    const result = normalizeCurrencyBalances(currency, balances);
    expect(result).toEqual({ copper: 50, silver: 1, gold: 5 });
    expect(result['copper'] + result['silver'] * 100 + result['gold'] * 10000).toBe(balances.copper + balances.silver * 100 + balances.gold * 10000);
    expect(balances.copper).toBe(250);
  });
  it('supports independent unlimited units and integer credits', () => {
    const independent = { ...currency, units: currency.units.map(unit => ({ ...unit, convertAt: null })) };
    expect(normalizeCurrencyBalances(independent, { copper: 2000, silver: 350, gold: 0 })).toEqual({ copper: 2000, silver: 350, gold: 0 });
    expect(normalizeCurrencyBalances({ ...currency, units: [{ id: 'credits', name: 'Créditos', convertAt: null }] }, { credits: 50000 })).toEqual({ credits: 50000 });
  });
  it('supports cents converting to reais', () => {
    expect(normalizeCurrencyBalances({ ...currency, units: [{ id: 'cent', name: 'Centavos', convertAt: 100 }, { id: 'real', name: 'Reais', convertAt: null }] }, { cent: 250, real: 10 })).toEqual({ cent: 50, real: 12 });
  });
  it('rejects negative, fractional, overflowing and nonfinite balances', () => {
    for (const copper of [-1, 1.5, Infinity, NaN]) expect(() => normalizeCurrencyBalances(currency, { copper })).toThrow();
    expect(() => normalizeCurrencyBalances(currency, { copper: 10000, silver: Number.MAX_SAFE_INTEGER })).toThrow();
  });
  it('validates units and preserves incompatible wallets', () => {
    expect(validateCurrency(currency)).toEqual([]);
    expect(validateCurrency({ ...currency, units: [{ id: 'x', name: '', convertAt: 100 }] }).length).toBeGreaterThan(0);
    expect(parseWallet(null)).toEqual({ version: 1, accounts: [] });
    expect(parseWallet('{"version":2,"accounts":[]}')).toBeNull();
    expect(parseWallet('{"version":1,"accounts":[{"currencyId":"realm","balances":{"copper":-1}}]}')).toBeNull();
  });
});
