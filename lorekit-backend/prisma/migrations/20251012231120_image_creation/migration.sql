-- CreateTable
CREATE TABLE "Imagem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityTable" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "usageKey" TEXT NOT NULL,
    "filePath" TEXT NOT NULL
);
