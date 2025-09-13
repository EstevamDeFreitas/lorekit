export default class TailwindHeader {
  data: any;
  _CSS: any;
  _settings: any;
  api: any;
  tag: string = 'H2';

  static get isInline() {
    return false;
  }

  static get toolbox() {
    return {
      icon: '<i class="fa-solid fa-heading"></i>',
      title: 'Heading'
    };
  }

  static get tunes() {
    return [
      {
        name: 'level',
        icon: '<i class="fa-solid fa-text-height"></i>',
        title: 'Heading Level'
      }
    ];
  }

  constructor({data, config, api}: {data?: {text?: string, level?: number}, config?: any, api?: any}) {
    this.data = {
      level: (data && data.level) ? data.level : 2,
      text: (data && data.text) ? data.text : ''
    };

    this._CSS = {
      block: api?.styles?.block,
      wrapper: 'ce-header',
    };

    this.api = api;
    this._settings = config;
  }

  render() {
    const div = document.createElement('div');
    div.classList.add(this._CSS.wrapper);
    div.classList.add('focus:outline-none');

    if (this.data.level === 1) {
      div.classList.add('text-2xl', 'font-bold', 'text-white');
      this.tag = 'H1';
    } else if (this.data.level === 2) {
      div.classList.add('text-xl', 'font-bold', 'text-white');
      this.tag = 'H2';
    } else {
      div.classList.add('text-lg', 'font-bold', 'text-white');
      this.tag = 'H3';
    }

    div.setAttribute('data-level', this.data.level.toString());
    div.contentEditable = 'true';
    div.innerHTML = this.data.text;

    return div;
  }

  save(blockContent: any) {
    return {
      level: this.data.level,
      text: blockContent.innerHTML
    };
  }

  validate(savedData: any) {
    if (!savedData.text || !savedData.text.trim()) {
      return false;
    }
    return true;
  }

  renderSettings() {
    const wrapper = document.createElement('div');
    wrapper.classList.add('ce-header-settings');

    const titleLevels = [
      {
        name: 'Grande',
        level: 1,
        className: 'text-2xl'
      },
      {
        name: 'Médio',
        level: 2,
        className: 'text-xl'
      },
      {
        name: 'Pequeno',
        level: 3,
        className: 'text-lg'
      }
    ];

    titleLevels.forEach(levelConfig => {
      const button = document.createElement('button');
      button.classList.add('ce-settings__button');
      button.classList.add('header-level-btn');
      button.setAttribute('type', 'button');

      // Verifica se este nível está ativo
      if (this.data.level === levelConfig.level) {
        button.classList.add('ce-settings__button--active');
      }

      // Texto mais claro para os botões
      button.innerHTML = `<span class="text-white font-bold">H${levelConfig.level}</span>`;
      button.dataset['level'] = levelConfig.level.toString();
      button.title = levelConfig.name;

      button.addEventListener('click', () => {
        this.setLevel(levelConfig.level);
        this.updateSettingsButtons(wrapper);
      });

      wrapper.appendChild(button);
    });

    return wrapper;
  }

  setLevel(level: number) {
    this.data.level = level;

    // Atualiza o bloco atual
    try {
      const currentBlockIndex = this.api.blocks.getCurrentBlockIndex();
      const currentBlock = this.api.blocks.getBlockByIndex(currentBlockIndex);

      if (currentBlock && currentBlock.holder) {
        const headerElement = currentBlock.holder.querySelector(`.${this._CSS.wrapper}`);

        if (headerElement) {
          // Remove todas as classes de tamanho e espaçamento
          headerElement.classList.remove(
            'text-lg', 'text-xl', 'text-2xl',
            'mt-2', 'mt-4', 'mt-6',
            'mb-2', 'mb-3', 'mb-4'
          );

          // Adiciona as classes corretas baseadas no nível
          if (level === 1) {
            headerElement.classList.add('text-2xl', 'font-bold');
            this.tag = 'H1';
          } else if (level === 2) {
            headerElement.classList.add('text-xl', 'font-bold');
            this.tag = 'H2';
          } else {
            headerElement.classList.add('text-lg', 'font-bold');
            this.tag = 'H3';
          }

          headerElement.setAttribute('data-level', level.toString());
        }
      }
    } catch (error) {
      console.warn('Erro ao atualizar o elemento header:', error);
    }
  }

  updateSettingsButtons(wrapper: HTMLElement) {
    const buttons = wrapper.querySelectorAll('.ce-settings__button');

    buttons.forEach((button: any) => {
      const buttonLevel = parseInt(button.dataset.level);
      if (buttonLevel === this.data.level) {
        button.classList.add('ce-settings__button--active');
      } else {
        button.classList.remove('ce-settings__button--active');
      }
    });
  }

  static get sanitize() {
    return {
      level: false,
      text: {
        br: true
      }
    };
  }

  // Método para conversão de outros blocos
  static get conversionConfig() {
    return {
      export: 'text', // use 'text' property for other blocks
      import: 'text'  // fill 'text' property from other block's export string
    };
  }

  // Método para permitir conversão FROM outros tipos
  static get pasteConfig() {
    return {
      tags: ['H1', 'H2', 'H3', 'H4', 'H5', 'H6']
    };
  }
}
