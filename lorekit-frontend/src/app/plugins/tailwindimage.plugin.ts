// lorekit-frontend/src/app/plugins/tailwindimage.plugin.ts
import { buildImageUrl } from '../models/image.model';

export default class TailwindImage {
  data: any;
  wrapper: HTMLElement | null = null;
  api: any;
  config: any;
  isResizing: boolean = false;
  startX: number = 0;
  startWidth: number = 0;

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
      stretched: data?.stretched !== undefined ? data.stretched : false,
      width: data?.width || 'auto' // pode ser 'auto', '25%', '50%', '75%', '100%' ou valor em pixels
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
      container.style.maxWidth = '100%';
    } else {
      // Aplica largura customizada
      if (this.data.width === 'auto') {
        container.style.maxWidth = '100%';
        container.style.width = 'auto';
        container.classList.add('mx-auto');
      } else if (typeof this.data.width === 'string' && this.data.width.endsWith('%')) {
        container.style.width = this.data.width;
        container.style.maxWidth = '100%';
        container.classList.add('mx-auto');
      } else {
        container.style.width = `${this.data.width}px`;
        container.style.maxWidth = '100%';
        container.classList.add('mx-auto');
      }
    }

    const imgWrapper = document.createElement('div');
    imgWrapper.classList.add('relative', 'inline-block', 'max-w-full');

    const img = document.createElement('img');
    img.src = buildImageUrl(this.data.url);
    img.classList.add('max-w-full', 'h-auto', 'block', 'rounded');

    img.onerror = () => {
      img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle"%3EImagem não encontrada%3C/text%3E%3C/svg%3E';
    };

    imgWrapper.appendChild(img);

    // Handles de redimensionamento (esquerda e direita)
    if (!this.data.stretched) {
      const leftHandle = this.createResizeHandle('left');
      const rightHandle = this.createResizeHandle('right');

      imgWrapper.appendChild(leftHandle);
      imgWrapper.appendChild(rightHandle);
    }

    container.appendChild(imgWrapper);

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
      'cursor-pointer',
      'z-10'
    );
    deleteBtn.title = 'Remover imagem';
    deleteBtn.addEventListener('click', () => {
      this.data.url = '';
      this.renderUploadButton();
    });
    container.appendChild(deleteBtn);

    // Caption
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

    this.wrapper.innerHTML = '';
    this.wrapper.appendChild(container);
  }

  createResizeHandle(side: 'left' | 'right'): HTMLElement {
    const handle = document.createElement('div');
    handle.classList.add('image-resize-handle', `image-resize-handle--${side}`);
    handle.style.cssText = `
      position: absolute;
      top: 0;
      ${side}: -5px;
      width: 10px;
      height: 100%;
      cursor: ew-resize;
      background: rgba(59, 130, 246, 0.5);
      opacity: 0;
      transition: opacity 0.2s;
      z-index: 5;
    `;

    // Mostra os handles no hover
    const container = this.wrapper?.querySelector('.image-tool__image-container');
    if (container) {
      container.addEventListener('mouseenter', () => {
        handle.style.opacity = '0';
      });
      container.addEventListener('mouseover', () => {
        handle.style.opacity = '1';
      });
      container.addEventListener('mouseleave', () => {
        if (!this.isResizing) {
          handle.style.opacity = '0';
        }
      });
    }

    handle.addEventListener('mousedown', (e) => this.startResize(e, side));

    return handle;
  }

  startResize(e: MouseEvent, side: 'left' | 'right') {
    e.preventDefault();
    e.stopPropagation();

    this.isResizing = true;
    this.startX = e.clientX;

    const container = this.wrapper?.querySelector('.image-tool__image-container') as HTMLElement;
    if (!container) return;

    this.startWidth = container.offsetWidth;

    const onMouseMove = (e: MouseEvent) => this.resize(e, side);
    const onMouseUp = () => {
      this.isResizing = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      // Esconde os handles após redimensionar
      const handles = this.wrapper?.querySelectorAll('.image-resize-handle');
      handles?.forEach(h => (h as HTMLElement).style.opacity = '0');
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  resize(e: MouseEvent, side: 'left' | 'right') {
    const container = this.wrapper?.querySelector('.image-tool__image-container') as HTMLElement;
    if (!container) return;

    const deltaX = e.clientX - this.startX;
    const multiplier = side === 'right' ? 1 : -1;
    const newWidth = Math.max(100, this.startWidth + (deltaX * multiplier * 2));

    // Limita o tamanho máximo ao container pai
    const maxWidth = container.parentElement?.offsetWidth || window.innerWidth;
    const finalWidth = Math.min(newWidth, maxWidth);

    this.data.width = finalWidth;
    container.style.width = `${finalWidth}px`;
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
      stretched: this.data.stretched,
      width: this.data.width
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
          if (this.data.stretched) {
            this.data.width = '100%';
          } else {
            this.data.width = 'auto';
          }
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

    // Adiciona botões de tamanho rápido
    const sizeWrapper = document.createElement('div');
    sizeWrapper.classList.add('image-settings', 'border-l', 'border-gray-600', 'pl-2', 'ml-2');

    const sizes = [
      { label: '25%', value: '25%' },
      { label: '50%', value: '50%' },
      { label: '75%', value: '75%' },
      { label: '100%', value: '100%' }
    ];

    sizes.forEach(size => {
      const button = document.createElement('div');
      button.classList.add('cdx-settings-button');
      button.innerHTML = size.label;
      button.title = `Largura ${size.label}`;
      button.style.fontSize = '11px';
      button.style.padding = '4px 6px';

      if (this.data.width === size.value) {
        button.classList.add('cdx-settings-button--active');
      }

      button.addEventListener('click', () => {
        this.data.width = size.value;
        this.data.stretched = false;
        this.renderImage();
      });

      sizeWrapper.appendChild(button);
    });

    wrapper.appendChild(sizeWrapper);

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
