-- CreateTable
CREATE TABLE "Personalization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityTable" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "contentJson" TEXT NOT NULL
);
