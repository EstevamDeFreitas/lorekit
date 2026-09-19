import { IrpwSpecieService } from './irpw-specie.service';

describe('IrpwSpecieService', () => {
  it('creates a missing config once and returns the existing config afterwards', () => {
    const configs = new Map<string, any>();
    const crud = {
      findById: jasmine.createSpy('findById').and.callFake((_table: string, id: string) => configs.get(id) ?? null),
      create: jasmine.createSpy('create').and.callFake((_table: string, value: any) => {
        configs.set(value.id, value);
        return value;
      }),
    };
    const dbProvider = { getCrudHelper: () => crud };
    const service = new IrpwSpecieService(dbProvider as any);

    const first = service.ensureConfig('species-1');
    const second = service.ensureConfig('species-1');

    expect(first.id).toBe('species-1');
    expect(second).toBe(first);
    expect(crud.create).toHaveBeenCalledTimes(1);
  });
});
