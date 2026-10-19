import { Injectable, signal } from '@angular/core';
import { createNpcDefinition, parseNpcDefinition, type NpcDefinition } from '@lorekit/ironpaw';
import { DbProvider } from '../database/db-provider.service';

export interface IrpwCatalogNpc {
  id: string;
  name: string;
  color: string;
  portraitImageId: string | null;
  definition: NpcDefinition;
  revision: number;
  archived: boolean;
}
interface NpcRow {
  id: string; name: string; color: string; portraitImageId: string | null;
  definitionJson: string; revision: number; archived: number;
}

@Injectable({ providedIn: 'root' })
export class IrpwNpcCatalogService {
  readonly changes = signal(0);
  constructor(private readonly provider: DbProvider) {}

  createDraft(): IrpwCatalogNpc {
    return { id: '', name: '', color: '#a1a1aa', portraitImageId: null, definition: createNpcDefinition(), revision: 0, archived: false };
  }

  list(includeArchived = false): IrpwCatalogNpc[] {
    return (this.provider.getCrudHelper().findAll('IRPWNpc') as NpcRow[])
      .filter(row => includeArchived || !row.archived)
      .map(row => this.decode(row))
      .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
  }

  get(id: string): IrpwCatalogNpc | null {
    const row = this.provider.getCrudHelper().findById('IRPWNpc', id) as NpcRow | null;
    return row ? this.decode(row) : null;
  }

  save(npc: IrpwCatalogNpc): IrpwCatalogNpc {
    const name = npc.name.trim();
    if (!name || name.length > 120) throw new Error('Informe um nome de até 120 caracteres.');
    if (!/^#[0-9a-f]{6}$/i.test(npc.color)) throw new Error('Cor inválida.');
    const definition = parseNpcDefinition(npc.definition);
    const crud = this.provider.getCrudHelper();
    const existing = npc.id ? this.get(npc.id) : null;
    if (npc.id && !existing) throw new Error('PNJ não encontrado.');
    if (existing && existing.revision !== npc.revision) throw new Error('O PNJ foi alterado em outra tela. Reabra antes de salvar.');
    const row: NpcRow = {
      id: existing?.id ?? crypto.randomUUID(), name, color: npc.color,
      portraitImageId: npc.portraitImageId, definitionJson: JSON.stringify(definition),
      revision: (existing?.revision ?? 0) + 1, archived: npc.archived ? 1 : 0,
    };
    if (existing) crud.update('IRPWNpc', row.id, row); else crud.create('IRPWNpc', row);
    this.changes.update(value => value + 1);
    return this.decode(row);
  }

  duplicate(npc: IrpwCatalogNpc): IrpwCatalogNpc {
    return this.save({ ...npc, id: '', name: `${npc.name.slice(0, 111)} (cópia)`, revision: 0, archived: false });
  }

  archive(id: string): void {
    const npc = this.get(id);
    if (npc) this.save({ ...npc, archived: true });
  }

  private decode(row: NpcRow): IrpwCatalogNpc {
    return { id: row.id, name: row.name, color: row.color, portraitImageId: row.portraitImageId,
      revision: row.revision, archived: Boolean(row.archived), definition: parseNpcDefinition(JSON.parse(row.definitionJson)) };
  }
}
