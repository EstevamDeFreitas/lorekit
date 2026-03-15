import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface PluginCatalogEntry {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  minAppVersion: string;
  maxAppVersion?: string;
  downloadUrl: string;
  checksum: string;
  signature: string;
  changelog?: string;
}

export interface PluginCatalogFile {
  updatedAt: string;
  catalogSignature: string;
  plugins: PluginCatalogEntry[];
}

@Injectable({ providedIn: 'root' })
export class PluginMarketplaceService {
  private readonly catalogUrl = 'assets/plugins/catalog.json';

  constructor(private http: HttpClient) {}

  async fetchCatalog(): Promise<PluginCatalogFile> {
    return firstValueFrom(this.http.get<PluginCatalogFile>(this.catalogUrl));
  }
}
