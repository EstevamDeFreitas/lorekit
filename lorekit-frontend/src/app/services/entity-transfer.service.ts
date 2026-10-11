import { Injectable } from '@angular/core';

type EntityRef = { table: string; id: string };

/**
 * Legacy UI compatibility only. Hiding a button did not prevent v1 graph walks
 * or arbitrary-table upserts. Keep these methods fail-closed until the v2
 * archive, executor and dialogs are complete. Preparation: EntityPortabilityService.
 */
@Injectable({ providedIn: 'root' })
export class EntityTransferService {
  async exportEntityBundle(_table: string, _id: string): Promise<void> {
    throw new Error('A exportação antiga está desabilitada. A versão v2 está em implementação.');
  }

  async importBundleFromFile(_file: File): Promise<EntityRef> {
    throw new Error('A importação antiga está desabilitada. Pacotes v1 não são aceitos pela versão v2.');
  }
}
