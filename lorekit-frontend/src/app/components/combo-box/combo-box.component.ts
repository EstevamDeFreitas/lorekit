import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  HostListener,
  input,
  model,
  signal,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';

@Component({
  imports: [FormsModule, NgClass],
  selector: 'app-combo-box',
  template: `
    <div class="flex flex-col relative" #container>
      <label class="block text-xs font-medium">{{ label() }}</label>

      <!-- Trigger input -->
      <div
        class="rounded-lg px-3 py-2 text-sm bg-zinc-925 border-zinc-800 border transition focus-within:border-zinc-100 focus-within:bg-zinc-925 cursor-pointer flex items-center gap-2"
        (click)="openDropdown()"
      >
        <input
          #searchInput
          type="text"
          class="flex-1 bg-transparent outline-none text-sm placeholder-zinc-500 cursor-pointer"
          [placeholder]="displaySelected() || placeholder()"
          [ngClass]="displaySelected() ? 'text-white' : 'text-zinc-400'"
          [ngModel]="searchTerm()"
          (ngModelChange)="searchTerm.set($event)"
          (focus)="openDropdown()"
          (keydown.escape)="closeDropdown()"
          (keydown.arrowDown)="moveFocus(1)"
          (keydown.arrowUp)="moveFocus(-1)"
          (keydown.enter)="selectFocused()"
        />
        @if (displaySelected()) {
          <button
            type="button"
            class="text-zinc-500 hover:text-white transition text-xs leading-none"
            (click)="clearSelection($event)"
          >✕</button>
        }
        <button
          type="button"
          class="text-zinc-500 text-xs transition-transform duration-150"
          [ngClass]="isOpen() ? 'rotate-180' : ''"
          (click)="$event.stopPropagation(); toggleDropdown()"
        >▾</button>
      </div>

      <!-- Dropdown -->
      @if (isOpen()) {
        <div class="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg bg-zinc-900 border border-zinc-700 shadow-xl max-h-56 overflow-y-auto scrollbar-dark">
          <!-- None option -->
          <div
            class="px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 cursor-pointer transition"
            [ngClass]="focusedIndex() === 0 ? 'bg-zinc-800' : ''"
            (mouseenter)="focusedIndex.set(0)"
            (click)="selectItem(null)"
          >-- Nenhum --</div>

          @for (item of filteredItems(); track $index) {
            <div
              class="px-3 py-2 text-sm hover:bg-zinc-800 cursor-pointer transition"
              [ngClass]="{
                'bg-zinc-700': isSelected(item),
                'bg-zinc-800': focusedIndex() === $index + 1 && !isSelected(item)
              }"
              (mouseenter)="focusedIndex.set($index + 1)"
              (click)="selectItem(item)"
            >{{ getDisplay(item) }}</div>
          }

          @if (filteredItems().length === 0) {
            <div class="px-3 py-2 text-sm text-zinc-500 italic">Nenhuma opção encontrada</div>
          }
        </div>
      }
    </div>
  `,
  styleUrl: './combo-box.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComboBoxComponent {
  label = input.required<string>();
  items = input.required<any[]>();
  compareProp = input<string>('');
  displayProp = input<string>('');
  comboValue = model<any>('');
  placeholder = input<string>('Selecione...');
  size = input<string>('md');
  clearable = input<boolean>(false);

  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;
  @ViewChild('container') container!: ElementRef<HTMLElement>;

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

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
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
