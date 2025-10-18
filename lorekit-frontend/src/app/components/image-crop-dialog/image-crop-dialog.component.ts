import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { AfterViewInit, Component, CUSTOM_ELEMENTS_SCHEMA, ElementRef, inject, OnDestroy, OnInit, ViewChild, ViewChildren } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { AngularCropperjsModule, CropperComponent, ImageCropperResult } from 'angular-cropperjs';

interface DialogData {
  imageSrc: string;
  aspectRatio: number;
}

@Component({
  selector: 'app-image-crop-dialog',
  imports: [AngularCropperjsModule],
  template: `
    <div class="bg-zinc-900 rounded-lg p-6 flex flex-col items-center shadow-lg">
      <div class="max-w-[800px] w-full h-[450px] overflow-hidden rounded relative bg-black">
        <angular-cropper #angularCropper
          [cropperOptions]="config"
          (export)="resultImageFun($event)"
          (ready)="checkstatus($event)"
          [imageUrl]="data.imageSrc"
          ></angular-cropper>
      </div>

      <div class="flex justify-end gap-2 mt-4">
        <button (click)="close()" class="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">Cancelar</button>
        <button (click)="confirm()" class="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Confirmar</button>
      </div>
    </div>
  `,
  styleUrl: './image-crop-dialog.component.css',
})
export class ImageCropDialogComponent implements OnDestroy {

  sanitizer = inject(DomSanitizer);
  dialogRef = inject(DialogRef);
  data: DialogData = inject(DIALOG_DATA);
  @ViewChild('angularCropper') public angularCropper!: CropperComponent;

  config = {
    aspectRatio: this.data.aspectRatio,
    viewMode: 1, // restrict the crop box to not exceed the size of the canvas
    responsive: true,
    restore: false,
    autoCropArea: 1, // make the crop box cover 100% of the image area
  };

  resultImage: any;
  resultResult: any;

  handleWidth = 400;
  handleHeight = 400;

  ngOnDestroy(): void {
    if(this.angularCropper && this.angularCropper.cropper) {
      this.angularCropper.cropper.destroy();
    }
  }

  ngOnInit(): void {


  }

  close() {

    this.dialogRef.close();
  }

  confirm() {
    this.angularCropper.exportCanvas();
  }

  resultImageFun(event: ImageCropperResult) {
    let urlCreator = window.URL;
    this.resultResult = this.angularCropper.cropper.getCroppedCanvas().toBlob((blob) => {
      if (blob) {
        this.dialogRef.close( blob );
      }
    } );

  }

  checkstatus(event: any) {
    console.log(event.blob);
    if (event.blob === undefined) {
      return;
    }
    // this.resultResult = event.blob;
    let urlCreator = window.URL;
    this.resultResult = this.sanitizer.bypassSecurityTrustUrl(
        urlCreator.createObjectURL(new Blob(event.blob)));
  }
}
