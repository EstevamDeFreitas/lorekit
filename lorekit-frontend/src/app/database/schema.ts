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
