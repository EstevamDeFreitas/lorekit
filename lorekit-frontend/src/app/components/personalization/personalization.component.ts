import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Image } from '../../models/image.model';
import { Personalization, WeakRelationship } from '../../models/personalization.model';
import { ImageService } from '../../services/image.service';
import { PersonalizationService } from '../../services/personalization.service';
import { ButtonComponent } from '../button/button.component';
import { IconSelectorComponent } from '../icon-selector/icon-selector.component';
import { ImageUploaderComponent } from '../ImageUploader/image-uploader.component';
import { InputComponent } from '../input/input.component';
import { IconButtonComponent } from "../icon-button/icon-button.component";
import { AssetUrlPipe } from '../../pipes/asset-url.pipe';

@Component({
  selector: 'app-personalization',
  imports: [
    InputComponent,
    ButtonComponent,
    FormsModule,
    IconSelectorComponent,
    IconButtonComponent,
    AssetUrlPipe,
],
  templateUrl: './personalization.component.html',
  styleUrl: './personalization.component.css',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class PersonalizationComponent {
  readonly dialogref = inject<DialogRef<void>>(DialogRef);
  readonly relationshipInfo = inject<WeakRelationship>(DIALOG_DATA);
  readonly imageDropTarget = signal<string | null>(null);

  personalizationData: Personalization = new Personalization();
  personalizationContent: Record<string, string> = {};

  private readonly dialog = inject(Dialog);
  private readonly imageService = inject(ImageService);

  backgroundImage: Image | null = null;
  profileImage: Image | null = null;
  fullBodyImage: Image | null = null;

  readonly backgroundAspectRatio = 5 / 1;
  readonly profileAspectRatio = 1 / 1;
  readonly fullBodyAspectRatio = 20 / 35;

  constructor(private readonly personalizationService: PersonalizationService) {
    this.loadPersonalization();
  }

  processPersonalizationContent(): void {
    this.personalizationContent = JSON.parse(
      this.personalizationData.contentJson || '{}'
    ) as Record<string, string>;
  }

  loadPersonalization(): void {
    this.personalizationData = this.personalizationService.getPersonalization(
      this.relationshipInfo.entityTable,
      this.relationshipInfo.entityId
    );
    this.personalizationData =
      this.personalizationData || new Personalization(undefined, '{}');

    this.processPersonalizationContent();
    this.loadImages();
  }

  savePersonalization(): void {
    this.personalizationData.contentJson = JSON.stringify(this.personalizationContent);
    this.personalizationService.savePersonalization(
      this.personalizationData,
      this.relationshipInfo.entityTable,
      this.relationshipInfo.entityId
    );
    this.dialogref.close();
  }

  loadImages(): void {
    this.backgroundImage = this.imageService.getImage(
      this.relationshipInfo.entityTable,
      this.relationshipInfo.entityId,
      'default'
    );
    this.profileImage = this.imageService.getImage(
      this.relationshipInfo.entityTable,
      this.relationshipInfo.entityId,
      'profile'
    );
    this.fullBodyImage = this.imageService.getImage(
      this.relationshipInfo.entityTable,
      this.relationshipInfo.entityId,
      'fullBody'
    );
  }

  openImageUploader(
    usageKey: string,
    aspectRatio?: number,
    initialFile?: File
  ): void {
    const dialogRef = this.dialog.open(ImageUploaderComponent, {
      data: {
        entityTable: this.relationshipInfo.entityTable,
        entityId: this.relationshipInfo.entityId,
        usageKey,
        aspectRatio,
        initialFile,
      },
      panelClass: 'screen-dialog',
      width: '30rem',
      maxWidth: '95vw',
    });

    dialogRef.closed.subscribe(() => this.loadImages());
  }

  allowImageDrop(event: DragEvent, usageKey: string): void {
    if (!this.hasImageFile(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    this.imageDropTarget.set(usageKey);
  }

  leaveImageDrop(event: DragEvent, usageKey: string): void {
    const container = event.currentTarget as Node;
    if (event.relatedTarget instanceof Node && container.contains(event.relatedTarget)) {
      return;
    }
    if (this.imageDropTarget() === usageKey) {
      this.imageDropTarget.set(null);
    }
  }

  dropImage(event: DragEvent, usageKey: string, aspectRatio: number): void {
    event.preventDefault();
    event.stopPropagation();
    this.imageDropTarget.set(null);
    const file = this.getImageFile(event.dataTransfer);
    if (file) {
      this.openImageUploader(usageKey, aspectRatio, file);
    }
  }

  onColorChange(hex: string): void {
    this.personalizationContent['color'] = this.normalizeHex(
      hex,
      this.personalizationContent['color']
    );
  }

  onHexInput(value: string): void {
    this.personalizationContent['color'] = this.normalizeHex(
      value,
      this.personalizationContent['color']
    );
  }

  private hasImageFile(dataTransfer: DataTransfer | null): boolean {
    return Array.from(dataTransfer?.items ?? []).some(
      item => item.kind === 'file' && item.type.startsWith('image/')
    ) || !!this.getImageFile(dataTransfer);
  }

  private getImageFile(dataTransfer: DataTransfer | null): File | undefined {
    return Array.from(dataTransfer?.files ?? []).find(file =>
      file.type.startsWith('image/')
    );
  }

  private normalizeHex(value: string, fallback: string = '#000000'): string {
    if (!value) {
      return fallback || '#000000';
    }

    let normalized = value.trim().toUpperCase();
    if (!normalized.startsWith('#')) {
      normalized = `#${normalized}`;
    }

    const shortHex = /^#([0-9A-F]{3})$/i;
    if (shortHex.test(normalized)) {
      normalized = normalized.replace(shortHex, (_match, group: string) => {
        const [red, green, blue] = group;
        return `#${red}${red}${green}${green}${blue}${blue}`.toUpperCase();
      });
    }

    return /^#([0-9A-F]{6})$/i.test(normalized)
      ? normalized
      : fallback || '#000000';
  }
}
