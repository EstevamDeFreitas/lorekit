import { Dialog } from '@angular/cdk/dialog';
import { Injectable, inject } from '@angular/core';
import { DbProvider } from '../app.config';
import { CrudHelper } from '../database/database.helper';

export type MentionEntityTable = 'World' | 'Document' | 'Location' | 'Species' | 'Character' | 'Culture' | 'Organization';

export type MentionEntity = {
  entityTable: MentionEntityTable;
  entityId: string;
  label: string;
  subtitle: string;
  href: string;
};

type EntitySearchDef = {
  table: MentionEntityTable;
  column: 'name' | 'title';
  subtitle: string;
};

@Injectable({
  providedIn: 'root'
})
export class EntityMentionService {
  private readonly dbProvider = inject(DbProvider);
  private readonly dialog = inject(Dialog);
  private readonly crud: CrudHelper;

  private readonly searchDefs: EntitySearchDef[] = [
    { table: 'World', column: 'name', subtitle: 'Mundo' },
    { table: 'Location', column: 'name', subtitle: 'Localidade' },
    { table: 'Document', column: 'title', subtitle: 'Documento' },
    { table: 'Species', column: 'name', subtitle: 'Espécie' },
    { table: 'Character', column: 'name', subtitle: 'Personagem' },
    { table: 'Culture', column: 'name', subtitle: 'Cultura' },
    { table: 'Organization', column: 'name', subtitle: 'Organização' },
  ];

  constructor() {
    this.crud = this.dbProvider.getCrudHelper();
  }

  search(term: string, limit: number = 8): MentionEntity[] {
    const normalizedTerm = term.trim();
    if (!normalizedTerm) return [];

    const out: MentionEntity[] = [];

    for (const def of this.searchDefs) {
      const rows = this.crud.searchInTable(def.table, normalizedTerm, [def.column]) as Array<Record<string, unknown>>;
      for (const row of rows) {
        const id = String(row['id'] ?? '');
        const label = String(row[def.column] ?? '').trim();

        if (!id || !label) continue;

        out.push({
          entityTable: def.table,
          entityId: id,
          label,
          subtitle: def.subtitle,
          href: this.buildMentionHref(def.table, id)
        });
      }
    }

    const lower = normalizedTerm.toLocaleLowerCase();

    const sorted = out
      .filter((x, index, arr) => arr.findIndex(y => y.entityId === x.entityId && y.entityTable === x.entityTable) === index)
      .sort((a, b) => {
        const aLabel = a.label.toLocaleLowerCase();
        const bLabel = b.label.toLocaleLowerCase();

        const aStarts = aLabel.startsWith(lower) ? 0 : 1;
        const bStarts = bLabel.startsWith(lower) ? 0 : 1;

        if (aStarts !== bStarts) return aStarts - bStarts;

        if (aLabel !== bLabel) return aLabel.localeCompare(bLabel);

        return a.subtitle.localeCompare(b.subtitle);
      });

    return sorted.slice(0, limit);
  }

  buildMentionHref(table: MentionEntityTable, id: string): string {
    return `lorekit://entity/${encodeURIComponent(table)}/${encodeURIComponent(id)}`;
  }

  parseMentionHref(href: string): { table: MentionEntityTable; id: string } | null {
    const m = href.match(/^lorekit:\/\/entity\/([^/]+)\/([^/?#]+)/i);
    if (!m) return null;

    const table = decodeURIComponent(m[1]) as MentionEntityTable;
    const id = decodeURIComponent(m[2]);

    const valid = this.searchDefs.some(def => def.table === table);
    if (!valid || !id) return null;

    return { table, id };
  }

  async openMentionEditor(mention: Pick<MentionEntity, 'entityTable' | 'entityId'>): Promise<void> {
    const config = {
      data: { id: mention.entityId },
      panelClass: ['screen-dialog', 'h-[100vh]', 'overflow-y-auto', 'scrollbar-dark'] as string[],
      height: '80vh',
      width: '80vw',
      autoFocus: false,
      restoreFocus: false,
    };

    switch (mention.entityTable) {
      case 'World': {
        const { WorldInfoComponent } = await import('../pages/world/world-info/world-info.component');
        this.dialog.open(WorldInfoComponent, config);
        return;
      }
      case 'Document': {
        const { DocumentEditComponent } = await import('../pages/documents/document-edit/document-edit.component');
        this.dialog.open(DocumentEditComponent, config);
        return;
      }
      case 'Location': {
        const { LocationEditComponent } = await import('../pages/locations/location-edit/location-edit.component');
        this.dialog.open(LocationEditComponent, config);
        return;
      }
      case 'Species': {
        const { SpecieEditComponent } = await import('../pages/species/specie-edit/specie-edit.component');
        this.dialog.open(SpecieEditComponent, config);
        return;
      }
      case 'Character': {
        const { CharacterEditComponent } = await import('../pages/characters/character-edit/character-edit.component');
        this.dialog.open(CharacterEditComponent, config);
        return;
      }
      case 'Culture': {
        const { CultureEditComponent } = await import('../pages/cultures/culture-edit/culture-edit.component');
        this.dialog.open(CultureEditComponent, config);
        return;
      }
      case 'Organization': {
        const { OrganizationEditComponent } = await import('../pages/organizations/organization-edit/organization-edit.component');
        this.dialog.open(OrganizationEditComponent, config);
        return;
      }
      default:
        return;
    }
  }
}
