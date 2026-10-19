CREATE TABLE "app"."stories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"creation_operation_id" uuid NOT NULL,
	"title" text NOT NULL,
	"sequence" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stories_sequence_nonnegative" CHECK ("app"."stories"."sequence" >= 0)
);
--> statement-breakpoint
CREATE TABLE "app"."story_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"uploader_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "story_assets_scope_uidx" UNIQUE("story_id","id"),
	CONSTRAINT "story_assets_size_valid" CHECK ("app"."story_assets"."size_bytes" > 0 and "app"."story_assets"."size_bytes" <= 10485760)
);
--> statement-breakpoint
CREATE TABLE "app"."story_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"sequence" bigint NOT NULL,
	"type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"dispatched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."story_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"issuer_user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."story_members" (
	"story_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"read_cursor" bigint DEFAULT 0 NOT NULL,
	"seen" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sound" boolean DEFAULT true NOT NULL,
	"external" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "story_members_story_id_user_id_pk" PRIMARY KEY("story_id","user_id"),
	CONSTRAINT "story_members_role_valid" CHECK ("app"."story_members"."role" in ('owner', 'participant'))
);
--> statement-breakpoint
CREATE TABLE "app"."story_message_assets" (
	"story_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "story_message_assets_message_id_asset_id_pk" PRIMARY KEY("message_id","asset_id")
);
--> statement-breakpoint
CREATE TABLE "app"."story_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"scene_id" uuid NOT NULL,
	"speaker_id" uuid NOT NULL,
	"revision_id" uuid NOT NULL,
	"sequence" bigint NOT NULL,
	"operation_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"author_name" text NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"roll" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "story_messages_scope_uidx" UNIQUE("story_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."story_notification_deliveries" (
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"installation_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "story_notification_deliveries_event_id_user_id_installation_id_pk" PRIMARY KEY("event_id","user_id","installation_id")
);
--> statement-breakpoint
CREATE TABLE "app"."story_operations" (
	"story_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"operation_id" uuid NOT NULL,
	"request_hash" text NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "story_operations_story_id_user_id_operation_id_pk" PRIMARY KEY("story_id","user_id","operation_id")
);
--> statement-breakpoint
CREATE TABLE "app"."story_push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"installation_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."story_scenes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"title" text NOT NULL,
	"position" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "story_scenes_scope_uidx" UNIQUE("story_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."story_speaker_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"speaker_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"portrait_asset_id" uuid,
	"mechanics" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "story_revisions_scope_uidx" UNIQUE("story_id","speaker_id","id")
);
--> statement-breakpoint
CREATE TABLE "app"."story_speakers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"scene_id" uuid,
	"kind" text NOT NULL,
	"publisher_user_id" uuid NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "story_speakers_scope_uidx" UNIQUE("story_id","id"),
	CONSTRAINT "story_speakers_kind_valid" CHECK ("app"."story_speakers"."kind" in ('character', 'npc', 'incidental')),
	CONSTRAINT "story_speakers_incidental_scene" CHECK ("app"."story_speakers"."kind" != 'incidental' or "app"."story_speakers"."scene_id" is not null)
);
--> statement-breakpoint
ALTER TABLE "app"."stories" ADD CONSTRAINT "stories_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."story_assets" ADD CONSTRAINT "story_assets_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "app"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."story_assets" ADD CONSTRAINT "story_assets_uploader_user_id_users_id_fk" FOREIGN KEY ("uploader_user_id") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."story_events" ADD CONSTRAINT "story_events_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "app"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."story_invites" ADD CONSTRAINT "story_invites_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "app"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."story_invites" ADD CONSTRAINT "story_invites_issuer_user_id_users_id_fk" FOREIGN KEY ("issuer_user_id") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."story_members" ADD CONSTRAINT "story_members_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "app"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."story_members" ADD CONSTRAINT "story_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."story_message_assets" ADD CONSTRAINT "story_message_assets_story_id_message_id_story_messages_story_id_id_fk" FOREIGN KEY ("story_id","message_id") REFERENCES "app"."story_messages"("story_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."story_message_assets" ADD CONSTRAINT "story_message_assets_story_id_asset_id_story_assets_story_id_id_fk" FOREIGN KEY ("story_id","asset_id") REFERENCES "app"."story_assets"("story_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."story_messages" ADD CONSTRAINT "story_messages_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "app"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."story_messages" ADD CONSTRAINT "story_messages_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."story_messages" ADD CONSTRAINT "story_messages_story_id_scene_id_story_scenes_story_id_id_fk" FOREIGN KEY ("story_id","scene_id") REFERENCES "app"."story_scenes"("story_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."story_messages" ADD CONSTRAINT "story_messages_story_id_speaker_id_revision_id_story_speaker_revisions_story_id_speaker_id_id_fk" FOREIGN KEY ("story_id","speaker_id","revision_id") REFERENCES "app"."story_speaker_revisions"("story_id","speaker_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."story_notification_deliveries" ADD CONSTRAINT "story_notification_deliveries_event_id_story_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "app"."story_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."story_notification_deliveries" ADD CONSTRAINT "story_notification_deliveries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."story_operations" ADD CONSTRAINT "story_operations_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "app"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."story_operations" ADD CONSTRAINT "story_operations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."story_push_subscriptions" ADD CONSTRAINT "story_push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."story_scenes" ADD CONSTRAINT "story_scenes_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "app"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."story_speaker_revisions" ADD CONSTRAINT "story_speaker_revisions_story_id_speaker_id_story_speakers_story_id_id_fk" FOREIGN KEY ("story_id","speaker_id") REFERENCES "app"."story_speakers"("story_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."story_speaker_revisions" ADD CONSTRAINT "story_speaker_revisions_story_id_portrait_asset_id_story_assets_story_id_id_fk" FOREIGN KEY ("story_id","portrait_asset_id") REFERENCES "app"."story_assets"("story_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."story_speakers" ADD CONSTRAINT "story_speakers_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "app"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."story_speakers" ADD CONSTRAINT "story_speakers_publisher_user_id_users_id_fk" FOREIGN KEY ("publisher_user_id") REFERENCES "app"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."story_speakers" ADD CONSTRAINT "story_speakers_story_id_scene_id_story_scenes_story_id_id_fk" FOREIGN KEY ("story_id","scene_id") REFERENCES "app"."story_scenes"("story_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "stories_creation_uidx" ON "app"."stories" USING btree ("owner_user_id","creation_operation_id");--> statement-breakpoint
CREATE INDEX "story_assets_pending_idx" ON "app"."story_assets" USING btree ("state","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "story_events_sequence_uidx" ON "app"."story_events" USING btree ("story_id","sequence");--> statement-breakpoint
CREATE INDEX "story_events_pending_idx" ON "app"."story_events" USING btree ("dispatched_at");--> statement-breakpoint
CREATE UNIQUE INDEX "story_invites_token_uidx" ON "app"."story_invites" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "story_invites_story_idx" ON "app"."story_invites" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX "story_members_user_idx" ON "app"."story_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "story_message_assets_position_uidx" ON "app"."story_message_assets" USING btree ("message_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "story_messages_sequence_uidx" ON "app"."story_messages" USING btree ("story_id","sequence");--> statement-breakpoint
CREATE INDEX "story_messages_scene_idx" ON "app"."story_messages" USING btree ("story_id","scene_id","sequence");--> statement-breakpoint
CREATE INDEX "story_deliveries_pending_idx" ON "app"."story_notification_deliveries" USING btree ("state","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "story_push_endpoint_uidx" ON "app"."story_push_subscriptions" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "story_push_account_idx" ON "app"."story_push_subscriptions" USING btree ("user_id","installation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "story_scenes_position_uidx" ON "app"."story_scenes" USING btree ("story_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "story_revisions_number_uidx" ON "app"."story_speaker_revisions" USING btree ("speaker_id","number");