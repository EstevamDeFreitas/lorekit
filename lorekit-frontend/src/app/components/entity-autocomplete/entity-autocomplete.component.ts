import { ChangeDetectionStrategy, Component, effect, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OverlayModule } from '@angular/cdk/overlay';
import { EntityMentionService, MentionEntity } from '../../services/entity-mention.service';

@Component({
  selector: 'app-entity-autocomplete',
  imports: [FormsModule, OverlayModule],
  templateUrl: './entity-autocomplete.component.html',
  styleUrl: './entity-autocomplete.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntityAutocompleteComponent {
  label = input.required<string>();
  placeholder = input('Pesquisar...');
  selectedEntity = input<MentionEntity | null>(null);
  allowedEntityKeys = input<ReadonlySet<string> | null>(null);

  entitySelected = output<MentionEntity>();
  entityCleared = output<void>();

  readonly inputId = `entity-autocomplete-${crypto.randomUUID()}`;
  readonly listId = `${this.inputId}-list`;

  searchTerm = '';
  results: MentionEntity[] = [];
  isOpen = false;
  activeIndex = 0;

  private readonly entityMentionService = inject(EntityMentionService);

  constructor() {
    effect(() => {
      this.searchTerm = this.selectedEntity()?.label ?? '';
      this.isOpen = false;
      this.results = [];
      this.activeIndex = 0;
    });
  }

  onFocus(): void {
    this.isOpen = true;
    this.updateResults();
  }

  onInput(term: string): void {
    this.searchTerm = term;
    this.isOpen = true;
    this.updateResults();
  }

  onBlur(): void {
    this.closeAndRestoreSelection();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isOpen) {
      event.preventDefault();
      this.closeAndRestoreSelection();
      return;
    }

    if (!this.isOpen || this.results.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeIndex = (this.activeIndex + 1) % this.results.length;
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex = (this.activeIndex + this.results.length - 1) % this.results.length;
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.selectEntity(this.results[this.activeIndex]);
    }
  }

  selectEntity(entity: MentionEntity): void {
    this.searchTerm = entity.label;
    this.isOpen = false;
    this.results = [];
    this.entitySelected.emit(entity);
  }

  clearSelection(inputElement: HTMLInputElement): void {
    this.searchTerm = '';
    this.isOpen = false;
    this.results = [];
    this.activeIndex = 0;
    this.entityCleared.emit();
    inputElement.focus();
  }

  onOverlayOutsideClick(): void {
    this.closeAndRestoreSelection();
  }

  optionId(entity: MentionEntity): string {
    return `${this.listId}-${encodeURIComponent(entity.entityTable)}-${encodeURIComponent(entity.entityId)}`;
  }

  get activeOptionId(): string | null {
    const entity = this.results[this.activeIndex];
    return this.isOpen && entity ? this.optionId(entity) : null;
  }

  private updateResults(): void {
    this.results = this.entityMentionService.search(
      this.searchTerm,
      8,
      this.allowedEntityKeys() ?? undefined,
    );
    this.activeIndex = 0;
  }

  private closeAndRestoreSelection(): void {
    this.isOpen = false;
    this.results = [];
    this.activeIndex = 0;
    this.searchTerm = this.selectedEntity()?.label ?? '';
  }
}
