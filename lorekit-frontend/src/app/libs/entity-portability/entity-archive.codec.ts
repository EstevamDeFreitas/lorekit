import { ENTITY_BUNDLE_LIMITS, EntityBundleV2 } from '../../models/entity-bundle.model';
import { parseEntityBundleManifest, validateEntityBundle } from './entity-bundle.validator';

export interface EntityArchive { manifest: EntityBundleV2; assets: ReadonlyMap<string, Uint8Array>; }
const encoder = new TextEncoder(); const decoder = new TextDecoder('utf-8', { fatal: true });

export async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
export function validateRaster(bytes: Uint8Array, mime: string): void {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  const valid = mime === 'image/png' ? bytes.length >= 24 && [137, 80, 78, 71, 13, 10, 26, 10].every((x, i) => bytes[i] === x)
    : mime === 'image/jpeg' ? bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : mime === 'image/webp' ? bytes.length >= 20 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP'
        : mime === 'image/gif' ? bytes.length >= 13 && /^GIF8[79]a$/.test(ascii(0, 6))
          : mime === 'image/avif' ? bytes.length >= 24 && ascii(4, 8) === 'ftyp' && /avif|avis/.test(ascii(8, Math.min(64, bytes.length))) : false;
  if (!valid) throw new Error('Bytes da imagem não correspondem ao formato permitido.');
}
export async function verifyArchive(archive: EntityArchive): Promise<void> {
  const manifest = validateEntityBundle(archive.manifest);
  if (archive.assets.size !== manifest.assets.length) throw new Error('Arquivos extras ou ausentes no pacote.');
  for (const asset of manifest.assets) {
    const bytes = archive.assets.get(asset.key);
    if (!bytes || bytes.byteLength !== asset.sizeBytes || await sha256(bytes) !== asset.sha256) throw new Error('Arquivo de imagem ausente ou corrompido.');
    validateRaster(bytes, asset.mimeType);
  }
}

/** ZIP STORE only: image payloads are already compressed; never inflate untrusted bytes. */
export async function encodeEntityArchive(archive: EntityArchive): Promise<Uint8Array> {
  await verifyArchive(archive);
  const manifestBytes = encoder.encode(JSON.stringify(archive.manifest));
  if (manifestBytes.length > ENTITY_BUNDLE_LIMITS.manifestBytes) throw new Error('Manifest excede 8 MiB.');
  return encodeStoredZip(new Map([['manifest.json', manifestBytes], ...archive.manifest.assets.map(asset => [asset.path, archive.assets.get(asset.key)!] as [string, Uint8Array])]));
}
export async function decodeEntityArchive(bytes: Uint8Array): Promise<EntityArchive> {
  if (bytes[0] === 123 || bytes[0] === 91 || (bytes.length > 7 && String.fromCharCode(...bytes.subarray(0, 7)) === 'LOREKIT')) throw new Error('Pacotes de entidade v1 e backups integrais não são aceitos neste fluxo v2.');
  const files = decodeStoredZip(bytes);
  const manifestBytes = files.get('manifest.json');
  if (!manifestBytes || manifestBytes.length > ENTITY_BUNDLE_LIMITS.manifestBytes) throw new Error('Manifest ausente ou acima do limite.');
  const manifest = parseEntityBundleManifest(decoder.decode(manifestBytes));
  const paths = new Set(['manifest.json', ...manifest.assets.map(asset => asset.path)]);
  if (files.size !== paths.size || [...files.keys()].some(path => !paths.has(path))) throw new Error('Arquivo não declarado no manifest.');
  const assets = new Map(manifest.assets.map(asset => [asset.key, files.get(asset.path)!]));
  const archive = { manifest, assets }; await verifyArchive(archive); return archive;
}

