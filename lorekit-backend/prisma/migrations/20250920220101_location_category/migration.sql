-- CreateTable
CREATE TABLE "LocationCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Location" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT,
    "categoryId" TEXT,
    "worldId" TEXT,
    "parentLocationId" TEXT,
    "relationOptions" TEXT,
    CONSTRAINT "Location_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "LocationCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Location_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Location_parentLocationId_fkey" FOREIGN KEY ("parentLocationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Location" ("description", "id", "name", "parentLocationId", "type", "worldId") SELECT "description", "id", "name", "parentLocationId", "type", "worldId" FROM "Location";
DROP TABLE "Location";
ALTER TABLE "new_Location" RENAME TO "Location";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
