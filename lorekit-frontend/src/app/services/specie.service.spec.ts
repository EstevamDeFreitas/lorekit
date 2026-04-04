import { SpecieService } from './specie.service';

describe('SpecieService', () => {
  let crud: jasmine.SpyObj<any>;
  let service: SpecieService;

  beforeEach(() => {
    crud = jasmine.createSpyObj('CrudHelper', ['findById', 'findFirst', 'deleteWhen', 'create']);
    service = new SpecieService({ getCrudHelper: () => crud } as any);
  });

  it('promotes a child species to the root without changing world relationships', () => {
    crud.findById.and.callFake((_table: string, id: string) => ({
      id,
      ParentWorld: { id: 'world-1' },
    }));
    crud.findFirst.and.returnValue(null);

    service.reparentSpecie('child-specie', null);

    expect(crud.deleteWhen).toHaveBeenCalledWith('Relationship', {
      parentTable: 'Species',
      entityTable: 'Species',
      entityId: 'child-specie'
    });
    expect(crud.create).not.toHaveBeenCalled();
  });

  it('moves a root species under another species in the same world', () => {
    crud.findById.and.callFake((_table: string, id: string) => ({
      id,
      ParentWorld: { id: 'world-1' },
    }));
    crud.findFirst.and.returnValue(null);

    service.reparentSpecie('child-specie', 'parent-specie');

    expect(crud.create).toHaveBeenCalledWith('Relationship', {
      parentTable: 'Species',
      parentId: 'parent-specie',
      entityTable: 'Species',
      entityId: 'child-specie'
    });
  });

  it('blocks cyclical species reparenting', () => {
    crud.findById.and.callFake((_table: string, id: string) => ({
      id,
      ParentWorld: { id: 'world-1' },
    }));
    crud.findFirst.and.callFake((_table: string, where: { entityId: string }) => {
      if (where.entityId === 'child-specie') {
        return { parentId: 'root-specie' };
      }

      return null;
    });

    expect(() => service.reparentSpecie('root-specie', 'child-specie'))
      .toThrowError(/descendente/i);
  });

  it('blocks moving a species into another world', () => {
    crud.findById.and.callFake((_table: string, id: string) => ({
      id,
      ParentWorld: { id: id === 'child-specie' ? 'world-2' : 'world-1' },
    }));
    crud.findFirst.and.returnValue(null);

    expect(() => service.reparentSpecie('child-specie', 'parent-specie'))
      .toThrowError(/mesmo mundo/i);
  });
});