export function encodeStoredZip(files: ReadonlyMap<string, Uint8Array>): Uint8Array {
  const entries = [...files].map(([path, data]) => ({ path: encoder.encode(path), data, crc: crc32(data) }));
  let offset = 0; const localSizes = entries.map(entry => 30 + entry.path.length + entry.data.length);
  const centralOffset = localSizes.reduce((sum, size) => sum + size, 0);
  const centralSize = entries.reduce((sum, entry) => sum + 46 + entry.path.length, 0);
  const total = centralOffset + centralSize + 22;
  if (total > ENTITY_BUNDLE_LIMITS.packageBytes) throw new Error('O pacote excede 100 MiB.');
  const output = new Uint8Array(total); const view = new DataView(output.buffer);
  let central = centralOffset;
  for (const entry of entries) {
    view.setUint32(offset, 0x04034b50, true); view.setUint16(offset + 4, 20, true); view.setUint16(offset + 6, 0x800, true);
    view.setUint32(offset + 14, entry.crc, true); view.setUint32(offset + 18, entry.data.length, true); view.setUint32(offset + 22, entry.data.length, true); view.setUint16(offset + 26, entry.path.length, true);
    output.set(entry.path, offset + 30); output.set(entry.data, offset + 30 + entry.path.length);
    view.setUint32(central, 0x02014b50, true); view.setUint16(central + 4, 20, true); view.setUint16(central + 6, 20, true); view.setUint16(central + 8, 0x800, true);
    view.setUint32(central + 16, entry.crc, true); view.setUint32(central + 20, entry.data.length, true); view.setUint32(central + 24, entry.data.length, true); view.setUint16(central + 28, entry.path.length, true); view.setUint32(central + 42, offset, true);
    output.set(entry.path, central + 46); central += 46 + entry.path.length; offset += 30 + entry.path.length + entry.data.length;
  }
  view.setUint32(central, 0x06054b50, true); view.setUint16(central + 8, entries.length, true); view.setUint16(central + 10, entries.length, true);
  view.setUint32(central + 12, centralSize, true); view.setUint32(central + 16, centralOffset, true);
  return output;
}

export function decodeStoredZip(bytes: Uint8Array): Map<string, Uint8Array> {
  if (bytes.length < 22 || bytes.length > ENTITY_BUNDLE_LIMITS.packageBytes) throw new Error('Pacote inválido ou acima de 100 MiB.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); const end = bytes.length - 22;
  const u16 = (at: number) => view.getUint16(at, true); const u32 = (at: number) => view.getUint32(at, true);
  if (u32(end) !== 0x06054b50 || u16(end + 4) || u16(end + 6) || u16(end + 20) || u16(end + 8) !== u16(end + 10)) throw new Error('ZIP inválido, dividido ou com comentário.');
  const count = u16(end + 10); const centralSize = u32(end + 12); const centralOffset = u32(end + 16);
  if (!count || count > ENTITY_BUNDLE_LIMITS.assets + 1 || centralOffset + centralSize !== end) throw new Error('Diretório ZIP inválido.');
  const files = new Map<string, Uint8Array>(); let central = centralOffset; let expectedLocal = 0; let total = 0;
  for (let i = 0; i < count; i++) {
    if (central + 46 > end || u32(central) !== 0x02014b50) throw new Error('Cabeçalho ZIP inválido.');
    const flags = u16(central + 8); const method = u16(central + 10); const crc = u32(central + 16);
    const compressed = u32(central + 20); const size = u32(central + 24); const nameLength = u16(central + 28);
    const extra = u16(central + 30); const comment = u16(central + 32); const local = u32(central + 42);
    const attributes = u32(central + 38);
    if (method !== 0 || compressed !== size || flags !== 0x800 || extra || comment || u16(central + 34) || attributes || local !== expectedLocal || central + 46 + nameLength > end) throw new Error('Use um pacote v2 original (ZIP STORE, sem links, criptografia ou compressão).');
    const path = decoder.decode(bytes.subarray(central + 46, central + 46 + nameLength));
    if (!/^(manifest\.json|assets\/[\w-]{1,128})$/.test(path) || files.has(path)) throw new Error('Caminho ZIP não permitido ou duplicado.');
    const max = path === 'manifest.json' ? ENTITY_BUNDLE_LIMITS.manifestBytes : ENTITY_BUNDLE_LIMITS.assetBytes;
    if (size > max || (total += size) > ENTITY_BUNDLE_LIMITS.totalAssetBytes + ENTITY_BUNDLE_LIMITS.manifestBytes) throw new Error('Arquivos ZIP excedem os limites.');
    if (local + 30 + nameLength + size > centralOffset || u32(local) !== 0x04034b50 || u16(local + 6) !== flags || u16(local + 8) !== method || u32(local + 14) !== crc || u32(local + 18) !== size || u32(local + 22) !== size || u16(local + 26) !== nameLength || u16(local + 28)) throw new Error('Cabeçalhos ZIP inconsistentes.');
    if (decoder.decode(bytes.subarray(local + 30, local + 30 + nameLength)) !== path) throw new Error('Nome ZIP inconsistente.');
    const data = bytes.subarray(local + 30 + nameLength, local + 30 + nameLength + size);
    if (crc32(data) !== crc) throw new Error('CRC do arquivo ZIP inválido.');
    files.set(path, data); expectedLocal = local + 30 + nameLength + size; central += 46 + nameLength;
  }
  if (central !== end || expectedLocal !== centralOffset) throw new Error('Conteúdo ZIP extra ou truncado.');
  return files;
}
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, n) => { let crc = n; for (let bit = 0; bit < 8; bit++) crc = (crc & 1) ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1; return crc >>> 0; });
function crc32(bytes: Uint8Array): number { let crc = 0xffffffff; for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }
