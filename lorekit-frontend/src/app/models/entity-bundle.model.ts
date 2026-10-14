import type { DynamicFieldType } from './dynamicfields.model';
import type { UiConfigPayload } from './ui-field-config.model';

export const ENTITY_BUNDLE_FORMAT = 'lorekit-entity-bundle';
export const ENTITY_BUNDLE_VERSION = 2;
export const ENTITY_BUNDLE_LIMITS = Object.freeze({
  manifestBytes: 8 * 1024 * 1024,
  packageBytes: 100 * 1024 * 1024,
  records: 5000,
  depth: 64,
  assets: 2000,
  assetBytes: 25 * 1024 * 1024,
  totalAssetBytes: 256 * 1024 * 1024,
});

/** Package keys are deliberately different from database IDs. */
export type PortableEntityType = 'Character' | 'Personalization' | 'DynamicFieldValue' | 'Image' | 'Document' | 'IRPWCharacterSheet' | 'IRPWCurrency';
export interface PortableEntityRef { type: PortableEntityType; key: string; }
export type PortableScalar = string | number | null;
export interface PortableEntity {
  type: PortableEntityType;
  key: string;
  schemaVersion: 1;
  data: Record<string, PortableScalar>;
}
export interface PortableRelationship {
  kind: 'hierarchy' | 'owned';
  from: PortableEntityRef;
  to: PortableEntityRef;
}
export interface PortableDynamicField {
  key: string;
  entityTable: 'Character';
  name: string;
  fieldType: DynamicFieldType;
  isEditorField: boolean;
  options?: string;
  targetEntityTable?: string;
}
export interface PortableEntityLayout { ownerKey: string; layout: UiConfigPayload; }
export interface PortableExternalReference {
  key: string;
  ownerKey: string;
  targetType: string;
  kind: 'relationship' | 'dynamic-field' | 'mention';
  fieldKey?: string;
  label?: string;
}
export interface PortableAsset {
  key: string;
  path: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
}
export interface EntityBundleV2 {
  format: typeof ENTITY_BUNDLE_FORMAT;
  version: typeof ENTITY_BUNDLE_VERSION;
  exportedAt: string;
  root: PortableEntityRef;
  entities: PortableEntity[];
  relationships: PortableRelationship[];
  dynamicFields: PortableDynamicField[];
  layouts: PortableEntityLayout[];
  externalReferences: PortableExternalReference[];
  assets: PortableAsset[];
}

export type PortabilityIssueCode =
  | 'UNSUPPORTED_DEPENDENCY' | 'ASSET_CODEC_PENDING' | 'RICH_TEXT_CODEC_PENDING'
  | 'ENTITY_REFERENCE_CODEC_PENDING' | 'EXTERNAL_REFERENCE_UNRESOLVED'
  | 'DYNAMIC_FIELD_CONFLICT' | 'ASSET_EXECUTOR_PENDING';
export interface PortabilityIssue {
  code: PortabilityIssueCode;
  message: string;
  blocking: boolean;
}
