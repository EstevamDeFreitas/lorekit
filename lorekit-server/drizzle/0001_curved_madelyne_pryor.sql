CREATE TABLE "app"."sync_resolution_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "resolution_key" text NOT NULL,
  "vault_id" uuid NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "winner_operation" text NOT NULL,
  "winner_payload" jsonb,
  "winner_modified_at" bigint NOT NULL,
  "winner_change_id" text NOT NULL,
  "loser_operation" text NOT NULL,
  "loser_payload" jsonb,
  "loser_modified_at" bigint NOT NULL,
  "loser_change_id" text NOT NULL,
  "resolved_by_device_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."sync_changes" ADD COLUMN "modified_at" bigint DEFAULT (extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."sync_changes" ADD COLUMN "change_id" text DEFAULT md5(random()::text || clock_timestamp()::text) NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."sync_records" ADD COLUMN "modified_at" bigint DEFAULT (extract(epoch from clock_timestamp()) * 1000)::bigint NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."sync_records" ADD COLUMN "change_id" text DEFAULT md5(random()::text || clock_timestamp()::text) NOT NULL;--> statement-breakpoint
UPDATE "app"."sync_changes"
SET "modified_at" = (extract(epoch from "created_at") * 1000)::bigint;--> statement-breakpoint
UPDATE "app"."sync_records"
SET "modified_at" = (extract(epoch from "updated_at") * 1000)::bigint;--> statement-breakpoint
WITH latest AS (
  SELECT DISTINCT ON ("vault_id", "entity_type", "entity_id")
    "vault_id", "entity_type", "entity_id", "modified_at", "change_id"
  FROM "app"."sync_changes"
  ORDER BY "vault_id", "entity_type", "entity_id", "sequence" DESC
)
UPDATE "app"."sync_records" AS records
SET
  "modified_at" = latest."modified_at",
  "change_id" = COALESCE(latest."change_id", records."change_id")
FROM latest
WHERE records."vault_id" = latest."vault_id"
  AND records."entity_type" = latest."entity_type"
  AND records."entity_id" = latest."entity_id";--> statement-breakpoint
ALTER TABLE "app"."sync_resolution_history" ADD CONSTRAINT "sync_resolution_history_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "app"."vaults"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."sync_resolution_history" ADD CONSTRAINT "sync_resolution_history_resolved_by_device_id_devices_id_fk" FOREIGN KEY ("resolved_by_device_id") REFERENCES "app"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sync_resolution_history_key_uidx" ON "app"."sync_resolution_history" USING btree ("vault_id","resolution_key");--> statement-breakpoint
CREATE INDEX "sync_resolution_history_vault_created_idx" ON "app"."sync_resolution_history" USING btree ("vault_id","created_at");--> statement-breakpoint
CREATE INDEX "sync_resolution_history_expires_idx" ON "app"."sync_resolution_history" USING btree ("expires_at");
