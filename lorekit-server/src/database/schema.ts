import {
  bigserial,
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

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
