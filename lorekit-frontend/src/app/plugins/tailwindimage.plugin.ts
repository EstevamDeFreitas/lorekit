// lorekit-frontend/src/app/plugins/tailwindimage.plugin.ts
import { buildImageUrl } from '../models/image.model';

export default class TailwindImage {
  data: any;
  wrapper: HTMLElement | null = null;
  api: any;
  config: any;

  static get toolbox() {
    return {
      icon: '<i class="fa-solid fa-image"></i>',
      title: 'Imagem'
    };
  }

  static get isInline() {
    return false;
  }

  static get pasteConfig() {
    return {
      tags: ['img'],
      patterns: {
        image: /https?:\/\/\S+\.(gif|jpe?g|tiff|png|webp|bmp)$/i
      },
      files: {
        mimeTypes: ['image/*']
      }
    };
  }

  constructor({ data, config, api }: { data?: any; config?: any; api?: any }) {
    this.api = api;
    this.config = config || {};

    this.data = {
      url: data?.url || '',
      caption: data?.caption || '',
      withBorder: data?.withBorder !== undefined ? data.withBorder : false,
      withBackground: data?.withBackground !== undefined ? data.withBackground : false,
      stretched: data?.stretched !== undefined ? data.stretched : false
    };
  }

  render() {
    this.wrapper = document.createElement('div');
    this.wrapper.classList.add('image-tool');

    if (!this.data.url) {
      this.renderUploadButton();
    } else {
      this.renderImage();
    }

    return this.wrapper;
  }

  renderUploadButton() {
    if (!this.wrapper) return;

    const button = document.createElement('div');
    button.classList.add(
      'image-tool__upload-button',
      'border-2',
      'border-dashed',
      'border-gray-600',
      'rounded-lg',
      'p-8',
      'text-center',
      'cursor-pointer',
      'hover:border-gray-400',
      'transition-colors',
      'bg-gray-800'
    );

    button.innerHTML = `
      <i class="fa-solid fa-cloud-arrow-up text-4xl text-gray-500 mb-2"></i>
      <div class="text-gray-400">Clique para fazer upload ou arraste uma imagem</div>
      <input type="file" accept="image/*" style="display: none;" class="image-file-input">
    `;

    const fileInput = button.querySelector('.image-file-input') as HTMLInputElement;

    button.addEventListener('click', (e) => {
      if (e.target !== fileInput) {
        fileInput.click();
      }
    });

    fileInput.addEventListener('change', (e: any) => {
      const file = e.target?.files?.[0];
      if (file) {
        this.uploadFile(file);
      }
    });

    // Drag and drop
    button.addEventListener('dragover', (e) => {
      e.preventDefault();
      button.classList.add('border-blue-500');
    });

    button.addEventListener('dragleave', () => {
      button.classList.remove('border-blue-500');
    });

    button.addEventListener('drop', (e) => {
      e.preventDefault();
      button.classList.remove('border-blue-500');

      const file = e.dataTransfer?.files?.[0];
      if (file && file.type.startsWith('image/')) {
        this.uploadFile(file);
      }
    });

    this.wrapper.innerHTML = '';
    this.wrapper.appendChild(button);
  }

