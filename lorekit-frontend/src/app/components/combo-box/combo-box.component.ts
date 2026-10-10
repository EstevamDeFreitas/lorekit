import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  model,
  signal,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DOCUMENT } from '@angular/common';
import { ConnectedPosition, OverlayModule } from '@angular/cdk/overlay';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';

@Component({
  imports: [FormsModule, OverlayModule],
  selector: 'app-combo-box',
  templateUrl: './combo-box.component.html',
  styleUrl: './combo-box.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:resize)': 'closeDropdown()' },
})
export class ComboBoxComponent {
  label = input.required<string>();
  labelColor = input<string | null>(null);
  items = input.required<any[]>();
  compareProp = input<string>('');
  displayProp = input<string>('');
  comboValue = model<any>('');
  placeholder = input<string>('Selecione...');
  size = input<string>('base');
  clearable = input<boolean>(false);

  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;
  @ViewChild('container') container!: ElementRef<HTMLElement>;

  // Render above cards and outside ancestor overflow/stacking contexts.
  readonly dropdownPositions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
  ];

  constructor() {
    // Native scrolling containers are not necessarily registered with CDK.
    fromEvent(inject(DOCUMENT), 'scroll', { capture: true })
      .pipe(takeUntilDestroyed())
      .subscribe(event => {
        const target = event.target as Node | null;
        if (this.isOpen() && target?.contains(this.container.nativeElement)) {
          this.closeDropdown();
        }
      });
  }

  isOpen = signal(false);
  searchTerm = signal('');
  focusedIndex = signal(-1);

  filteredItems = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this.items();
    return this.items().filter(item => {
      const display = this.getDisplay(item).toLowerCase();
      return display.includes(term);
    });
  });

  displaySelected = computed(() => {
    const val = this.comboValue();
    if (val === null || val === '' || val === undefined) return '';
    const found = this.items().find(item =>
      this.isObject(item) ? item[this.compareProp()] === val : item === val
    );
    if (!found) return String(val);
    return this.getDisplay(found);
  });

  onOutsideClick(event: MouseEvent) {
    if (this.container && !this.container.nativeElement.contains(event.target as Node)) {
      this.closeDropdown();
    }
  }

  toggleDropdown() {
    this.isOpen() ? this.closeDropdown() : this.openDropdown();
  }

  openDropdown() {
    if (this.isOpen()) return;
    this.isOpen.set(true);
    this.searchTerm.set('');
    this.focusedIndex.set(-1);
    setTimeout(() => this.searchInput?.nativeElement.focus(), 0);
  }

  closeDropdown() {
    this.isOpen.set(false);
    this.searchTerm.set('');
    this.focusedIndex.set(-1);
  }

  onSearchChange() {
    this.focusedIndex.set(-1);
    this.isOpen.set(true);
  }

  selectItem(item: any) {
    if (item === null) {
      this.comboValue.set(null);
    } else {
      this.comboValue.set(this.isObject(item) ? item[this.compareProp()] : item);
    }
    this.closeDropdown();
  }

  clearSelection(event: MouseEvent) {
    event.stopPropagation();
    this.comboValue.set(null);
    this.closeDropdown();
  }

  isSelected(item: any): boolean {
    const val = this.comboValue();
    if (val === null || val === '' || val === undefined) return false;
    return this.isObject(item) ? item[this.compareProp()] === val : item === val;
  }

  moveFocus(direction: number) {
    const max = this.filteredItems().length; // +1 for "Nenhum", index 0
    const current = this.focusedIndex();
    const next = Math.max(0, Math.min(max, current + direction));
    this.focusedIndex.set(next);
  }

  selectFocused() {
    const idx = this.focusedIndex();
    if (idx === 0) {
      this.selectItem(null);
    } else if (idx > 0) {
      this.selectItem(this.filteredItems()[idx - 1]);
    }
  }

  getDisplay(item: any): string {
    if (this.isObject(item)) return String(item[this.displayProp()] ?? '');
    return String(item);
  }

  isObject(item: any): boolean {
    return typeof item === 'object' && item !== null;
  }
}
