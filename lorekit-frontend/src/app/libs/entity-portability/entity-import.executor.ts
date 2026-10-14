import { EntityArchive, sha256, verifyArchive } from './entity-archive.codec';
import { EntityImportPlan, PlannedImportRow } from './entity-import.planner';
import { canonicalJson } from './entity-portability.registry';

export interface EntityImportHost {
  identity: object;
  guard(): void;
  fresh(plan: EntityImportPlan): void;
  receipt(operationId: string): { rootId: string; digest: string } | null;
  rootExists(rootId: string): boolean;
  journal(operationId: string, state: 'pending' | 'committed', ids: string[]): void;
  clearJournal(operationId: string): void;
  persist(): Promise<void>;
  stage(asset: EntityArchive['manifest']['assets'][number], bytes: Uint8Array, blobId: string, operationId: string): Promise<{ localPath: string | null }>;
  cleanup(blobId: string): Promise<void>;
  transaction(operation: () => void): Promise<void>;
  insert(row: PlannedImportRow): void;
  saveReceipt(operationId: string, rootId: string, digest: string): void;
}
const tails = new WeakMap<object, Promise<unknown>>();

export function applyEntityImport(plan: EntityImportPlan, archive: EntityArchive, host: EntityImportHost): Promise<string> {
  const previous = tails.get(host.identity) || Promise.resolve();
  const result = previous.catch(() => undefined).then(() => apply(plan, archive, host));
  tails.set(host.identity, result); return result;
}

async function apply(plan: EntityImportPlan, archive: EntityArchive, host: EntityImportHost): Promise<string> {
  host.guard();
  if (plan.issues.some(issue => issue.blocking)) throw new Error('A prévia ainda contém conflitos ou referências sem resolução.');
  if (canonicalJson(plan.bundle) !== canonicalJson(archive.manifest)) throw new Error('O pacote mudou desde a prévia.');
  await verifyArchive(archive); host.guard();
  const digest = await sha256(new TextEncoder().encode(canonicalJson(plan)));
  const receipt = host.receipt(plan.operationId);
  if (receipt) {
    if (receipt.digest !== digest || !host.rootExists(receipt.rootId)) throw new Error('Operação já aplicada com outro conteúdo ou personagem removido.');
    await host.persist(); host.clearJournal(plan.operationId); await host.persist(); return receipt.rootId;
  }
  host.fresh(plan);
  const staged = new Map<string, { localPath: string | null }>();
  let committed = false;
  try {
    host.journal(plan.operationId, 'pending', plan.assets.map(asset => asset.blobId)); await host.persist();
    for (const entry of plan.assets) {
      host.guard(); const metadata = archive.manifest.assets.find(asset => asset.key === entry.key)!;
      staged.set(entry.blobId, await host.stage(metadata, archive.assets.get(entry.key)!, entry.blobId, plan.operationId));
    }
    host.guard(); host.fresh(plan);
    await host.transaction(() => {
      host.guard(); host.fresh(plan);
      for (const row of plan.rows) {
        let data = row.data;
        if (row.table === 'Image') {
          const asset = plan.assets.find(asset => asset.blobId === row.data['blobId'])!;
          const metadata = archive.manifest.assets.find(entry => entry.key === asset.key)!;
          data = { ...data, filePath: staged.get(asset.blobId)?.localPath || `lorekit-asset://${asset.blobId}`, mimeType: metadata.mimeType, sha256: metadata.sha256 };
        }
        host.insert({ ...row, data });
      }
      host.saveReceipt(plan.operationId, plan.rootId, digest);
      host.journal(plan.operationId, 'committed', plan.assets.map(asset => asset.blobId));
    });
    committed = true;
    await host.persist(); host.clearJournal(plan.operationId); await host.persist(); return plan.rootId;
  } catch (error) {
    if (!committed) {
      let cleaned = true;
      for (const asset of plan.assets) { try { await host.cleanup(asset.blobId); } catch { cleaned = false; } }
      if (cleaned) host.clearJournal(plan.operationId);
      await host.persist().catch(() => undefined);
    } else {
      throw new Error(`A cópia foi aplicada em memória (${plan.rootId}), mas a persistência falhou. Tente novamente nesta prévia para concluir sem duplicar.`, { cause: error });
    }
    throw error;
  }
}