  renderImage() {
    if (!this.wrapper) return;

    const container = document.createElement('div');
    container.classList.add('image-tool__image-container', 'relative', 'group');

    if (this.data.withBorder) {
      container.classList.add('border', 'border-gray-600', 'rounded-lg', 'overflow-hidden');
    }

    if (this.data.withBackground) {
      container.classList.add('bg-gray-800', 'p-4');
    }

    if (this.data.stretched) {
      container.classList.add('w-full');
    }

    const img = document.createElement('img');
    img.src = buildImageUrl(this.data.url);
    img.classList.add('max-w-full', 'h-auto', 'mx-auto', 'rounded');

    img.onerror = () => {
      img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle"%3EImagem não encontrada%3C/text%3E%3C/svg%3E';
    };

    container.appendChild(img);

    // Botão de exclusão
    const deleteBtn = document.createElement('button');
    deleteBtn.innerHTML = '<i class="fa-solid !not-italic fa-trash"></i>';
    deleteBtn.classList.add(
      'absolute', 'top-2', 'right-2',
      'bg-red-600', 'hover:bg-red-700',
      'text-white', 'rounded-full',
      'w-8', 'h-8',
      'flex', 'items-center', 'justify-center',
      'opacity-0', 'group-hover:opacity-100',
      'transition-opacity',
      'cursor-pointer'
    );
    deleteBtn.title = 'Remover imagem';
    deleteBtn.addEventListener('click', () => {
      this.data.url = '';
      this.renderUploadButton();
    });
    container.appendChild(deleteBtn);

    // Caption
    if (this.data.caption || this.config.captionPlaceholder) {
      const caption = document.createElement('div');
      caption.contentEditable = 'true';
      caption.classList.add(
        'image-tool__caption',
        'text-center',
        'text-sm',
        'text-gray-400',
        'mt-2',
        'focus:outline-none',
        'italic'
      );
      caption.setAttribute('data-placeholder', this.config.captionPlaceholder || 'Legenda...');
      caption.textContent = this.data.caption;

      caption.addEventListener('input', () => {
        this.data.caption = caption.textContent || '';
      });

      container.appendChild(caption);
    }

    this.wrapper.innerHTML = '';
    this.wrapper.appendChild(container);
  }

  async uploadFile(file: File) {
    try {
      if (!this.config.uploader || typeof this.config.uploader !== 'function') {
        // Fallback: criar URL local temporária
        const reader = new FileReader();
        reader.onload = (e) => {
          this.data.url = e.target?.result as string;
          this.renderImage();
        };
        reader.readAsDataURL(file);
        return;
      }

      // Usa o uploader customizado fornecido na config
      const uploadedFileData = await this.config.uploader(file);

      if (uploadedFileData && uploadedFileData.file?.url) {
        this.data.url = uploadedFileData.file.url;
        this.renderImage();
      }
    } catch (error) {
      console.error('Erro ao fazer upload da imagem:', error);
      if (this.api.notifier) {
        this.api.notifier.show({
          message: 'Erro ao fazer upload da imagem',
          style: 'error',
        });
      }
    }
  }

  save() {
    return {
      url: this.data.url,
      caption: this.data.caption,
      withBorder: this.data.withBorder,
      withBackground: this.data.withBackground,
      stretched: this.data.stretched
    };
  }

  validate(savedData: any) {
    return savedData.url && savedData.url.trim() !== '';
  }

  renderSettings() {
    const wrapper = document.createElement('div');
    wrapper.classList.add('image-settings');

    const settings = [
      {
        name: 'withBorder',
        icon: '<i class="fa-solid fa-border-all"></i>',
        label: 'Com borda',
        isActive: () => this.data.withBorder,
        toggle: () => {
          this.data.withBorder = !this.data.withBorder;
          this.renderImage();
        }
      },
      {
        name: 'stretched',
        icon: '<i class="fa-solid fa-arrows-left-right"></i>',
        label: 'Largura total',
        isActive: () => this.data.stretched,
        toggle: () => {
          this.data.stretched = !this.data.stretched;
          this.renderImage();
        }
      },
      {
        name: 'withBackground',
        icon: '<i class="fa-solid fa-fill"></i>',
        label: 'Com fundo',
        isActive: () => this.data.withBackground,
        toggle: () => {
          this.data.withBackground = !this.data.withBackground;
          this.renderImage();
        }
      }
    ];

    settings.forEach(setting => {
      const button = document.createElement('div');
      button.classList.add('cdx-settings-button');

      if (setting.isActive()) {
        button.classList.add('cdx-settings-button--active');
      }

      button.innerHTML = setting.icon;
      button.title = setting.label;

      button.addEventListener('click', () => {
        setting.toggle();
        button.classList.toggle('cdx-settings-button--active');
      });

      wrapper.appendChild(button);
    });

    return wrapper;
  }

  onPaste(event: any) {
    switch (event.type) {
      case 'tag': {
        const img = event.detail.data;
        this.data.url = img.src;
        break;
      }
      case 'pattern': {
        this.data.url = event.detail.data;
        break;
      }
      case 'file': {
        this.uploadFile(event.detail.file);
        break;
      }
    }
  }
}
