/*
  Warnings:

  - You are about to drop the column `worldId` on the `Document` table. All the data in the column will be lost.
  - Added the required column `entityId` to the `Document` table without a default value. This is not possible if the table is not empty.
  - Added the required column `entityTable` to the `Document` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT,
    "entityTable" TEXT NOT NULL,
    "entityId" TEXT NOT NULL
);
INSERT INTO "new_Document" ("content", "id", "title", "type") SELECT "content", "id", "title", "type" FROM "Document";
DROP TABLE "Document";
ALTER TABLE "new_Document" RENAME TO "Document";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
