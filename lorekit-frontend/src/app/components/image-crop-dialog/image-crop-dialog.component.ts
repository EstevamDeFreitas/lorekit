import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';
import {
  clampCropOffset,
  CropOffset,
  CropSize,
  getCoverScale,
  getCropSourceRect,
  getZoomedOffset,
} from './image-crop.utils';

export interface ImageCropDialogData {
  imageSrc: string;
  aspectRatio: number;
  imageType?: string;
}

@Component({
  selector: 'app-image-crop-dialog',
  templateUrl: './image-crop-dialog.component.html',
  styleUrl: './image-crop-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageCropDialogComponent implements AfterViewInit, OnDestroy {
  private static readonly minZoom = 1;
  private static readonly maxZoom = 8;

  private readonly dialogRef = inject<DialogRef<Blob | undefined>>(DialogRef);
  private readonly data = inject<ImageCropDialogData>(DIALOG_DATA);
  private readonly cropFrame = viewChild.required<ElementRef<HTMLDivElement>>('cropFrame');
  private readonly sourceImage = viewChild.required<ElementRef<HTMLImageElement>>('sourceImage');

  protected readonly aspectRatio =
    Number.isFinite(this.data.aspectRatio) && this.data.aspectRatio > 0
      ? this.data.aspectRatio
      : 1;
  protected readonly imageSource = signal(this.data.imageSrc);
  protected readonly imageSize = signal<CropSize>({ width: 0, height: 0 });
  protected readonly viewportSize = signal<CropSize>({ width: 0, height: 0 });
  protected readonly offset = signal<CropOffset>({ x: 0, y: 0 });
  protected readonly zoom = signal(1);
  protected readonly isDragging = signal(false);
  protected readonly isFileOver = signal(false);
  protected readonly isExporting = signal(false);
  protected readonly errorMessage = signal('');

  protected readonly zoomPercentage = computed(() => Math.round(this.zoom() * 100));
  protected readonly renderedImage = computed(() => {
    const image = this.imageSize();
    const viewport = this.viewportSize();
    const scale = getCoverScale(image, viewport) * this.zoom();
    const width = image.width * scale;
    const height = image.height * scale;
    const offset = this.offset();

    return {
      width,
      height,
      left: (viewport.width - width) / 2 + offset.x,
      top: (viewport.height - height) / 2 + offset.y,
    };
  });

  private resizeObserver?: ResizeObserver;
  private activePointerId: number | null = null;
  private dragStart: CropOffset = { x: 0, y: 0 };
  private offsetAtDragStart: CropOffset = { x: 0, y: 0 };

  ngAfterViewInit(): void {
    this.resizeObserver = new ResizeObserver(() => this.updateViewportSize());
    this.resizeObserver.observe(this.cropFrame().nativeElement);
    this.updateViewportSize();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  protected onImageLoad(event: Event): void {
    const image = event.currentTarget as HTMLImageElement;
    this.imageSize.set({
      width: image.naturalWidth,
      height: image.naturalHeight,
    });
    this.resetPosition();
  }

  protected onImageError(): void {
    this.errorMessage.set('N?o foi poss?vel carregar esta imagem.');
  }

  protected onPointerDown(event: PointerEvent): void {
    if (event.button !== 0 || this.imageSize().width === 0) {
      return;
    }

    event.preventDefault();
    this.activePointerId = event.pointerId;
    this.dragStart = { x: event.clientX, y: event.clientY };
    this.offsetAtDragStart = this.offset();
    this.isDragging.set(true);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  protected onPointerMove(event: PointerEvent): void {
    if (this.activePointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    this.setOffset({
      x: this.offsetAtDragStart.x + event.clientX - this.dragStart.x,
      y: this.offsetAtDragStart.y + event.clientY - this.dragStart.y,
    });
  }

  protected endPointerDrag(event: PointerEvent): void {
    if (this.activePointerId !== event.pointerId) {
      return;
    }

    const target = event.currentTarget as HTMLElement;
    if (target.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
    this.activePointerId = null;
    this.isDragging.set(false);
  }

  protected onWheel(event: WheelEvent): void {
    event.preventDefault();
    const rect = this.cropFrame().nativeElement.getBoundingClientRect();
    const pointerFromCenter = {
      x: event.clientX - rect.left - rect.width / 2,
      y: event.clientY - rect.top - rect.height / 2,
    };
    const nextZoom = this.zoom() * Math.exp(-event.deltaY * 0.0015);
    this.setZoom(nextZoom, pointerFromCenter);
  }

  protected zoomIn(): void {
    this.setZoom(this.zoom() * 1.2);
  }

  protected zoomOut(): void {
    this.setZoom(this.zoom() / 1.2);
  }

  protected onZoomInput(event: Event): void {
    this.setZoom(Number((event.currentTarget as HTMLInputElement).value));
  }

  protected resetPosition(): void {
    this.zoom.set(ImageCropDialogComponent.minZoom);
    this.offset.set({ x: 0, y: 0 });
    this.errorMessage.set('');
  }

  protected allowFileDrop(event: DragEvent): void {
    if (!this.hasImageFile(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    this.isFileOver.set(true);
  }

  protected leaveFileDrop(event: DragEvent): void {
    const container = event.currentTarget as Node;
    if (event.relatedTarget instanceof Node && container.contains(event.relatedTarget)) {
      return;
    }
    this.isFileOver.set(false);
  }

  protected dropFile(event: DragEvent): void {
    event.preventDefault();
    this.isFileOver.set(false);
    const file = this.getImageFile(event.dataTransfer);
    if (file) {
      this.loadFile(file);
    }
  }

  protected selectFile(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) {
      this.loadFile(file);
    }
  }

  protected close(): void {
    this.dialogRef.close();
  }

  protected confirm(): void {
    const image = this.sourceImage().nativeElement;
    const imageSize = this.imageSize();
    const viewport = this.viewportSize();
    if (!image.complete || imageSize.width === 0 || viewport.width === 0) {
      return;
    }

    const scale = getCoverScale(imageSize, viewport) * this.zoom();
    const crop = getCropSourceRect(imageSize, viewport, scale, this.offset());
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(crop.width));
    canvas.height = Math.max(1, Math.round(crop.height));
    const context = canvas.getContext('2d');
    if (!context) {
      this.errorMessage.set('N?o foi poss?vel preparar o recorte.');
      return;
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(
      image,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      canvas.width,
      canvas.height
    );

    this.isExporting.set(true);
    canvas.toBlob(
      blob => {
        this.isExporting.set(false);
        if (blob) {
          this.dialogRef.close(blob);
        } else {
          this.errorMessage.set('N?o foi poss?vel exportar o recorte.');
        }
      },
      this.getOutputType(),
      0.92
    );
  }

  private updateViewportSize(): void {
    const element = this.cropFrame().nativeElement;
    const viewport = {
      width: element.clientWidth,
      height: element.clientHeight,
    };
    this.viewportSize.set(viewport);
    this.setOffset(this.offset());
  }

  private setZoom(nextZoom: number, pointerFromCenter: CropOffset = { x: 0, y: 0 }): void {
    const previousZoom = this.zoom();
    const clampedZoom = Math.max(
      ImageCropDialogComponent.minZoom,
      Math.min(nextZoom, ImageCropDialogComponent.maxZoom)
    );
    if (clampedZoom === previousZoom) {
      return;
    }

    const zoomedOffset = getZoomedOffset(
      this.offset(),
      pointerFromCenter,
      previousZoom,
      clampedZoom
    );
    this.zoom.set(clampedZoom);
    this.setOffset(zoomedOffset);
  }

  private setOffset(offset: CropOffset): void {
    const scale =
      getCoverScale(this.imageSize(), this.viewportSize()) * this.zoom();
    this.offset.set(clampCropOffset(
      offset,
      this.imageSize(),
      this.viewportSize(),
      scale
    ));
  }

  private getImageFile(dataTransfer: DataTransfer | null): File | undefined {
    return Array.from(dataTransfer?.files ?? []).find(file => file.type.startsWith('image/'));
  }

  private hasImageFile(dataTransfer: DataTransfer | null): boolean {
    return Array.from(dataTransfer?.items ?? []).some(
      item => item.kind === 'file' && item.type.startsWith('image/')
    ) || !!this.getImageFile(dataTransfer);
  }

  private loadFile(file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        this.imageSource.set(reader.result);
        this.imageSize.set({ width: 0, height: 0 });
        this.resetPosition();
      }
    };
    reader.onerror = () => this.errorMessage.set('N?o foi poss?vel ler esta imagem.');
    reader.readAsDataURL(file);
  }

  private getOutputType(): string {
    const sourceType = /^data:(image\/[^;]+)/i.exec(this.imageSource())?.[1]
      ?? this.data.imageType
      ?? 'image/jpeg';
    return sourceType === 'image/png' || sourceType === 'image/webp'
      ? sourceType
      : 'image/jpeg';
  }
}
