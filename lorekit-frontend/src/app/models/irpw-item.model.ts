export const IRPW_ITEM_DEFINITION_VERSION = 1;
export const IRPW_INVENTORY_VERSION = 1;
export const IRPW_DEFENSEPOINTS_VERSION = 2;

export const IRPW_ITEM_CATEGORIES = [
  'common',
  'tool',
  'consumable',
  'weapon',
  'protection',
  'wearable',
] as const;
export type IrpwItemCategory = typeof IRPW_ITEM_CATEGORIES[number];

export const IRPW_ITEM_CATEGORY_LABEL: Record<IrpwItemCategory, string> = {
  common: 'Comum',
  tool: 'Ferramenta',
  consumable: 'Consumível',
  weapon: 'Arma',
  protection: 'Proteção',
  wearable: 'Vestível',
};

export const IRPW_RARITIES = ['common', 'uncommon', 'rare', 'unique'] as const;
export type IrpwItemRarity = typeof IRPW_RARITIES[number];
export const IRPW_RARITY_LABEL: Record<IrpwItemRarity, string> = {
  common: 'Comum',
  uncommon: 'Incomum',
  rare: 'Raro',
  unique: 'Único',
};

export const IRPW_EQUIPMENT_SLOTS = [
  'helmet', 'armor', 'underwear', 'pants', 'boots', 'gloves', 'accessory1', 'accessory2', 'accessory3', 'primary', 'secondary', 'reserve',
] as const;
export type IrpwEquipmentSlot = typeof IRPW_EQUIPMENT_SLOTS[number];
export const IRPW_EQUIPMENT_SLOT_LABEL: Record<IrpwEquipmentSlot, string> = {
  helmet: 'Capacete',
  armor: 'Armadura',
  pants: 'Calças',
  boots: 'Botas',
  gloves: 'Luvas',
  accessory1: 'Acessório 1',
  accessory2: 'Acessório 2',
  accessory3: 'Acessório 3',
  underwear: 'Roupa íntima inferior',
  primary: 'Arma primária',
  secondary: 'Arma secundária',
  reserve: 'Arco / arma reserva',
};

export type IrpwWeaponProperty = 'light' | 'heavy' | 'reach' | 'recoil' | 'technical';
export const IRPW_WEAPON_PROPERTY_LABEL: Record<IrpwWeaponProperty, string> = {
  light: 'Leve', heavy: 'Pesada', reach: 'Alcance', recoil: 'Recuo', technical: 'Técnica',
};
export type IrpwDamageDescriptor = 'cutting' | 'piercing' | 'blunt';
export const IRPW_DAMAGE_LABEL: Record<IrpwDamageDescriptor, string> = {
  cutting: 'Cortante', piercing: 'Perfurante', blunt: 'Concussivo',
};
export type IrpwProtectionTier = 'light' | 'medium' | 'heavy';
export const IRPW_PROTECTION_LABEL: Record<IrpwProtectionTier, string> = {
  light: 'Leve', medium: 'Média', heavy: 'Pesada',
};

export interface IrpwItemDefinition {
  version: 1;
  category: IrpwItemCategory;
  icon: string;
  /** Workspace asset reference used by the renderer. Portable packages replace this with asset-sha256:<hash>. */
  imageReference?: string | null;
  /** Stable content identity for an image. Kept beside the local reference so imports can compare canonically. */
  imageAssetSha256?: string | null;
  color?: string | null;
  backgroundColor?: string | null;
  tags: string[];
  rarity?: IrpwItemRarity | null;
  stackable: boolean;
  stackLimit: number;
  equipmentSlots: IrpwEquipmentSlot[];
  unique: boolean;
  uniqueBenefits: string[];
  uniqueCosts: string[];
  toolPurpose?: string;
  consumable?: { subtype: 'recovery' | 'offensive' | 'utility'; effect: string; actionCost: number };
  weapon?: {
    properties: IrpwWeaponProperty[];
    damageTypes: IrpwDamageDescriptor[];
    specialProperty: string;
    severity?: string;
    hands: 1 | 2;
  };
  protection?: { tier: IrpwProtectionTier; effects: string };
  narrativeEffect?: string;
}

