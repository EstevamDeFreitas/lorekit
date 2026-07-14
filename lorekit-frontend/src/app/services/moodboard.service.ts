import { Injectable } from '@angular/core';
import { CrudHelper } from '../database/database.helper';
import { DbProvider } from '../app.config';
import { Moodboard, MoodboardItem } from '../models/moodboard.model';
import { Image } from '../models/image.model';
import { Personalization } from '../models/personalization.model';

export type MoodboardEntitySearchResult = {
  table: string;
  id: string;
  label: string;
  subtitle: string;
  imagePath: string | null;
  personalization?: Personalization | null;
};

@Injectable({
  providedIn: 'root',
})
export class MoodboardService {
  private crud: CrudHelper;
  private readonly searchableTables = [
    { table: 'World', label: 'Mundo', column: 'name' },
    { table: 'Character', label: 'Personagem', column: 'name' },
    { table: 'Location', label: 'Localidade', column: 'name' },
    { table: 'Organization', label: 'Organização', column: 'name' },
    { table: 'Species', label: 'Espécie', column: 'name' },
    { table: 'Culture', label: 'Cultura', column: 'name' },
    { table: 'Document', label: 'Documento', column: 'title' },
    { table: 'Object', label: 'Objeto', column: 'name' },
  ];

  constructor(private dbProvider: DbProvider) {
    this.crud = this.dbProvider.getCrudHelper();
  }

  getMoodboards(worldId: string | null | undefined): Moodboard[] {
    const existsRelation = worldId ? { parentId: worldId, parentTable: 'World' } : undefined;

    return (this.crud.findAll('Moodboard', {}, [
      { "table": "Personalization", "firstOnly": true },
      { "table": "Image", "firstOnly": false },
      { "table": "World", "firstOnly": true, "isParent": true }
    ], existsRelation) || [])
      .sort((a: Moodboard, b: Moodboard) => (a.name || '').localeCompare(b.name || ''));
  }

  getMoodboard(id: string): Moodboard | null {
    const moodboard = this.crud.findById('Moodboard', id, [
      { "table": "Personalization", "firstOnly": true },
      { "table": "Image", "firstOnly": false },
      { "table": "World", "firstOnly": true, "isParent": true },
      { "table": "MoodboardItem", "firstOnly": false }
    ]) as Moodboard | null;

    if (!moodboard) {
      return null;
    }

    moodboard.MoodboardItems = (moodboard.MoodboardItems || [])
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

    return moodboard;
  }

  getMoodboardWorldId(moodboardId: string): string | null {
    const relationship = this.crud.findFirst('Relationship', {
      parentTable: 'World',
      entityTable: 'Moodboard',
      entityId: moodboardId,
    });

    return relationship?.parentId || null;
  }

  saveMoodboard(moodboard: Moodboard, worldId: string | null, items: MoodboardItem[] = []): Moodboard {
    if (moodboard.id !== '') {
      moodboard = this.crud.update('Moodboard', moodboard.id, moodboard) as Moodboard;
    } else {
      moodboard = this.crud.create('Moodboard', moodboard) as Moodboard;
    }

    this.crud.deleteWhen('Relationship', {
      parentTable: 'World',
      entityTable: 'Moodboard',
      entityId: moodboard.id
    });

    if (worldId) {
      this.crud.create('Relationship', {
        parentTable: 'World',
        parentId: worldId,
        entityTable: 'Moodboard',
        entityId: moodboard.id
      });
    }

    items.forEach(item => this.saveMoodboardItem(item, moodboard.id));

    return moodboard;
  }

  saveMoodboardItem(item: MoodboardItem, moodboardId: string): MoodboardItem {
    if (item.id !== '') {
      item = this.crud.update('MoodboardItem', item.id, item) as MoodboardItem;
    } else {
      item = this.crud.create('MoodboardItem', item) as MoodboardItem;
    }

    this.crud.deleteWhen('Relationship', {
      parentTable: 'Moodboard',
      entityTable: 'MoodboardItem',
      entityId: item.id
    });

    this.crud.create('Relationship', {
      parentTable: 'Moodboard',
      parentId: moodboardId,
      entityTable: 'MoodboardItem',
      entityId: item.id
    });

    return item;
  }

