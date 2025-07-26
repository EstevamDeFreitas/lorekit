/*
  Warnings:

  - You are about to drop the column `acessLevel` on the `UserWorld` table. All the data in the column will be lost.
  - Added the required column `accessLevel` to the `UserWorld` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserWorld" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accessLevel" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    CONSTRAINT "UserWorld_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserWorld_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_UserWorld" ("id", "userId", "worldId") SELECT "id", "userId", "worldId" FROM "UserWorld";
DROP TABLE "UserWorld";
ALTER TABLE "new_UserWorld" RENAME TO "UserWorld";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