export interface IrpwItemRecord {
  id: string;
  name: string;
  description: string;
  concept?: string | null;
  effects?: string | null;
  definitionJson?: string | null;
  portableId?: string | null;
  revision?: number | null;
  archived?: number | boolean | null;
}

export interface IrpwInventorySnapshot {
  name: string;
  description: string;
  definition: IrpwItemDefinition;
  icon?: string;
}

export interface IrpwInventoryEntry {
  instanceId: string;
  sourceItemId?: string | null;
  sourcePortableId?: string | null;
  sourceRevision?: number | null;
  snapshot: IrpwInventorySnapshot;
  quantity: number;
  notes: string;
  location: 'backpack' | 'equipment';
  slot?: IrpwEquipmentSlot | null;
}

export interface IrpwInventoryEnvelope {
  version: 1;
  entries: IrpwInventoryEntry[];
  backpackOrder: string[];
  equipment: Partial<Record<IrpwEquipmentSlot, string | null>>;
}

export interface IrpwDefensePointsEnvelope {
  version: 2;
  currentPoints: number | null;
  manualAdjustment: number;
  vocationContribution: number;
  protectionContribution: number;
}

export function createEmptyItemDefinition(category: IrpwItemCategory = 'common'): IrpwItemDefinition {
  return {
    version: 1, category, icon: 'fa-solid fa-box', imageReference: null, imageAssetSha256: null, color: null, backgroundColor: null, tags: [], rarity: null,
    stackable: true, stackLimit: 99, equipmentSlots: [], unique: false,
    uniqueBenefits: [], uniqueCosts: [],
    ...(category === 'weapon' ? { weapon: { properties: [], damageTypes: [], specialProperty: '', hands: 1 as const } } : {}),
    ...(category === 'protection' ? { protection: { tier: 'light' as const, effects: '' } } : {}),
  };
}

export function parseIrpwItemDefinition(raw: string | null | undefined): IrpwItemDefinition | null {
  if (!raw?.trim()) return null;
  try {
    const value = JSON.parse(raw) as Partial<IrpwItemDefinition>;
    if (value.version !== IRPW_ITEM_DEFINITION_VERSION || !isItemCategory(value.category)) return null;
    return normalizeIrpwItemDefinition(value);
  } catch {
    return null;
  }
}

export function normalizeIrpwItemDefinition(value: Partial<IrpwItemDefinition>): IrpwItemDefinition {
  const category = isItemCategory(value.category) ? value.category : 'common';
  const base = createEmptyItemDefinition(category);
  const weapon = value.weapon;
  const protection = value.protection;
  return {
    ...base, ...value, version: 1, category,
    icon: typeof value.icon === 'string' && value.icon.trim() ? value.icon.trim() : base.icon,
    imageReference: normalizeImageReference(value.imageReference),
    imageAssetSha256: normalizeAssetHash(value.imageAssetSha256),
    color: normalizeIrpwItemColor(value.color),
    backgroundColor: normalizeIrpwItemColor(value.backgroundColor),
    tags: normalizeStrings(value.tags),
    rarity: isRarity(value.rarity) ? value.rarity : null,
    stackable: value.stackable !== false,
    stackLimit: normalizeStackLimit(value.stackLimit),
    equipmentSlots: normalizeSlots(value.equipmentSlots),
    unique: value.unique === true,
    uniqueBenefits: normalizeStrings(value.uniqueBenefits),
    uniqueCosts: normalizeStrings(value.uniqueCosts),
    toolPurpose: typeof value.toolPurpose === 'string' ? value.toolPurpose.trim() : undefined,
    consumable: value.consumable && isConsumableSubtype(value.consumable.subtype)
      ? { subtype: value.consumable.subtype, effect: String(value.consumable.effect ?? ''), actionCost: 1 }
      : undefined,
    weapon: category === 'weapon' ? {
      properties: Array.isArray(weapon?.properties) ? weapon!.properties.filter(isWeaponProperty) : [],
      damageTypes: Array.isArray(weapon?.damageTypes) ? weapon!.damageTypes.filter(isDamageDescriptor) : [],
      specialProperty: String(weapon?.specialProperty ?? ''), severity: weapon?.severity ? String(weapon.severity) : undefined,
      hands: weapon?.hands === 2 ? 2 : 1,
    } : undefined,
    protection: category === 'protection' && protection && isProtectionTier(protection.tier)
      ? { tier: protection.tier, effects: String(protection.effects ?? '') } : undefined,
    narrativeEffect: typeof value.narrativeEffect === 'string' ? value.narrativeEffect.trim() : undefined,
  };
}

