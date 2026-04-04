import { LocationService } from './location.service';

describe('LocationService', () => {
  let crud: jasmine.SpyObj<any>;
  let service: LocationService;

  beforeEach(() => {
    crud = jasmine.createSpyObj('CrudHelper', ['findById', 'findFirst', 'deleteWhen', 'create']);
    service = new LocationService({ getCrudHelper: () => crud } as any);
  });

  it('promotes a child location to the root without touching the world relationship', () => {
    crud.findById.and.callFake((_table: string, id: string) => ({
      id,
      ParentWorld: { id: 'world-1' },
    }));
    crud.findFirst.and.returnValue(null);

    service.reparentLocation('child-location', null);

    expect(crud.deleteWhen).toHaveBeenCalledWith('Relationship', {
      parentTable: 'Location',
      entityTable: 'Location',
      entityId: 'child-location'
    });
    expect(crud.create).not.toHaveBeenCalled();
  });

  it('turns a root location into a child of another location in the same world', () => {
    crud.findById.and.callFake((_table: string, id: string) => ({
      id,
      ParentWorld: { id: 'world-1' },
    }));
    crud.findFirst.and.returnValue(null);

    service.reparentLocation('child-location', 'parent-location');

    expect(crud.create).toHaveBeenCalledWith('Relationship', {
      parentTable: 'Location',
      parentId: 'parent-location',
      entityTable: 'Location',
      entityId: 'child-location'
    });
  });

  it('blocks cyclical reparenting', () => {
    crud.findById.and.callFake((_table: string, id: string) => ({
      id,
      ParentWorld: { id: 'world-1' },
    }));
    crud.findFirst.and.callFake((_table: string, where: { entityId: string }) => {
      if (where.entityId === 'child-location') {
        return { parentId: 'root-location' };
      }

      return null;
    });

    expect(() => service.reparentLocation('root-location', 'child-location'))
      .toThrowError(/descendente/i);
  });

  it('blocks moving a location into another world', () => {
    crud.findById.and.callFake((_table: string, id: string) => ({
      id,
      ParentWorld: { id: id === 'child-location' ? 'world-2' : 'world-1' },
    }));
    crud.findFirst.and.returnValue(null);

    expect(() => service.reparentLocation('child-location', 'parent-location'))
      .toThrowError(/mesmo mundo/i);
  });
});
