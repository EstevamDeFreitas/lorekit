CREATE SCHEMA IF NOT EXISTS "app";
--> statement-breakpoint
CREATE TABLE "app"."audit_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"metadata" jsonb,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."blobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vault_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"sha256" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"platform" text NOT NULL,
	"app_version" text,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."refresh_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"device_id" uuid,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"replaced_by_session_id" uuid,
	"last_used_at" timestamp with time zone,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."sync_changes" (
	"sequence" bigserial PRIMARY KEY NOT NULL,
	"vault_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"operation" text NOT NULL,
	"record_version" bigint NOT NULL,
	"payload" jsonb,
	"actor_user_id" uuid,
	"actor_device_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."sync_operations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"operation_id" uuid NOT NULL,
	"vault_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."sync_records" (
	"vault_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"payload" jsonb,
	"version" bigint DEFAULT 1 NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_records_pk" PRIMARY KEY("vault_id","entity_type","entity_id")
);
--> statement-breakpoint
CREATE TABLE "app"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"email_normalized" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"token_version" integer DEFAULT 0 NOT NULL,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."vault_members" (
	"vault_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'owner' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vault_members_pk" PRIMARY KEY("vault_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "app"."vaults" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."audit_events" ADD CONSTRAINT "audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."blobs" ADD CONSTRAINT "blobs_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "app"."vaults"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."devices" ADD CONSTRAINT "devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."refresh_sessions" ADD CONSTRAINT "refresh_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."refresh_sessions" ADD CONSTRAINT "refresh_sessions_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "app"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."sync_changes" ADD CONSTRAINT "sync_changes_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "app"."vaults"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."sync_changes" ADD CONSTRAINT "sync_changes_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."sync_changes" ADD CONSTRAINT "sync_changes_actor_device_id_devices_id_fk" FOREIGN KEY ("actor_device_id") REFERENCES "app"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."sync_operations" ADD CONSTRAINT "sync_operations_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "app"."vaults"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."sync_operations" ADD CONSTRAINT "sync_operations_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "app"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."sync_records" ADD CONSTRAINT "sync_records_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "app"."vaults"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."vault_members" ADD CONSTRAINT "vault_members_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "app"."vaults"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."vault_members" ADD CONSTRAINT "vault_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."vaults" ADD CONSTRAINT "vaults_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_actor_idx" ON "app"."audit_events" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_action_idx" ON "app"."audit_events" USING btree ("action","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "blobs_storage_key_uidx" ON "app"."blobs" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "blobs_vault_sha256_idx" ON "app"."blobs" USING btree ("vault_id","sha256");--> statement-breakpoint
CREATE INDEX "devices_user_id_idx" ON "app"."devices" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_sessions_token_hash_uidx" ON "app"."refresh_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "refresh_sessions_user_id_idx" ON "app"."refresh_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "refresh_sessions_expires_at_idx" ON "app"."refresh_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "sync_changes_vault_sequence_idx" ON "app"."sync_changes" USING btree ("vault_id","sequence");--> statement-breakpoint
CREATE INDEX "sync_changes_record_idx" ON "app"."sync_changes" USING btree ("vault_id","entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sync_operations_idempotency_uidx" ON "app"."sync_operations" USING btree ("vault_id","device_id","operation_id");--> statement-breakpoint
CREATE INDEX "sync_operations_created_at_idx" ON "app"."sync_operations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "sync_records_vault_updated_idx" ON "app"."sync_records" USING btree ("vault_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_normalized_uidx" ON "app"."users" USING btree ("email_normalized");--> statement-breakpoint
CREATE INDEX "vault_members_user_id_idx" ON "app"."vault_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "vaults_owner_user_id_idx" ON "app"."vaults" USING btree ("owner_user_id");