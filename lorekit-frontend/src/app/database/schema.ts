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
      `INSERT INTO "OrganizationType" (id, name) VALUES ('z06a5085-b7e2-4f5b-aca6-8b36764452f4', 'Comunidade')`,
    ]
  },
  {
    name: "Object",
    columns: [
      { name: "id",         def: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: "name",       def: `"name" TEXT NOT NULL` },
      { name: "concept",    def: `"concept" TEXT` },
      { name: "age",        def: `"age" TEXT` },
      { name: "properties", def: `"properties" TEXT` },
      { name: "history",    def: `"history" TEXT` },
    ]
  },
  {
    name: "ObjectType",
    columns: [
      { name: "id",   def: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: "name", def: `"name" TEXT NOT NULL` }
    ],
    insertCommands: [
      `INSERT INTO "ObjectType" (id, name) VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Veículo')`,
      `INSERT INTO "ObjectType" (id, name) VALUES ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'Artefato')`,
      `INSERT INTO "ObjectType" (id, name) VALUES ('c3d4e5f6-a7b8-9012-cdef-123456789012', 'Arma')`,
      `INSERT INTO "ObjectType" (id, name) VALUES ('d4e5f6a7-b8c9-0123-defa-234567890123', 'Nave')`,
      `INSERT INTO "ObjectType" (id, name) VALUES ('e5f6a7b8-c9d0-1234-efab-345678901234', 'Ferramenta')`,
      `INSERT INTO "ObjectType" (id, name) VALUES ('f6a7b8c9-d0e1-2345-fabc-456789012345', 'Equipamento')`,
    ]
  },
  {
    name: "Timeline",
    columns: [
      { name: "id",          def: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: "name",        def: `"name" TEXT NOT NULL` },
      { name: "concept",     def: `"concept" TEXT` },
      { name: "description", def: `"description" TEXT NOT NULL` },
    ]
  },
  {
    name: "GreatMark",
    columns: [
      { name: "id",          def: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: "name",        def: `"name" TEXT NOT NULL` },
      { name: "concept",     def: `"concept" TEXT` },
      { name: "description", def: `"description" TEXT NOT NULL` },
      { name: "sortOrder",   def: `"sortOrder" REAL NOT NULL DEFAULT 0` },
    ]
  },
  {
    name: "EventType",
    columns: [
      { name: "id",   def: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: "name", def: `"name" TEXT NOT NULL` },
    ]
  },
  {
    name: "Event",
    columns: [
      { name: "id",              def: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: "name",            def: `"name" TEXT NOT NULL` },
      { name: "concept",         def: `"concept" TEXT` },
      { name: "date",            def: `"date" TEXT` },
      { name: "description",     def: `"description" TEXT NOT NULL` },
      { name: "sortOrder",       def: `"sortOrder" REAL NOT NULL DEFAULT 0` },
      { name: "chronologyOrder", def: `"chronologyOrder" REAL NOT NULL DEFAULT 0` },
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
  },
  {
    name:"DynamicField",
    columns:[
      { name: "id",          def: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: "name",        def: `"name" TEXT NOT NULL` },
      { name: "entityTable", def: `"entityTable" TEXT NOT NULL` },
      { name: "options",   def: `"options" TEXT` },
      { name: "isEditorField",   def: `"isEditorField" INTEGER` },
    ]
  },
  {
    name:"DynamicFieldValue",
    columns:[
      { name: "id",          def: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: "value",       def: `"value" TEXT` },
    ]
  },
  {
    name:"UiFieldConfig",
    columns:[
      { name: "id",                def: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: "uiConfig",          def: `"uiConfig" TEXT NOT NULL` },
      { name: "entityTable",       def: `"entityTable" TEXT NOT NULL` },
      { name: "entityId",          def: `"entityId" TEXT` },
      { name: "parentEntityTable", def: `"parentEntityTable" TEXT` },
      { name: "parentEntityId",    def: `"parentEntityId" TEXT` },
    ],
    indexes: [
      `CREATE INDEX IF NOT EXISTS "idx_ui_field_config_entity" ON "UiFieldConfig" ("entityTable", "entityId")`,
      `CREATE INDEX IF NOT EXISTS "idx_ui_field_config_parent" ON "UiFieldConfig" ("entityTable", "parentEntityTable", "parentEntityId")`,
    ]
  },
  {
    name: "UiFieldTemplate",
    columns: [
      { name: "id",          def: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: "name",        def: `"name" TEXT NOT NULL` },
      { name: "entityTable", def: `"entityTable" TEXT NOT NULL` },
      { name: "uiConfig",    def: `"uiConfig" TEXT NOT NULL` },
    ],
    indexes: [
      `CREATE UNIQUE INDEX IF NOT EXISTS "idx_ui_field_template_name" ON "UiFieldTemplate" ("entityTable", "name")`,
    ]
  },

  /////////////////////////////////////// IRONPAW INTEGRATION ///////////////////////////////////////
  {
    name:"IRPWCharacterSheet",
    columns:[
      { name: "id",          def: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: "perceptions", def: `"perceptions" TEXT` },
      { name: "attributes", def: `"attributes" TEXT` },
      { name: "lifepoints", def: `"lifepoints" TEXT` },
      { name: "defensepoints", def: `"defensepoints" TEXT` },
      { name: "stress", def: `"stress" TEXT` },
      { name: "mana", def: `"mana" TEXT` },
      { name: "vigor", def: `"vigor" TEXT` },
      { name: "subspecialization", def: `"subspecialization" TEXT` },
      { name: "inventory", def: `"inventory" TEXT` },
      { name: "habilities", def: `"habilities" TEXT` },
      { name: "marks", def: `"marks" TEXT` },
      { name: "conditions", def: `"conditions" TEXT` },
    ]
  },
  {
    name:"IRPWSpecie",
    columns:[
      { name: "id",          def: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: "perceptions", def: `"perceptions" TEXT` },
      { name: "basehealth", def: `"basehealth" TEXT` },
      { name: "passive", def: `"passive" TEXT` },
      { name: "weakness", def: `"weakness" TEXT` },
    ]
  },
  {
    name:"IRPWItem",
    columns:[
      { name: "id",          def: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: "effects",          def: `"effects" TEXT` },
    ]
  },
  {
    name:"IRPWVocation",
    columns:[
      { name: "id",          def: `"id" TEXT NOT NULL PRIMARY KEY` },
      { name: "name",          def: `"name" TEXT` },
      { name: "description",          def: `"description" TEXT` },
      { name: "habilities",          def: `"habilities" TEXT` },
      { name: "passive",          def: `"passive" TEXT` },
      { name: "basehealth",          def: `"basehealth" TEXT` },
      { name: "basedefense",          def: `"basedefense" TEXT` },
      { name: "attributes",          def: `"attributes" TEXT` },
    ]
  },
  {
    name:"",
    columns:[
      { name: "id",          def: `"id" TEXT NOT NULL PRIMARY KEY` },
    ]
  },
];
