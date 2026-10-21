import {
  bigserial,
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { StoryMechanics, StoryRollRecord, StoryEventType, StorySequence } from '../shared/ironpaw';

export const appSchema = pgSchema('app');

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export const users = appSchema.table(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    emailNormalized: text('email_normalized').notNull(),
    passwordHash: text('password_hash').notNull(),
    displayName: text('display_name'),
    isActive: boolean('is_active').notNull().default(true),
    tokenVersion: integer('token_version').notNull().default(0),
    disabledAt: timestamp('disabled_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [uniqueIndex('users_email_normalized_uidx').on(table.emailNormalized)],
);

export const devices = appSchema.table(
  'devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    platform: text('platform').notNull(),
    appVersion: text('app_version'),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('devices_user_id_idx').on(table.userId)],
);

export const refreshSessions = appSchema.table(
  'refresh_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    deviceId: uuid('device_id').references(() => devices.id, { onDelete: 'set null' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    replacedBySessionId: uuid('replaced_by_session_id'),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('refresh_sessions_token_hash_uidx').on(table.tokenHash),
    index('refresh_sessions_user_id_idx').on(table.userId),
    index('refresh_sessions_expires_at_idx').on(table.expiresAt),
  ],
);

export const vaults = appSchema.table(
  'vaults',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    ...timestamps,
  },
  (table) => [index('vaults_owner_user_id_idx').on(table.ownerUserId)],
);

export const vaultMembers = appSchema.table(
  'vault_members',
  {
    vaultId: uuid('vault_id')
      .notNull()
      .references(() => vaults.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('owner'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.vaultId, table.userId], name: 'vault_members_pk' }),
    index('vault_members_user_id_idx').on(table.userId),
  ],
);

export const syncRecords = appSchema.table(
  'sync_records',
  {
    vaultId: uuid('vault_id')
      .notNull()
      .references(() => vaults.id, { onDelete: 'cascade' }),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>(),
    version: bigint('version', { mode: 'bigint' }).notNull().default(sql`1`),
    schemaVersion: integer('schema_version').notNull().default(1),
    modifiedAt: bigint('modified_at', { mode: 'bigint' })
      .notNull()
      .default(sql`(extract(epoch from clock_timestamp()) * 1000)::bigint`),
    changeId: text('change_id').notNull().default(sql`md5(random()::text || clock_timestamp()::text)`),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      columns: [table.vaultId, table.entityType, table.entityId],
      name: 'sync_records_pk',
    }),
    index('sync_records_vault_updated_idx').on(table.vaultId, table.updatedAt),
  ],
);

export const syncChanges = appSchema.table(
  'sync_changes',
  {
    sequence: bigserial('sequence', { mode: 'bigint' }).primaryKey(),
    vaultId: uuid('vault_id')
      .notNull()
      .references(() => vaults.id, { onDelete: 'cascade' }),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    operation: text('operation').notNull(),
    recordVersion: bigint('record_version', { mode: 'bigint' }).notNull(),
    modifiedAt: bigint('modified_at', { mode: 'bigint' })
      .notNull()
      .default(sql`(extract(epoch from clock_timestamp()) * 1000)::bigint`),
    changeId: text('change_id').notNull().default(sql`md5(random()::text || clock_timestamp()::text)`),
    payload: jsonb('payload').$type<Record<string, unknown>>(),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    actorDeviceId: uuid('actor_device_id').references(() => devices.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('sync_changes_vault_sequence_idx').on(table.vaultId, table.sequence),
    index('sync_changes_record_idx').on(table.vaultId, table.entityType, table.entityId),
  ],
);

export const syncOperations = appSchema.table(
  'sync_operations',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    operationId: uuid('operation_id').notNull(),
    vaultId: uuid('vault_id')
      .notNull()
      .references(() => vaults.id, { onDelete: 'cascade' }),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    result: jsonb('result').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('sync_operations_idempotency_uidx').on(
      table.vaultId,
      table.deviceId,
      table.operationId,
    ),
    index('sync_operations_created_at_idx').on(table.createdAt),
  ],
);

export const syncResolutionHistory = appSchema.table(
  'sync_resolution_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    resolutionKey: text('resolution_key').notNull(),
    vaultId: uuid('vault_id').notNull().references(() => vaults.id, { onDelete: 'cascade' }),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    winnerOperation: text('winner_operation').notNull(),
    winnerPayload: jsonb('winner_payload').$type<Record<string, unknown>>(),
    winnerModifiedAt: bigint('winner_modified_at', { mode: 'bigint' }).notNull(),
    winnerChangeId: text('winner_change_id').notNull(),
    loserOperation: text('loser_operation').notNull(),
    loserPayload: jsonb('loser_payload').$type<Record<string, unknown>>(),
    loserModifiedAt: bigint('loser_modified_at', { mode: 'bigint' }).notNull(),
    loserChangeId: text('loser_change_id').notNull(),
    resolvedByDeviceId: uuid('resolved_by_device_id').references(() => devices.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex('sync_resolution_history_key_uidx').on(table.vaultId, table.resolutionKey),
    index('sync_resolution_history_vault_created_idx').on(table.vaultId, table.createdAt),
    index('sync_resolution_history_expires_idx').on(table.expiresAt),
  ],
);

