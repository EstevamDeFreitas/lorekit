import { EntityHierarchyService } from './entity-hierarchy.service';

describe('EntityHierarchyService', () => {
  let crud: jasmine.SpyObj<any>;
  let service: EntityHierarchyService;

  beforeEach(() => {
    crud = jasmine.createSpyObj('CrudHelper', ['findById', 'findFirst', 'deleteWhen', 'create']);
    crud.findById.and.callFake((_table: string, id: string) => ({ id }));
    service = new EntityHierarchyService({ getCrudHelper: () => crud } as any);
  });

  it('moves an entity under a parent in the same world', () => {
    crud.findFirst.and.callFake((_table: string, where: { parentTable: string }) =>
      where.parentTable === 'World' ? { parentId: 'world-1' } : null
    );

    service.reparent('Character', 'child', 'parent');

    expect(crud.create).toHaveBeenCalledWith('Relationship', {
      parentTable: 'Character',
      parentId: 'parent',
      entityTable: 'Character',
      entityId: 'child'
    });
  });

  it('promotes an entity to the root without changing its world', () => {
    crud.findFirst.and.returnValue(null);

    service.reparent('Culture', 'child', null);

    expect(crud.deleteWhen).toHaveBeenCalledWith('Relationship', {
      parentTable: 'Culture',
      entityTable: 'Culture',
      entityId: 'child'
    });
    expect(crud.create).not.toHaveBeenCalled();
  });

  it('blocks moving an entity into another world', () => {
    crud.findFirst.and.callFake((_table: string, where: { parentTable: string; entityId: string }) => {
      if (where.parentTable === 'World') {
        return { parentId: where.entityId === 'child' ? 'world-1' : 'world-2' };
      }

      return null;
    });

    expect(() => service.reparent('Organization', 'child', 'parent'))
      .toThrowError(/mesmo mundo/i);
  });

  it('blocks cyclical hierarchy changes', () => {
    crud.findFirst.and.callFake((_table: string, where: { parentTable: string; entityId: string }) => {
      if (where.parentTable === 'World') {
        return { parentId: 'world-1' };
      }

      if (where.entityId === 'child') {
        return { parentId: 'root' };
      }

      return null;
    });

    expect(() => service.reparent('Object', 'root', 'child'))
      .toThrowError(/descendente/i);
  });
});
