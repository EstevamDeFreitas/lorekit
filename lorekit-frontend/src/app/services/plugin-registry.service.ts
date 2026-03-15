import { Injectable } from '@angular/core';
import { CrudHelper } from '../database/database.helper';
import { DbProvider } from '../app.config';

export const PLUGIN_LIFECYCLE_STATUSES = [
  'cataloged',
  'downloading',
  'downloaded',
  'installed',
  'enabled',
  'disabled',
  'failed'
] as const;

export type PluginLifecycleStatus = (typeof PLUGIN_LIFECYCLE_STATUSES)[number];

export interface PluginRegistryItem {
  id: string;
  version: string;
  status: PluginLifecycleStatus;
  installedAt: string;
  source?: string;
  checksum?: string;
  lastError?: string;
  appVersion?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PluginRegistryService {
  private crud: CrudHelper;

  constructor(private dbProvider: DbProvider) {
    this.crud = this.dbProvider.getCrudHelper();
  }

  listInstalledPlugins(): PluginRegistryItem[] {
    return this.crud.findAll('PluginRegistry') as PluginRegistryItem[];
  }

  getPluginById(pluginId: string): PluginRegistryItem | null {
    return (this.crud.findFirst('PluginRegistry', { id: pluginId }) as PluginRegistryItem) ?? null;
  }

  registerPlugin(plugin: Omit<PluginRegistryItem, 'installedAt'> & { installedAt?: string }): PluginRegistryItem {
    const payload: PluginRegistryItem = {
      ...plugin,
      installedAt: plugin.installedAt ?? new Date().toISOString()
    };

    const existing = this.getPluginById(plugin.id);
    if (existing) {
      this.crud.update('PluginRegistry', plugin.id, payload);
      return { ...existing, ...payload };
    }

    this.crud.create('PluginRegistry', payload);
    return payload;
  }

  markPluginDownloading(plugin: Pick<PluginRegistryItem, 'id' | 'version'> & { source?: string; appVersion?: string }): void {
    this.registerPlugin({
      ...plugin,
      status: 'downloading',
      installedAt: new Date().toISOString(),
      lastError: ''
    });
  }

  markPluginDownloaded(pluginId: string, checksum: string): void {
    this.crud.update('PluginRegistry', pluginId, {
      status: 'downloaded',
      checksum,
      lastError: ''
    });
  }

  markPluginFailed(pluginId: string, errorMessage: string): void {
    this.crud.update('PluginRegistry', pluginId, {
      status: 'failed',
      lastError: errorMessage,
    });
  }

  updatePluginStatus(pluginId: string, status: PluginLifecycleStatus): void {
    this.crud.update('PluginRegistry', pluginId, { status });
  }

  removePlugin(pluginId: string): void {
    this.crud.deleteWhen('PluginSetting', { pluginId });
    this.crud.delete('PluginRegistry', pluginId);
  }

  getPluginSettings(pluginId: string): Record<string, string | null> {
    const rows = this.crud.findAll('PluginSetting', { pluginId }) as Array<{ key: string; value: string | null }>;
    return rows.reduce<Record<string, string | null>>((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});
  }

  upsertPluginSetting(pluginId: string, key: string, value: string | null): void {
    const existing = this.crud.findFirst('PluginSetting', { pluginId, key });
    if (existing) {
      this.crud.deleteWhen('PluginSetting', { pluginId, key });
    }

    this.crud.create('PluginSetting', { pluginId, key, value });
  }

  deletePluginSetting(pluginId: string, key: string): void {
    this.crud.deleteWhen('PluginSetting', { pluginId, key });
  }

  loadEnabledPlugins(): PluginRegistryItem[] {
    return this.crud.findAll('PluginRegistry', { status: 'enabled' }) as PluginRegistryItem[];
  }
}