export const blobs = appSchema.table(
  'blobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    vaultId: uuid('vault_id')
      .notNull()
      .references(() => vaults.id, { onDelete: 'cascade' }),
    storageKey: text('storage_key').notNull(),
    sha256: text('sha256').notNull(),
    originalName: text('original_name').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'bigint' }).notNull(),
    state: text('state').notNull().default('pending'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('blobs_storage_key_uidx').on(table.storageKey),
    index('blobs_vault_sha256_idx').on(table.vaultId, table.sha256),
  ],
);

export const auditEvents = appSchema.table(
  'audit_events',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: text('target_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('audit_events_actor_idx').on(table.actorUserId, table.createdAt),
    index('audit_events_action_idx').on(table.action, table.createdAt),
  ],
);

// Histórias have their own access boundary; membership never grants vault access.
export const stories = appSchema.table('stories', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  creationOperationId: uuid('creation_operation_id').notNull(),
  title: text('title').notNull(),
  sequence: bigint('sequence', { mode: 'bigint' }).notNull().default(sql`0`),
  ...timestamps,
}, table => [uniqueIndex('stories_creation_uidx').on(table.ownerUserId, table.creationOperationId), check('stories_sequence_nonnegative', sql`${table.sequence} >= 0`)]);

export const storyMembers = appSchema.table('story_members', {
  storyId: uuid('story_id').notNull().references(() => stories.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  role: text('role').$type<'owner' | 'participant'>().notNull(),
  readCursor: bigint('read_cursor', { mode: 'bigint' }).notNull().default(sql`0`),
  seen: jsonb('seen').$type<Array<[StorySequence, StorySequence]>>().notNull().default([]),
  sound: boolean('sound').notNull().default(true),
  external: boolean('external').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [primaryKey({ columns: [table.storyId, table.userId] }), index('story_members_user_idx').on(table.userId), check('story_members_role_valid', sql`${table.role} in ('owner', 'participant')`)]);

export const storyInvites = appSchema.table('story_invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  storyId: uuid('story_id').notNull().references(() => stories.id, { onDelete: 'cascade' }),
  issuerUserId: uuid('issuer_user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex('story_invites_token_uidx').on(table.tokenHash), index('story_invites_story_idx').on(table.storyId)]);

export const storyScenes = appSchema.table('story_scenes', {
  id: uuid('id').primaryKey().defaultRandom(),
  storyId: uuid('story_id').notNull().references(() => stories.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  position: bigint('position', { mode: 'bigint' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [unique('story_scenes_scope_uidx').on(table.storyId, table.id), uniqueIndex('story_scenes_position_uidx').on(table.storyId, table.position)]);

export const storyAssets = appSchema.table('story_assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  storyId: uuid('story_id').notNull().references(() => stories.id, { onDelete: 'cascade' }),
  uploaderUserId: uuid('uploader_user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  sha256: text('sha256').notNull(),
  state: text('state').$type<'pending' | 'ready'>().notNull().default('pending'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [unique('story_assets_scope_uidx').on(table.storyId, table.id), index('story_assets_pending_idx').on(table.state, table.expiresAt), check('story_assets_size_valid', sql`${table.sizeBytes} > 0 and ${table.sizeBytes} <= 10485760`)]);

export const storySpeakers = appSchema.table('story_speakers', {
  id: uuid('id').primaryKey().defaultRandom(),
  storyId: uuid('story_id').notNull().references(() => stories.id, { onDelete: 'cascade' }),
  sceneId: uuid('scene_id'),
  kind: text('kind').$type<'character' | 'npc' | 'incidental'>().notNull(),
  publisherUserId: uuid('publisher_user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  revision: integer('revision').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [unique('story_speakers_scope_uidx').on(table.storyId, table.id),
  foreignKey({ columns: [table.storyId, table.sceneId], foreignColumns: [storyScenes.storyId, storyScenes.id] }),
  check('story_speakers_kind_valid', sql`${table.kind} in ('character', 'npc', 'incidental')`),
  check('story_speakers_incidental_scene', sql`${table.kind} != 'incidental' or ${table.sceneId} is not null`),
]);

export const storySpeakerRevisions = appSchema.table('story_speaker_revisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  storyId: uuid('story_id').notNull(),
  speakerId: uuid('speaker_id').notNull(),
  number: integer('number').notNull(),
  name: text('name').notNull(), color: text('color').notNull(),
  portraitAssetId: uuid('portrait_asset_id'),
  mechanics: jsonb('mechanics').$type<StoryMechanics>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [unique('story_revisions_scope_uidx').on(table.storyId, table.speakerId, table.id), uniqueIndex('story_revisions_number_uidx').on(table.speakerId, table.number),
  foreignKey({ columns: [table.storyId, table.speakerId], foreignColumns: [storySpeakers.storyId, storySpeakers.id] }),
  foreignKey({ columns: [table.storyId, table.portraitAssetId], foreignColumns: [storyAssets.storyId, storyAssets.id] }),
]);

export const storyMessages = appSchema.table('story_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  storyId: uuid('story_id').notNull().references(() => stories.id, { onDelete: 'cascade' }),
  sceneId: uuid('scene_id').notNull(),
  speakerId: uuid('speaker_id').notNull(),
  revisionId: uuid('revision_id').notNull(),
  sequence: bigint('sequence', { mode: 'bigint' }).notNull(),
  operationId: uuid('operation_id').notNull(),
  authorUserId: uuid('author_user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  authorName: text('author_name').notNull(),
  text: text('text').notNull().default(''),
  roll: jsonb('roll').$type<StoryRollRecord>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  editedAt: timestamp('edited_at', { withTimezone: true }),
}, table => [uniqueIndex('story_messages_sequence_uidx').on(table.storyId, table.sequence), unique('story_messages_scope_uidx').on(table.storyId, table.id),
  index('story_messages_scene_idx').on(table.storyId, table.sceneId, table.sequence),
  foreignKey({ columns: [table.storyId, table.sceneId], foreignColumns: [storyScenes.storyId, storyScenes.id] }),
  foreignKey({ columns: [table.storyId, table.speakerId, table.revisionId], foreignColumns: [storySpeakerRevisions.storyId, storySpeakerRevisions.speakerId, storySpeakerRevisions.id] }),
]);

export const storyMessageAssets = appSchema.table('story_message_assets', {
  storyId: uuid('story_id').notNull(), messageId: uuid('message_id').notNull(), assetId: uuid('asset_id').notNull(), position: integer('position').notNull(),
}, table => [primaryKey({ columns: [table.messageId, table.assetId] }), uniqueIndex('story_message_assets_position_uidx').on(table.messageId, table.position),
  foreignKey({ columns: [table.storyId, table.messageId], foreignColumns: [storyMessages.storyId, storyMessages.id] }),
  foreignKey({ columns: [table.storyId, table.assetId], foreignColumns: [storyAssets.storyId, storyAssets.id] }),
]);

export const storyOperations = appSchema.table('story_operations', {
  storyId: uuid('story_id').notNull().references(() => stories.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  operationId: uuid('operation_id').notNull(), requestHash: text('request_hash').notNull(),
  result: jsonb('result').$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [primaryKey({ columns: [table.storyId, table.userId, table.operationId] })]);

export const storyEvents = appSchema.table('story_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  storyId: uuid('story_id').notNull().references(() => stories.id, { onDelete: 'cascade' }),
  sequence: bigint('sequence', { mode: 'bigint' }).notNull(),
  type: text('type').$type<StoryEventType>().notNull(), entityId: uuid('entity_id').notNull(),
  dispatchedAt: timestamp('dispatched_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex('story_events_sequence_uidx').on(table.storyId, table.sequence), index('story_events_pending_idx').on(table.dispatchedAt)]);

export const storyPushSubscriptions = appSchema.table('story_push_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(), userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sessionId: uuid('session_id').notNull().references(() => refreshSessions.id, { onDelete: 'cascade' }),
  installationId: uuid('installation_id').notNull(), endpoint: text('endpoint').notNull(),
  p256dh: text('p256dh').notNull(), auth: text('auth').notNull(), active: boolean('active').notNull().default(true),
  ...timestamps,
}, table => [uniqueIndex('story_push_endpoint_uidx').on(table.endpoint), index('story_push_account_idx').on(table.userId, table.installationId)]);

export const storyNotificationDeliveries = appSchema.table('story_notification_deliveries', {
  eventId: uuid('event_id').notNull().references(() => storyEvents.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  installationId: uuid('installation_id').notNull(), channel: text('channel').notNull(),
  state: text('state').$type<'pending' | 'sent' | 'presented' | 'skipped'>().notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  ...timestamps,
}, table => [primaryKey({ columns: [table.eventId, table.userId, table.installationId] }), index('story_deliveries_pending_idx').on(table.state, table.updatedAt)]);
