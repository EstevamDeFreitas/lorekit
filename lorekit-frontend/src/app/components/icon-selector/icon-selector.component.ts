import { NgClass } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, input, OnInit, output, signal, Directive, ViewContainerRef, ElementRef, OnDestroy } from '@angular/core';
import { Overlay, OverlayRef, ConnectedPosition } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { InputComponent } from '../input/input.component';
import { ICONS_AVAILABLE } from '../../models/icons_simplified';

interface Icon {
  label: string;
  iconCode: string;
}

interface IconsData {
  availableIcons: Icon[];
}

@Component({
  selector: 'app-icon-selector-overlay',
  imports: [NgClass, InputComponent],
  template: `
    <div class="bg-zinc-900 p-4 rounded-md w-96 shadow-lg border border-zinc-700">
      <div class="mb-3 font-semibold text-white">Selecionar Ícone</div>
      <div class="flex flex-col gap-4">
        <app-input
          label="Buscar"
          [(value)]="searchTerm"
          (valueChange)="filterIcons()"
          placeholder="Digite para buscar..."
        ></app-input>

        <div class="grid grid-cols-6 gap-2 max-h-56 overflow-y-auto scrollbar-dark">
          @for (icon of filteredIcons(); track icon.iconCode) {
            <button
              (click)="selectIcon(icon)"
              [class.bg-blue-500]="selectedIcon()?.iconCode === icon.iconCode"
              class="p-3 bg-zinc-700 hover:bg-zinc-600 rounded-md flex items-center justify-center transition-colors"
              [title]="icon.label"
            >
              <i class="fa-solid text-xl" [ngClass]="icon.iconCode"></i>
            </button>
          }
          @empty {
            <p class="col-span-6 text-center text-zinc-500 text-sm">Nenhum ícone encontrado</p>
          }
        </div>
      </div>
    </div>
  `,
  styleUrl: './icon-selector.component.css',
})
export class IconSelectorOverlayComponent implements OnInit {
  private http = inject(HttpClient);

  icons = signal<Icon[]>([]);
  filteredIcons = signal<Icon[]>([]);
  selectedIcon = signal<Icon | null>(null);
  searchTerm = '';

  initialIcon = input<string>('');
  onIconSelect = output<Icon>();

  ngOnInit(): void {
    this.loadIcons();
  }

  loadIcons() {
    this.icons.set(ICONS_AVAILABLE);
    this.filteredIcons.set(ICONS_AVAILABLE);

    if (this.initialIcon()) {
      const found = ICONS_AVAILABLE.find(i => i.iconCode === this.initialIcon());
      if (found) {
        this.selectedIcon.set(found);
      }
    }
  }

  selectIcon(icon: Icon) {
    this.selectedIcon.set(icon);
    this.onIconSelect.emit(icon);
  }

  filterIcons() {
    const term = this.searchTerm.toLowerCase();
    this.filteredIcons.set(this.icons().filter(icon => icon.label.toLowerCase().includes(term) || icon.iconCode.toLowerCase().includes(term)));
  }
}

@Directive({
  selector: '[appIconSelector]'
})
export class IconSelectorDirective implements OnInit, OnDestroy {
  private overlay = inject(Overlay);
  private viewContainerRef = inject(ViewContainerRef);
  private elementRef = inject(ElementRef);

  selectedIcon = input<string>('fa-question');
  positions = input<ConnectedPosition[]>([
    {
      originX: 'end',
      originY: 'bottom',
      overlayX: 'end',
      overlayY: 'top',
      offsetY: 8
    },
    {
      originX: 'start',
      originY: 'bottom',
      overlayX: 'start',
      overlayY: 'top',
      offsetY: 8
    }
  ]);

  onIconSelected = output<Icon>();
  onToggle = output<boolean>();

  private overlayRef: OverlayRef | null = null;
  private isOpen = signal(false);

  ngOnInit() {
    this.elementRef.nativeElement.addEventListener('click', this.toggle.bind(this));
  }

  ngOnDestroy() {
    this.close();
    if (this.elementRef?.nativeElement) {
      this.elementRef.nativeElement.removeEventListener('click', this.toggle.bind(this));
    }
  }

  private toggle() {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  private open() {
    if (this.overlayRef) {
      return;
    }

    const positionStrategy = this.overlay.position()
      .flexibleConnectedTo(this.elementRef)
      .withPositions(this.positions())
      .withPush(false);

    this.overlayRef = this.overlay.create({
      positionStrategy,
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-transparent-backdrop',
      scrollStrategy: this.overlay.scrollStrategies.reposition()
    });

    const componentPortal = new ComponentPortal(IconSelectorOverlayComponent);
    const componentRef = this.overlayRef.attach(componentPortal);

    componentRef.setInput('initialIcon', this.selectedIcon());

    componentRef.instance.onIconSelect.subscribe((icon) => {
      this.onIconSelected.emit(icon);
      this.close();
    });

    this.overlayRef.backdropClick().subscribe(() => {
      this.close();
    });

    this.overlayRef.keydownEvents().subscribe((event) => {
      if (event.key === 'Escape') {
        this.close();
      }
    });

    this.isOpen.set(true);
    this.onToggle.emit(true);
  }

  private close() {
    if (this.overlayRef) {
      this.overlayRef.dispose();
      this.overlayRef = null;
      this.isOpen.set(false);
      this.onToggle.emit(false);
    }
  }
}

@Component({
  selector: 'app-icon-selector',
  imports: [NgClass, IconSelectorDirective],
  template: `
  <button
    appIconSelector
    [selectedIcon]="selectedIcon()"
    (onIconSelected)="handleIconSelected($event)"
    class="cursor-pointer hover:brightness-85 active:brightness-70 bg-zinc-800 px-2 py-0.5 rounded-md font-medium focus:outline-none transition text-base">
    <i class="fa-solid" [ngClass]="getCurrentIcon()"></i>
  </button>`,
  styleUrl: './icon-selector.component.css',
})
export class IconSelectorComponent {
  selectedIcon = input<string>('');
  onIconSelected = output<Icon>();

  getCurrentIcon() {
    return this.selectedIcon() ? this.selectedIcon() : 'fa-question';
  }

  handleIconSelected(icon: Icon) {
    this.onIconSelected.emit(icon);
  }
}
