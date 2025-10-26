-- CreateTable
CREATE TABLE IF NOT EXISTS "World" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "theme" TEXT,
    "concept" TEXT
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Character" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "personality" TEXT NOT NULL,
    "concept" TEXT,
    "worldId" TEXT
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Location" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT,
    "concept" TEXT,
    "categoryId" TEXT,
    "worldId" TEXT,
    CONSTRAINT "Location_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "LocationCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Location_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LocationCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "concept" TEXT
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Personalization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentJson" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Imagem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usageKey" TEXT NOT NULL,
    "filePath" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "Relationship" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parentTable" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "entityTable" TEXT NOT NULL,
    "entityId" TEXT NOT NULL
);
