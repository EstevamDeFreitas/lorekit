import { Component, ElementRef, inject, input, OnInit, ViewChild } from '@angular/core';
import { ImageService } from '../../services/image.service';
import { Image } from '../../models/image.model';
import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ImageCropDialogComponent } from '../image-crop-dialog/image-crop-dialog.component';

@Component({
  selector: 'app-image-uploader',
  imports: [],
  template: `
    <div class="flex items-center justify-between mb-4">
      <h2 class="font-semibold text-lg">Imagem</h2>
      <label class="cursor-pointer px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
        {{ isLoading ? 'Enviando...' : 'Enviar imagem' }}
        <input
          type="file"
          (change)="onFileSelected($event)"
          class="hidden"
          accept="image/*"
          [disabled]="isLoading"
        />
      </label>
    </div>

    <div class="grid grid-cols-1 gap-4">
      @for (img of images; track img.id) {
      <div class="relative group rounded-lg overflow-hidden border hover:shadow-lg transition">
        <img [src]="img.filePath" alt="Imagem" class="w-full h-32 object-cover" />

        <button
          (click)="deleteImage(img.id)"
          class="absolute top-2 right-2 bg-red-600 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition"
          title="Excluir imagem"
        >
          ✕
        </button>
      </div>
      }
      @empty {
        <div class="relative group rounded-lg overflow-hidden border hover:shadow-lg transition">
          <div class="w-full h-32 flex items-center justify-center text-zinc-500">Nenhuma imagem enviada.</div>
        </div>
      }
    </div>
  `,
  styleUrl: './image-uploader.component.css',
})
export class ImageUploaderComponent implements OnInit {

  dialogref = inject<DialogRef<any>>(DialogRef<any>);
  data = inject<any>(DIALOG_DATA);

  dialog = inject(Dialog);
  aspectRatio = 10 / 1;


  entityTable = "";
  entityId = "";
  usageKey = "";

  images: Image[] = [];
  isLoading = false;

  private imageService = inject(ImageService);

  ngOnInit() {
    this.entityTable = this.data?.entityTable || '';
    this.entityId = this.data?.entityId || '';
    this.usageKey = this.data?.usageKey || 'default';
    if (this.entityTable && this.entityId) {
      this.loadImages();
    }
  }

  loadImages() {
    this.images = this.imageService.getImages(this.entityTable, this.entityId, this.usageKey);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (e) => {
      const dialogRef = this.dialog.open(ImageCropDialogComponent, {
        data: {
          imageSrc: e.target?.result,
          aspectRatio: this.aspectRatio,
        },
        width: '900px',
        maxHeight: '90vh',
        panelClass: 'bg-transparent',
      });

      dialogRef.closed.subscribe((blob: any) => {
        if (blob) {
          // Envia o blob para o backend
          this.uploadCroppedImage(blob);
        }
      });
    };

    reader.readAsDataURL(file);


  }

  uploadCroppedImage(blob: Blob) {
    const file = new File([blob], 'cropped-image.jpg', { type: 'image/jpeg' });

    if(this.images.length > 0){
      this.deleteImage(this.images[0].id);
    }

    this.isLoading = true;
    this.imageService.uploadImage(file, this.entityTable, this.entityId, this.usageKey).then((img) => {
      this.images.push(img);
      this.isLoading = false;
    });

  }

  deleteImage(id: string) {
    this.imageService.deleteImage(id).then(() => {
      this.images = this.images.filter(i => i.id !== id);
    });
  }
}