export function validateIrpwItemDefinition(definition: IrpwItemDefinition): string[] {
  const errors: string[] = [];
  if (!isItemCategory(definition.category)) errors.push('Categoria inválida.');
  if (definition.color !== null && definition.color !== undefined && !normalizeIrpwItemColor(definition.color)) errors.push('A cor do item deve ser um hexadecimal no formato #RRGGBB.');
  if (definition.backgroundColor !== null && definition.backgroundColor !== undefined && !normalizeIrpwItemColor(definition.backgroundColor)) errors.push('A cor do fundo deve ser um hexadecimal no formato #RRGGBB.');
  if (definition.imageReference && !isValidImageReference(definition.imageReference)) errors.push('A referência da imagem do item é inválida.');
  if (definition.imageAssetSha256 && !normalizeAssetHash(definition.imageAssetSha256)) errors.push('O hash da imagem do item é inválido.');
  if (!Number.isInteger(definition.stackLimit) || definition.stackLimit < 1) errors.push('O limite da pilha deve ser um inteiro positivo.');
  if (definition.category === 'weapon' && !definition.weapon) errors.push('Configure os dados da arma.');
  if (definition.category === 'protection' && !definition.protection) errors.push('Configure a categoria da proteção.');
  if (definition.category === 'consumable' && !definition.consumable) errors.push('Configure o subtipo do consumível.');
  if (definition.unique && definition.uniqueBenefits.length > 2 && definition.uniqueCosts.length === 0) {
    errors.push('Itens únicos com mais de dois benefícios precisam de custo, limitação ou consequência.');
  }
  return errors;
}

export function createEmptyInventory(): IrpwInventoryEnvelope {
  return { version: 1, entries: [], backpackOrder: [], equipment: {} };
}

export function parseIrpwInventory(raw: string | null | undefined): IrpwInventoryEnvelope | null {
  if (!raw?.trim()) return createEmptyInventory();
  try {
    const value = JSON.parse(raw) as Partial<IrpwInventoryEnvelope>;
    if (value.version !== IRPW_INVENTORY_VERSION || !Array.isArray(value.entries) || !Array.isArray(value.backpackOrder)) return null;
    const entries = value.entries.filter(isInventoryEntry).map(normalizeInventoryEntry);
    const ids = new Set(entries.map(entry => entry.instanceId));
    return {
      version: 1, entries,
      backpackOrder: value.backpackOrder.filter(id => typeof id === 'string' && ids.has(id)),
      equipment: normalizeEquipment(value.equipment, ids, entries),
    };
  } catch { return null; }
}

export function protectionContribution(inventory: IrpwInventoryEnvelope): number {
  const id = inventory.equipment.armor;
  const entry = id ? inventory.entries.find(candidate => candidate.instanceId === id) : undefined;
  const tier = entry?.snapshot.definition.protection?.tier;
  return tier === 'heavy' ? 3 : tier === 'medium' ? 2 : tier === 'light' ? 1 : 0;
}

export function calculateDefensePointsMax(value: Pick<IrpwDefensePointsEnvelope, 'vocationContribution' | 'protectionContribution' | 'manualAdjustment'>): number {
  return Math.max(0, value.vocationContribution + value.protectionContribution + value.manualAdjustment);
}

export function parseIrpwDefensePoints(raw: string | null | undefined, vocationContribution = 0, protection = 0): IrpwDefensePointsEnvelope {
  try {
    const value = raw ? JSON.parse(raw) as Partial<IrpwDefensePointsEnvelope> : {};
    if (value.version === IRPW_DEFENSEPOINTS_VERSION) {
      return { version: 2, currentPoints: normalizeNullableNumber(value.currentPoints), manualAdjustment: normalizeNumber(value.manualAdjustment), vocationContribution: normalizeNumber(value.vocationContribution), protectionContribution: normalizeNumber(value.protectionContribution) };
    }
    const current = normalizeNullableNumber(value.currentPoints);
    const manualAdjustment = current === null ? 0 : Math.max(0, current - vocationContribution - protection);
    return { version: 2, currentPoints: current, manualAdjustment, vocationContribution, protectionContribution: protection };
  } catch {
    return { version: 2, currentPoints: null, manualAdjustment: 0, vocationContribution, protectionContribution: protection };
  }
}

