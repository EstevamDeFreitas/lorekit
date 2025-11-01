export type ColumnDef = { name: string; def: string };
export type TableDef = {
  name: string;
  columns: ColumnDef[];
  fks?: string[];
  indexes?: string[];
};

export const schema: TableDef[] = [
  {
    name: "World",
    columns: [
      { name: "id",          def: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: "name",        def: `"name" TEXT NOT NULL` },
      { name: "description", def: `"description" TEXT NOT NULL` },
      { name: "theme",       def: `"theme" TEXT` },
      { name: "concept",     def: `"concept" TEXT` },
    ]
  },
  {
    name: "Character",
    columns: [
      { name: "id",          def: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: "name",        def: `"name" TEXT NOT NULL` },
      { name: "description", def: `"description" TEXT NOT NULL` },
      { name: "personality", def: `"personality" TEXT NOT NULL` },
      { name: "concept",     def: `"concept" TEXT` }
    ]
  },
  {
    name: "LocationCategory",
    columns: [
      { name: "id",   def: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: "name", def: `"name" TEXT NOT NULL` },
    ]
  },
  {
    name: "Location",
    columns: [
      { name: "id",          def: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: "name",        def: `"name" TEXT NOT NULL` },
      { name: "description", def: `"description" TEXT NOT NULL` },
      { name: "concept",     def: `"concept" TEXT` }
    ]
  },
  {
    name: "Item",
    columns: [
      { name: "id",          def: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: "name",        def: `"name" TEXT NOT NULL` },
      { name: "description", def: `"description" TEXT NOT NULL` },
      { name: "concept",     def: `"concept" TEXT` },
    ]
  },
  {
    name: "Document",
    columns: [
      { name: "id",      def: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: "title",   def: `"title" TEXT NOT NULL` },
      { name: "content", def: `"content" TEXT NOT NULL` },
      { name: "type",    def: `"type" TEXT` },
    ]
  },
  {
    name: "Personalization",
    columns: [
      { name: "id",          def: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: "contentJson", def: `"contentJson" TEXT NOT NULL` }
    ]
  },
  {
    name: "Image",
    columns: [
      { name: "id",       def: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: "usageKey", def: `"usageKey" TEXT NOT NULL` },
      { name: "filePath", def: `"filePath" TEXT NOT NULL` },
    ]
  },
  {
    name:"Species",
    columns: [
      { name: "id",                         def: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: "name",                       def: `"name" TEXT NOT NULL` },
      { name: "description",                def: `"description" TEXT NOT NULL` },
      { name: "concept",                    def: `"concept" TEXT` },
      { name: "classification",             def: `"classification" TEXT` },
      { name: "diet",                       def: `"diet" TEXT` },
      { name: "averageHeight",              def: `"averageHeight" REAL` },
      { name: "averageLifespan",            def: `"averageLifespan" REAL` },
      { name: "averageWeight",              def: `"averageWeight" REAL` },
      { name: "physicalCharacteristics",    def: `"physicalCharacteristics" TEXT` },
      { name: "behavioralCharacteristics",  def: `"behavioralCharacteristics" TEXT` },
    ]
  },
  {
    name: "Relationship",
    columns: [
      { name: "id",          def: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: "parentTable", def: `"parentTable" TEXT NOT NULL` },
      { name: "parentId",    def: `"parentId" TEXT NOT NULL` },
      { name: "entityTable", def: `"entityTable" TEXT NOT NULL` },
      { name: "entityId",    def: `"entityId" TEXT NOT NULL` },
    ]
  }
];
