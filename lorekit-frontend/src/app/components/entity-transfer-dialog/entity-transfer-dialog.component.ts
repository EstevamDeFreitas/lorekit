import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { EntityPortabilityService, ExportPreview, ImportPackagePreview } from '../../services/entity-portability.service';
import { EntityImportPlan, ImportResolutions } from '../../libs/entity-portability/entity-import.planner';

export type EntityTransferDialogData = { mode: 'export'; entityId: string } | { mode: 'import'; file: File };
@Component({
  selector: 'app-entity-transfer-dialog', imports: [CommonModule, FormsModule],
  templateUrl: './entity-transfer-dialog.component.html', styleUrl: './entity-transfer-dialog.component.css',
})
export class EntityTransferDialogComponent implements OnInit, OnDestroy {
  busy = false; error = ''; includeChildren = true; omitUnsupported = false; acknowledgeSheet = false;
  exportPreview: ExportPreview | null = null; packagePreview: ImportPackagePreview | null = null; importPlan: EntityImportPlan | null = null;
  worldId = ''; worlds: Array<{ id: string; name: string }> = [];
  references: Record<string, string> = {}; fieldNames: Record<string, string> = {};
  candidates: Record<string, Array<{ id: string; label: string }>> = {};
  scopeWarnings: string[] = []; hasSheet = false;
  private destroyed = false;
  constructor(@Inject(DIALOG_DATA) public readonly data: EntityTransferDialogData,
    private readonly ref: DialogRef<{ id: string; name: string } | undefined>, public readonly portability: EntityPortabilityService) {}
  async ngOnInit(): Promise<void> {
    if (this.data.mode === 'export') this.inspectScope();
    else await this.run(async () => {
      const preview = await this.portability.openImportPackage(this.data.mode === 'import' ? this.data.file : null!);
      if (this.destroyed) { this.portability.releasePreview(preview.id); return; }
      this.packagePreview = preview; this.worlds = this.portability.worlds();
    });
  }
  inspectScope(): void {
    this.resetExport(); this.error = '';
    if (this.data.mode !== 'export') return;
    try {
      const scope = this.portability.prepareExportV2('Character', this.data.entityId, { includeChildren: this.includeChildren, omitUnsupported: this.omitUnsupported });
      this.scopeWarnings = scope.issues.filter(issue => issue.code === 'UNSUPPORTED_DEPENDENCY').map(issue => issue.message);
      this.hasSheet = scope.entities.some(entity => entity.source.table === 'IRPWCharacterSheet');
    } catch (error) { this.error = message(error); }
  }
  resetExport(): void { if (this.exportPreview) this.portability.releasePreview(this.exportPreview.id); this.exportPreview = null; }
  async prepareExport(): Promise<void> {
    if (this.data.mode !== 'export' || (this.hasSheet && !this.acknowledgeSheet)) return;
    await this.run(async () => {
      const preview = await this.portability.createExportPreview(this.data.mode === 'export' ? this.data.entityId : '', { includeChildren: this.includeChildren, omitUnsupported: this.omitUnsupported });
      if (this.destroyed) { this.portability.releasePreview(preview.id); return; } this.exportPreview = preview;
    });
  }
  async download(): Promise<void> { if (this.exportPreview) await this.run(async () => { await this.portability.downloadExport(this.exportPreview!.id); this.ref.close(); }); }
  destinationChanged(): void {
    this.importPlan = null; this.references = {}; this.fieldNames = {}; this.candidates = {};
    if (this.worldId && this.packagePreview) for (const reference of this.packagePreview.manifest.externalReferences) this.candidates[reference.key] = this.portability.referenceCandidates(reference.targetType, this.worldId);
  }
  async prepareImport(): Promise<void> {
    if (!this.packagePreview || !this.worldId) return;
    await this.run(async () => {
      const choices: ImportResolutions = { fieldNames: {}, references: {} };
      for (const [key, name] of Object.entries(this.fieldNames)) if (name.trim()) choices.fieldNames![key] = name.trim();
      for (const [key, id] of Object.entries(this.references)) if (id) choices.references![key] = id === '__remove__' ? null : id;
      this.importPlan = await this.portability.prepareImportPreview(this.packagePreview!.id, this.worldId, choices);
    });
  }
  canApply(): boolean { return Boolean(this.importPlan && !this.importPlan.issues.some(issue => issue.blocking)); }
  async apply(): Promise<void> {
    if (!this.packagePreview || !this.canApply()) return;
    await this.run(async () => { const id = await this.portability.applyImportPreview(this.packagePreview!.id); this.ref.close({ id, name: this.packagePreview!.name }); });
  }
  cancel(): void { if (!this.busy) this.ref.close(); }
  ngOnDestroy(): void { this.destroyed = true; if (this.exportPreview) this.portability.releasePreview(this.exportPreview.id); if (this.packagePreview) this.portability.releasePreview(this.packagePreview.id); }
  private async run(operation: () => Promise<void>): Promise<void> {
    if (this.busy) return; this.busy = true; this.error = '';
    try { await operation(); } catch (error) { this.error = message(error); } finally { this.busy = false; }
  }
}
function message(error: unknown): string { return error instanceof Error ? error.message : 'Não foi possível concluir a transferência.'; }