function normalizeInventoryEntry(value: IrpwInventoryEntry): IrpwInventoryEntry {
  const definition = normalizeIrpwItemDefinition(value.snapshot?.definition ?? {});
  return { ...value, snapshot: { name: String(value.snapshot?.name ?? ''), description: String(value.snapshot?.description ?? ''), definition, icon: value.snapshot?.icon }, quantity: Math.max(1, Math.trunc(Number(value.quantity) || 1)), notes: String(value.notes ?? ''), location: value.location === 'equipment' ? 'equipment' : 'backpack', slot: isSlot(value.slot) ? value.slot : null };
}
function isInventoryEntry(value: unknown): value is IrpwInventoryEntry { return !!value && typeof value === 'object' && typeof (value as IrpwInventoryEntry).instanceId === 'string' && !!(value as IrpwInventoryEntry).snapshot; }
function normalizeEquipment(value: Partial<Record<IrpwEquipmentSlot, string | null>> | undefined, ids: Set<string>, entries: IrpwInventoryEntry[]): Partial<Record<IrpwEquipmentSlot, string | null>> { const result: Partial<Record<IrpwEquipmentSlot, string | null>> = {}; for (const slot of IRPW_EQUIPMENT_SLOTS) { const id = value?.[slot]; const entry = typeof id === 'string' ? entries.find(item => item.instanceId === id) : undefined; if (entry && typeof id === 'string' && ids.has(id) && entry.location === 'equipment' && entry.slot === slot) result[slot] = id; } return result; }
export function normalizeIrpwItemColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const color = value.trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : null;
}

function normalizeStrings(values: unknown) { return Array.isArray(values) ? values.map(value => String(value).trim()).filter(Boolean) : []; }
function normalizeImageReference(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
function normalizeAssetHash(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const hash = value.trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(hash) ? hash : null;
}
function isValidImageReference(value: string): boolean {
  return /^lorekit-asset:\/\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    || /^asset-sha256:[a-f0-9]{64}$/i.test(value);
}
function normalizeSlots(values: unknown): IrpwEquipmentSlot[] { return Array.isArray(values) ? values.filter(isSlot) : []; }
function normalizeStackLimit(value: unknown): number { const n = Number(value); return Number.isInteger(n) && n > 0 ? n : 99; }
function normalizeNumber(value: unknown): number { const n = Number(value); return Number.isFinite(n) ? Math.trunc(n) : 0; }
function normalizeNullableNumber(value: unknown): number | null { if (value === null || value === undefined || value === '') return null; const n = Number(value); return Number.isFinite(n) ? Math.trunc(n) : null; }
function isItemCategory(value: unknown): value is IrpwItemCategory { return typeof value === 'string' && (IRPW_ITEM_CATEGORIES as readonly string[]).includes(value); }
function isRarity(value: unknown): value is IrpwItemRarity { return typeof value === 'string' && (IRPW_RARITIES as readonly string[]).includes(value); }
function isSlot(value: unknown): value is IrpwEquipmentSlot { return typeof value === 'string' && (IRPW_EQUIPMENT_SLOTS as readonly string[]).includes(value); }
function isWeaponProperty(value: unknown): value is IrpwWeaponProperty { return ['light', 'heavy', 'reach', 'recoil', 'technical'].includes(String(value)); }
function isDamageDescriptor(value: unknown): value is IrpwDamageDescriptor { return ['cutting', 'piercing', 'blunt'].includes(String(value)); }
function isProtectionTier(value: unknown): value is IrpwProtectionTier { return ['light', 'medium', 'heavy'].includes(String(value)); }
function isConsumableSubtype(value: unknown): value is 'recovery' | 'offensive' | 'utility' { return ['recovery', 'offensive', 'utility'].includes(String(value)); }
