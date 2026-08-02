import { TestBed } from '@angular/core/testing';
import initSqlJs from 'sql.js/dist/sql-wasm.js';
import { ensureSchema } from '../database/database.helper';
import { DbProvider } from '../database/db-provider.service';
import { runLocalMigrations } from '../database/local-migrations';
import { AssetResolverService } from './asset-resolver.service';
import {
  findLegacyImagePaths,
  LegacyAssetMigrationService,
  normalizeLegacyImagePath,
  replaceLegacyImagePaths,
} from './legacy-asset-migration.service';

describe('legacy asset migration helpers', () => {
  const root = 'C:/Users/Author/AppData/Roaming/lorekitapp/images';
  const legacyPath = `${root}/moodboarditem/old-image.jpg`;
  const blobId = '36c6c098-731d-4f16-8e52-436802ba07eb';

  it('finds local image paths nested in synchronized JSON', () => {
    const value = JSON.stringify({
      kind: 'image',
      imagePath: legacyPath.replaceAll('/', '\\'),
      unrelated: 'C:/Documents/notes.txt',
    });

    expect(findLegacyImagePaths(value, root)).toEqual([legacyPath]);
  });

  it('replaces paths with canonical references while preserving the JSON shape', () => {
    const value = JSON.stringify({ imagePath: legacyPath, width: 260 });
    const replacements = new Map([[legacyPath.toLowerCase(), `lorekit-asset://${blobId}`]]);
    const migrated = JSON.parse(replaceLegacyImagePaths(value, root, replacements));

    expect(migrated).toEqual({ imagePath: `lorekit-asset://${blobId}`, width: 260 });
  });

  it('keeps files outside the Lorekit image directory untouched', () => {
    expect(normalizeLegacyImagePath('C:/Users/Author/Pictures/private.jpg', root)).toBeNull();
    expect(normalizeLegacyImagePath(`lorekit-asset://${blobId}`, root)).toBeNull();
  });
});

describe('LegacyAssetMigrationService', () => {
  const root = 'C:/Users/Author/AppData/Roaming/lorekitapp/images';
  const imagePath = `${root}/moodboarditem/old-image.jpg`;
  const imageId = '36c6c098-731d-4f16-8e52-436802ba07eb';
  const duplicateImageId = '87f802ad-3897-418d-9e2a-962eac35d1a2';
  let originalElectronApi: Window['electronAPI'];
  let SQL: Awaited<ReturnType<typeof initSqlJs>>;

  beforeAll(async () => {
    SQL = await initSqlJs({ locateFile: file => `assets/${file}` });
  });

  beforeEach(() => {
    originalElectronApi = window.electronAPI;
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    if (originalElectronApi) window.electronAPI = originalElectronApi;
    else delete window.electronAPI;
  });

  it('catalogs legacy files, queues one blob and rewrites embedded references', async () => {
    const db = new SQL.Database();
    ensureSchema(db);
    runLocalMigrations(db);
    db.run(
      `INSERT INTO "Image" ("id", "usageKey", "filePath") VALUES (?, 'profile', ?)`,
      [imageId, imagePath],
    );
    db.run(
      `INSERT INTO "Image" ("id", "usageKey", "filePath") VALUES (?, 'cover', ?)`,
      [duplicateImageId, imagePath],
    );
    db.run(
      `INSERT INTO "MoodboardItem" ("id", "configJson", "index") VALUES (?, ?, 0)`,
      ['e03e23aa-e07c-4ba6-87d4-273e44ccde96', JSON.stringify({ imagePath })],
    );

    const dbProvider = new DbProvider();
    dbProvider.setDb(db, async () => undefined);
    const registerLocal = jasmine.createSpy('registerLocal');
    TestBed.configureTestingModule({
      providers: [
        LegacyAssetMigrationService,
        { provide: DbProvider, useValue: dbProvider },
        { provide: AssetResolverService, useValue: { registerLocal } },
      ],
    });
    const readFile = jasmine.createSpy('readFile').and.resolveTo(new Uint8Array([1, 2, 3, 4]));
    window.electronAPI = {
      getImagePath: async () => root,
      readFile,
    };

    const report = await TestBed.inject(LegacyAssetMigrationService).migrateForSync();
    const image = db.exec(`SELECT "blobId", "mimeType", "sha256" FROM "Image" WHERE "id" = '${imageId}'`)[0].values[0];
    const configJson = String(db.exec(`SELECT "configJson" FROM "MoodboardItem"`)[0].values[0][0]);

    const duplicate = db.exec(`SELECT "blobId" FROM "Image" WHERE "id" = '${duplicateImageId}'`)[0].values[0];
    expect(report).toEqual({ migratedImages: 2, migratedReferences: 1, missingFiles: 0 });
    expect(image[0]).toBe(imageId);
    expect(duplicate[0]).toBe(imageId);
    expect(image[1]).toBe('image/jpeg');
    expect(String(image[2])).toHaveSize(64);
    expect(JSON.parse(configJson).imagePath).toBe(`lorekit-asset://${imageId}`);
    expect(Number(db.exec(`SELECT COUNT(*) FROM "_BlobOutbox"`)[0].values[0][0])).toBe(1);
    expect(readFile).toHaveBeenCalledTimes(1);
    expect(registerLocal).toHaveBeenCalledWith(imageId, imagePath);

    await dbProvider.flushPendingWrites();
  });
});
