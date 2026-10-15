import { DOCUMENT } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { CdkConnectedOverlay, ConnectedPosition, OverlayModule } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, ViewChild, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';
import { CalendarDatePickerComponent } from '../calendar-date-picker/calendar-date-picker.component';
import { ComboBoxComponent } from '../combo-box/combo-box.component';
import { CalendarService } from '../../services/calendar.service';
import { WorldService } from '../../services/world.service';
import { CalendarBinding, CalendarDate } from '../../models/calendar.model';
import { parseCalendarDate } from '../../utils/calendar-engine';
import { parseCalendarFieldOptions } from '../../utils/calendar-field-options';

@Component({
  selector: 'app-calendar-date-field', imports: [OverlayModule, A11yModule, ComboBoxComponent, CalendarDatePickerComponent],
  templateUrl: './calendar-date-field.component.html', styleUrls: ['../calendar-controls.css', './calendar-date-field.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush, host: { '(window:resize)': 'close()' },
})
export class CalendarDateFieldComponent {
  private readonly service = inject(CalendarService);
  private readonly worldService = inject(WorldService);
  readonly entityTable = input.required<string>(); readonly entityId = input.required<string>();
  readonly options = input<string | null | undefined>(''); readonly value = input(''); readonly label = input('Data do calendário');
  readonly labelColor = input<string | null>(null); readonly valueChange = output<string>();
  readonly fieldId = 'calendar-date-' + crypto.randomUUID();
  readonly isOpen = signal(false); readonly panelWidth = signal(420);
  readonly worldId = signal(''); readonly selectedCalendarId = signal(''); readonly error = signal('');
  @ViewChild('container') container?: ElementRef<HTMLElement>;
  @ViewChild(CdkConnectedOverlay) panelOverlay?: CdkConnectedOverlay;
  private panelObserver?: ResizeObserver;
  readonly dropdownPositions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
  ];
  readonly config = computed(() => { try { return parseCalendarFieldOptions(this.options()); } catch { return null; } });
  readonly date = computed(() => { try { return parseCalendarDate(this.value()); } catch { return null; } });
  readonly worlds = computed(() => { const ids = this.service.worldsForEntity(this.entityTable(), this.entityId()); return this.worldService.getWorlds().filter(w => ids.includes(w.id)); });
  readonly calendars = computed(() => this.service.list(this.worldId()));
  readonly binding = computed<CalendarBinding | null>(() => {
    const config = this.config(); if (!config || !this.worldId()) return null;
    if (config.mode === 'fixed') return config.bindings[this.worldId()] ?? null;
    const id = this.selectedCalendarId(), current = this.date(), calendar = this.calendars().find(c => c.id === id);
    return calendar ? { calendarId: calendar.id, revisionId: current?.calendarId === id ? current.revisionId : calendar.latestRevisionId, ...(config.formatId ? { formatId: config.formatId } : {}) } : null;
  });
  readonly pickerValue = computed(() => {
    const date = this.date(), binding = this.binding();
    return date && binding && date.calendarId === binding.calendarId && date.revisionId === binding.revisionId ? date : null;
  });
  readonly display = computed(() => {
    if (!this.value()) return { text: '', title: '' };
    try {
      const date = this.date(); if (!date) throw new Error('Data inválida.');
      const { calendar, engine } = this.service.resolve(date);
      const fixed = this.config()?.mode === 'fixed' ? this.config()?.bindings[calendar.worldId] : undefined;
      const text = engine.format(date, fixed?.formatId ?? this.config()?.formatId, fixed?.countId);
      return { text, title: text + ' · ' + calendar.name };
    } catch { return { text: 'Data indisponível', title: 'O valor original foi preservado. Abra a seleção para revisar a data.' }; }
  });
  readonly dependencyError = computed(() => {
    try {
      if (!this.config()) return 'Configuração de data inválida. O valor foi preservado.';
      if (this.value() && !this.date()) return 'Data indisponível. O valor original foi preservado.';
      if (this.date()) {
        const date = this.date()!; this.service.validateDate(date);
        const calendar = this.service.get(date.calendarId);
        if (!calendar || !this.worlds().some(w => w.id === calendar.worldId)) return 'O calendário da data não pertence aos mundos desta entidade. O valor foi preservado.';
      }
      if (this.binding()) this.service.resolve(this.binding()!, this.worldId());
      return '';
    } catch (e) { return e instanceof Error ? e.message : 'Dependência indisponível.'; }
  });
  constructor() {
    inject(DestroyRef).onDestroy(() => this.panelObserver?.disconnect());
    effect(() => { this.date(); this.worlds(); untracked(() => this.initializeSelection()); });
    // Match combobox behavior: ancestor scrolling closes the detached panel; its own scrolling does not.
    fromEvent(inject(DOCUMENT), 'scroll', { capture: true }).pipe(takeUntilDestroyed()).subscribe(event => {
      const target = event.target as Node | null;
      if (this.isOpen() && this.container && target?.contains(this.container.nativeElement)) this.close();
    });
  }
  private initializeSelection(): void {
    const date = this.date(), worlds = this.worlds(), saved = date ? this.service.get(date.calendarId) : null;
    const world = saved && worlds.some(w => w.id === saved.worldId) ? saved.worldId : worlds.length === 1 ? worlds[0].id : '';
    this.worldId.set(world);
    const choices = this.service.list(world);
    this.selectedCalendarId.set(saved?.worldId === world ? saved.id : choices.length === 1 ? choices[0].id : '');
  }
  open(): void {
    if (this.isOpen()) return;
    this.initializeSelection(); this.error.set('');
    this.panelWidth.set(Math.max(1, Math.min(420, window.innerWidth - 16))); this.isOpen.set(true);
  }
  attached(): void {
    this.panelObserver?.disconnect();
    const overlay = this.panelOverlay?.overlayRef; if (!overlay) return;
    this.panelObserver = new ResizeObserver(() => { if (this.isOpen()) overlay.updatePosition(); });
    this.panelObserver.observe(overlay.overlayElement);
  }
  close(): void { this.panelObserver?.disconnect(); this.isOpen.set(false); }
  toggle(): void { this.isOpen() ? this.close() : this.open(); }
  selectWorld(value: string | null): void { this.worldId.set(value ?? ''); const choices = this.calendars(); this.selectedCalendarId.set(choices.length === 1 ? choices[0].id : ''); this.error.set(''); }
  selectCalendar(value: string | null): void { this.selectedCalendarId.set(value ?? ''); this.error.set(''); }
  outside(event: MouseEvent): void { if (!this.container?.nativeElement.contains(event.target as Node)) this.close(); }
  keydown(event: KeyboardEvent): void { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.close(); } }
  update(value: CalendarDate | null): void {
    try {
      if (value) {
        if (!this.worlds().some(w => w.id === this.worldId())) throw new Error('Escolha um mundo desta entidade.');
        this.service.validateDate(value, this.worldId());
        const binding = this.binding();
        if (!binding || value.calendarId !== binding.calendarId || value.revisionId !== binding.revisionId) throw new Error('Selecione um calendário permitido para o campo.');
        if (value.time && !this.config()?.allowTime) throw new Error('Este campo não permite horário.');
      }
      this.error.set(''); this.valueChange.emit(value ? JSON.stringify(value) : ''); this.close();
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Data inválida.'); }
  }
}
