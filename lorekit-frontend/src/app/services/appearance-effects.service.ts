import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';
import { GlobalParameterService } from './global-parameter.service';

const GLASS_PARAMETER = 'appearanceGlassSurfaces';
const NOISE_PARAMETER = 'appearanceFineNoise';

@Injectable({ providedIn: 'root' })
export class AppearanceEffectsService {
  private readonly globalParameters = inject(GlobalParameterService);
  private readonly document = inject(DOCUMENT);

  readonly glassEnabled = signal(true);
  readonly noiseEnabled = signal(true);

  constructor() {
    const glassPreference = this.globalParameters.getParameter(GLASS_PARAMETER);
    const noisePreference = this.globalParameters.getParameter(NOISE_PARAMETER);

    if (glassPreference !== null) {
      this.glassEnabled.set(glassPreference === 'true');
    }

    if (noisePreference !== null) {
      this.noiseEnabled.set(noisePreference === 'true');
    }

    this.syncDocumentAttributes();
  }

  setGlassEnabled(enabled: boolean): void {
    this.glassEnabled.set(enabled);
    this.globalParameters.setParameter(GLASS_PARAMETER, String(enabled));
    this.syncDocumentAttributes();
  }

  setNoiseEnabled(enabled: boolean): void {
    this.noiseEnabled.set(enabled);
    this.globalParameters.setParameter(NOISE_PARAMETER, String(enabled));
    this.syncDocumentAttributes();
  }

  private syncDocumentAttributes(): void {
    const root = this.document.documentElement;
    root.toggleAttribute('data-lorekit-glass', this.glassEnabled());
    root.toggleAttribute('data-lorekit-noise', this.noiseEnabled());
  }
}
