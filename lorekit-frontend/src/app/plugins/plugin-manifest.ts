export type PluginPermission = string;

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  minLorekitVersion: string;
  entrypoint: string;
  migrations: string[];
  permissions: PluginPermission[];
}

export function isPluginManifest(value: unknown): value is PluginManifest {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const manifest = value as Record<string, unknown>;

  return typeof manifest['id'] === 'string'
    && typeof manifest['name'] === 'string'
    && typeof manifest['version'] === 'string'
    && typeof manifest['minLorekitVersion'] === 'string'
    && typeof manifest['entrypoint'] === 'string'
    && Array.isArray(manifest['migrations'])
    && manifest['migrations'].every((migration) => typeof migration === 'string')
    && Array.isArray(manifest['permissions'])
    && manifest['permissions'].every((permission) => typeof permission === 'string');
}
