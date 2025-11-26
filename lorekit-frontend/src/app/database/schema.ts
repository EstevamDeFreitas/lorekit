export type ColumnDef = { name: string; def: string };
export type TableDef = {
  name: string;
  columns: ColumnDef[];
  fks?: string[];
  indexes?: string[];
  insertCommands?: string[];
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
    name:"Character",
    columns: [
      { name: "id",                         def: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: "name",                       def: `"name" TEXT NOT NULL` },
      { name: "description",                def: `"description" TEXT NOT NULL` },
      { name: "concept",                    def: `"concept" TEXT` },
      { name: "personality",        def: `"personality" TEXT` },
      { name: "background",           def: `"background" TEXT` },
      { name: "height",               def: `"height" REAL` },
      { name: "weight",               def: `"weight" REAL` },
      { name: "age",                  def: `"age" INTEGER` },
      { name: "occupation",           def: `"occupation" TEXT` },
      { name: "alignment",           def: `"alignment" TEXT` },
      { name: "objectives",   def: `"objectives" TEXT` },
      { name: "appearance",        def: `"appearance" TEXT` },
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
  },
  {
    name:"Culture",
    columns: [
      { name: "id",                         def: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: "name",                       def: `"name" TEXT NOT NULL` },
      { name: "description",                def: `"description" TEXT NOT NULL` },
      { name: "concept",                    def: `"concept" TEXT` },
      { name: "values",                     def: `"values" TEXT` },
      { name: "traditions",                 def: `"traditions" TEXT` },
      { name: "socialStructure",            def: `"socialStructure" TEXT` },
      { name: "beliefSystems",              def: `"beliefSystems" TEXT` },
      { name: "technologyLevel",            def: `"technologyLevel" TEXT` },
      { name: "culinaryPractices",          def: `"culinaryPractices" TEXT` },
      { name: "language",                   def: `"language" TEXT` },
    ]
  },
  {
    name:"GlobalParameter",
    columns: [
      { name: "key",   def: `"key" TEXT NOT NULL PRIMARY KEY` },
      { name: "value", def: `"value" TEXT NOT NULL` },
    ]
  },
  {
    name:"Organization",
    columns:[
      { name: "id",          def: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: "name",        def: `"name" TEXT NOT NULL` },
      { name: "description", def: `"description" TEXT NOT NULL` },
      { name: "concept",     def: `"concept" TEXT` },
    ]
  },
  {
    name:"OrganizationType",
    columns:[
      { name: "id",   def: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: "name", def: `"name" TEXT NOT NULL` }
    ],
    insertCommands: [
      `INSERT INTO "OrganizationType" (id, name) VALUES ('0f23ffcf-c1eb-471d-9856-f6cd0caa1d3b', 'Governo')`,
      `INSERT INTO "OrganizationType" (id, name) VALUES ('b0fed817-b417-482b-a189-50dd409ed6f9', 'Corporação')`,
      `INSERT INTO "OrganizationType" (id, name) VALUES ('12e35331-65ad-4cc6-ae45-5dc2a0d4cad8', 'Grupo Mercenário')`,
      `INSERT INTO "OrganizationType" (id, name) VALUES ('2d499cea-a835-406d-bb5e-6c1b5521cd45', 'Grupo Religioso')`,
      `INSERT INTO "OrganizationType" (id, name) VALUES ('b6544f6a-c36d-46d8-a467-80e22072c3dd', 'Grupo Clandestino')`,
      `INSERT INTO "OrganizationType" (id, name) VALUES ('d06a5085-b7e2-4f5b-aca6-8b36764452f4', 'Guilda')`,
      `INSERT INTO "OrganizationType" (id, name) VALUES ('d06a5085-b7e2-4f5b-aca6-8b36764452f4', 'Comunidade')`,
    ]
  },
  {
    name:"Link",
    columns:[
      { name: "id",          def: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: "fromTable", def: `"fromTable" TEXT NOT NULL` },
      { name: "fromId",    def: `"fromId" TEXT NOT NULL` },
      { name: "toTable", def: `"toTable" TEXT NOT NULL` },
      { name: "toId",    def: `"toId" TEXT NOT NULL` },
      { name: "name",        def: `"name" TEXT` },
      { name: "configJson",  def: `"configJson" TEXT` },
    ]
  }
];