  deleteMoodboardItem(itemId: string): void {
    this.crud.delete('MoodboardItem', itemId);
  }

  deleteMoodboard(id: string): void {
    this.crud.delete('Moodboard', id, true);
  }

  searchEntities(worldId: string | null | undefined, term: string): MoodboardEntitySearchResult[] {
    const normalizedTerm = term.trim().toLocaleLowerCase();
    const results: MoodboardEntitySearchResult[] = [];

    for (const def of this.searchableTables) {
      const rows = (normalizedTerm
        ? this.crud.searchInTable(def.table, normalizedTerm, [def.column])
        : this.crud.findAll(def.table, {}, [
            { table: 'Image', firstOnly: false },
            { table: 'Personalization', firstOnly: true },
            { table: 'World', firstOnly: true, isParent: true },
          ])
      ) as Array<Record<string, unknown>>;

      for (const row of rows) {
        const id = String(row['id'] || '');
        const label = String(row[def.column] || row['name'] || row['title'] || '').trim();

        if (!id || !label) {
          continue;
        }

        if (worldId && !this.entityBelongsToWorld(def.table, id, worldId, new Set<string>())) {
          continue;
        }

        const fullRow = normalizedTerm
          ? this.crud.findById(def.table, id, [
              { table: 'Image', firstOnly: false },
              { table: 'Personalization', firstOnly: true },
              { table: 'World', firstOnly: true, isParent: true },
            ])
          : row;

        results.push({
          table: def.table,
          id,
          label,
          subtitle: def.label,
          imagePath: this.getPreferredImagePath(fullRow?.['Images'] as Image[] | undefined),
          personalization: (fullRow?.['Personalization'] as Personalization | undefined) || null,
        });
      }
    }

    return results
      .filter((result, index, arr) => arr.findIndex(item => item.table === result.table && item.id === result.id) === index)
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(0, 60);
  }

  getEntity(table: string, id: string): MoodboardEntitySearchResult | null {
    const def = this.searchableTables.find(item => item.table === table);
    if (!def) {
      return null;
    }

    const row = this.crud.findById(table, id, [
      { table: 'Image', firstOnly: false },
      { table: 'Personalization', firstOnly: true },
      { table: 'World', firstOnly: true, isParent: true },
    ]);

    if (!row) {
      return null;
    }

    return {
      table,
      id,
      label: String(row[def.column] || row['name'] || row['title'] || id),
      subtitle: def.label,
      imagePath: this.getPreferredImagePath(row.Images),
      personalization: row.Personalization || null,
    };
  }

  private entityBelongsToWorld(table: string, id: string, worldId: string, visited: Set<string>): boolean {
    if (table === 'World') {
      return id === worldId;
    }

    const key = `${table}:${id}`;
    if (visited.has(key)) {
      return false;
    }
    visited.add(key);

    const directRelationship = this.crud.findFirst('Relationship', {
      parentTable: 'World',
      parentId: worldId,
      entityTable: table,
      entityId: id,
    });

    if (directRelationship) {
      return true;
    }

    const parentRelationships = this.crud.findAll('Relationship', {
      entityTable: table,
      entityId: id,
    }) as Array<{ parentTable: string; parentId: string }>;

    return parentRelationships.some(relationship =>
      this.entityBelongsToWorld(relationship.parentTable, relationship.parentId, worldId, visited)
    );
  }

  private getPreferredImagePath(images: Image[] | undefined | null): string | null {
    if (!images?.length) {
      return null;
    }

    return images.find(image => image.usageKey === 'profile')?.filePath
      || images.find(image => image.usageKey === 'fullbody')?.filePath
      || images[0]?.filePath
      || null;
  }
}
