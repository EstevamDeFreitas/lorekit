import { ChangeDetectionStrategy, Component, inject, input, OnChanges, output, signal, SimpleChanges } from '@angular/core';
import { ConnectedPosition, Overlay, OverlayModule } from '@angular/cdk/overlay';
import { A11yModule } from '@angular/cdk/a11y';
import { FormsModule } from '@angular/forms';
import { ChartFieldOptions, ChartFieldValue, ChartSeriesOptions, parseChartValue, reconcileRadarValue, serializeChartValue } from '../../models/dynamicfields.model';

interface ChartRow { label: string; values: number[]; }

@Component({
  selector: 'app-dynamic-chart-field',
  imports: [FormsModule, OverlayModule, A11yModule],
  templateUrl: './dynamic-chart-field.component.html',
  styleUrl: './dynamic-chart-field.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DynamicChartFieldComponent implements OnChanges {
  readonly editorOpen = signal(false);
  readonly editorScrollStrategy = inject(Overlay).scrollStrategies.reposition();
  readonly editorPositions: ConnectedPosition[] = [
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 8 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -8 },
  ];
  private savedRows: ChartRow[] = [];
  readonly label = input.required<string>();
  readonly labelColor = input<string | null>(null);
  readonly config = input.required<ChartFieldOptions>();
  readonly value = input<string>('');
  readonly valueChange = output<string>();

  readonly radarCenterX = 260;
  readonly radarCenterY = 140;
  private readonly radarRadius = 92;
  private readonly chartLeft = 58;
  private readonly chartTop = 28;
  private readonly chartWidth = 420;
  private readonly chartHeight = 200;
  draftRows: ChartRow[] = [];
  errorMessage = '';

  ngOnChanges(_changes: SimpleChanges): void {
    if (this.editorOpen()) return;
    this.draftRows = this.toRows(parseChartValue(this.value()));
  }

  openEditor(): void {
    this.savedRows = this.draftRows.map(row => ({ ...row, values: [...row.values] }));
    this.errorMessage = '';
    this.editorOpen.set(true);
  }

  cancelEditor(): void {
    if (!this.editorOpen()) return;
    this.draftRows = this.savedRows;
    this.errorMessage = '';
    this.editorOpen.set(false);
  }

  saveEditor(): void {
    if (this.draftRows.some(row => !row.label.trim())) {
      this.errorMessage = 'Informe um nome para cada categoria.';
      return;
    }
    this.editorOpen.set(false);
    this.emitValue();
  }

  onEditorKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    this.cancelEditor();
  }

  chartSeries(): ChartSeriesOptions[] {
    if (this.config().chartType === 'radar') return [{ id: 'series-1', label: 'Valor', color: this.config().color }];
    return this.config().series?.length ? this.config().series : [{ id: 'series-1', label: 'Serie 1', color: this.config().color }];
  }

  chartTypeLabel(): string {
    return this.config().chartType === 'bar' ? 'Barra' : this.config().chartType === 'line' ? 'Linha' : 'Radar';
  }

  accessibleLabel(): string {
    if (this.config().chartType === 'radar') return `${this.config().title || this.label()} (Radar: ${(this.config().categories ?? []).join(', ')})`;
    return `${this.config().title || this.label()} (${this.chartTypeLabel()}: ${this.chartSeries().map(series => series.label).join(', ')})`;
  }

  addRow(): void {
    if (this.config().chartType === 'radar') return;
    if (this.draftRows.length >= 12) {
      this.errorMessage = 'O grafico aceita no maximo 12 categorias.';
      return;
    }
    this.draftRows = [...this.draftRows, { label: `Item ${this.draftRows.length + 1}`, values: this.chartSeries().map(() => 0) }];
    this.emitValue();
  }

  removeRow(index: number): void {
    if (this.config().chartType === 'radar') return;
    this.draftRows = this.draftRows.filter((_row, currentIndex) => currentIndex !== index);
    this.errorMessage = '';
    this.emitValue();
  }

  setLabel(index: number, label: string): void {
    if (this.config().chartType === 'radar') return;
    this.draftRows = this.draftRows.map((row, currentIndex) => currentIndex === index ? { ...row, label } : row);
    this.errorMessage = '';
    this.emitValue();
  }

  setValue(rowIndex: number, seriesIndex: number, value: unknown): void {
    const numeric = Number(value);
    this.draftRows = this.draftRows.map((row, currentIndex) => {
      if (currentIndex !== rowIndex) return row;
      const values = [...row.values];
      values[seriesIndex] = Number.isFinite(numeric) ? this.config().chartType === 'radar' ? Math.max(0, numeric) : numeric : 0;
      return { ...row, values };
    });
    this.errorMessage = '';
    this.emitValue();
  }

  radarLevels(): number[] { return [0.25, 0.5, 0.75, 1]; }

  radarGridPoints(level: number): string { return this.polarPoints(this.radarRadius * level); }
  radarGridCircleRadius(level: number): number { return this.radarRadius * level; }
  radarDataPoints(seriesIndex: number): string { return this.draftRows.map((_row, index) => `${this.radarDataX(index, seriesIndex)},${this.radarDataY(index, seriesIndex)}`).join(' '); }
  radarAxisX(index: number): number { return this.polarPoint(index, this.draftRows.length, this.radarRadius).x; }
  radarAxisY(index: number): number { return this.polarPoint(index, this.draftRows.length, this.radarRadius).y; }
  radarDataX(index: number, seriesIndex: number): number { return this.polarPoint(index, this.draftRows.length, this.radarValueRadius(this.draftRows[index]?.values[seriesIndex] ?? 0)).x; }
  radarDataY(index: number, seriesIndex: number): number { return this.polarPoint(index, this.draftRows.length, this.radarValueRadius(this.draftRows[index]?.values[seriesIndex] ?? 0)).y; }
  radarLabelX(index: number): number { return this.polarPoint(index, this.draftRows.length, this.radarRadius + 18).x; }
  radarLabelY(index: number): number { return this.polarPoint(index, this.draftRows.length, this.radarRadius + 18).y + 4; }
  radarTextAnchor(index: number): string {
    const point = this.polarPoint(index, this.draftRows.length, this.radarRadius + 18);
    return point.x < this.radarCenterX - 4 ? 'end' : point.x > this.radarCenterX + 4 ? 'start' : 'middle';
  }

  barX(rowIndex: number, seriesIndex: number): number {
    const slot = this.chartWidth / Math.max(1, this.draftRows.length);
    const groupWidth = this.barWidth() * this.chartSeries().length;
    return this.chartLeft + rowIndex * slot + (slot - groupWidth) / 2 + seriesIndex * this.barWidth();
  }
  barCenterX(index: number): number { return this.chartLeft + ((index + 0.5) / Math.max(1, this.draftRows.length)) * this.chartWidth; }
  barWidth(): number { return Math.max(6, Math.min(28, this.chartWidth / Math.max(1, this.draftRows.length) / Math.max(1, this.chartSeries().length) - 4)); }
  barY(value: number): number { return this.scaleY(value); }
  barHeight(value: number): number { return Math.max(1, Math.abs(this.scaleY(value) - this.scaleY(0))); }
  lineX(index: number): number { return this.chartLeft + (this.draftRows.length === 1 ? this.chartWidth / 2 : (index / (this.draftRows.length - 1)) * this.chartWidth); }
  lineY(value: number): number { return this.scaleY(value); }
  linePoints(seriesIndex: number): string { return this.draftRows.map((row, index) => `${this.lineX(index)},${this.lineY(row.values[seriesIndex] ?? 0)}`).join(' '); }

  shortLabel(label: string): string { return label.length > 14 ? `${label.slice(0, 13)}…` : label; }

  private toRows(value: ChartFieldValue): ChartRow[] {
    if (this.config().chartType === 'radar') {
      const radar = reconcileRadarValue(this.config(), value);
      return radar.labels.map((label, index) => ({ label, values: [radar.series[0].values[index]] }));
    }
    const series = this.chartSeries();
    return value.labels.map((label, rowIndex) => ({
      label,
      values: series.map((configuredSeries, seriesIndex) => {
        const source = value.series.find(item => item.id === configuredSeries.id) ?? value.series[seriesIndex];
        return Number.isFinite(source?.values[rowIndex]) ? source.values[rowIndex] : 0;
      }),
    }));
  }

  private emitValue(): void {
    if (this.editorOpen()) return;
    const value = {
      labels: this.draftRows.map(row => row.label),
      series: this.chartSeries().map((series, seriesIndex) => ({ id: series.id, values: this.draftRows.map(row => row.values[seriesIndex] ?? 0) })),
    } satisfies ChartFieldValue;
    this.valueChange.emit(serializeChartValue(value));
  }

  private chartMin(): number { return Math.min(0, ...this.draftRows.flatMap(row => row.values)); }
  private chartMax(): number { return Math.max(1, ...this.draftRows.flatMap(row => row.values)); }
  private scaleY(value: number): number { return this.chartTop + ((this.chartMax() - value) / (this.chartMax() - this.chartMin())) * this.chartHeight; }
  private radarValueRadius(value: number): number { return this.radarRadius * Math.max(0, value) / this.chartMax(); }

  private polarPoints(radius: number): string {
    return this.draftRows.map((_row, index) => {
      const point = this.polarPoint(index, this.draftRows.length, radius);
      return `${point.x},${point.y}`;
    }).join(' ');
  }

  private polarPoint(index: number, total: number, radius: number): { x: number; y: number } {
    const angle = -Math.PI / 2 + (index / Math.max(1, total)) * Math.PI * 2;
    return { x: this.radarCenterX + Math.cos(angle) * radius, y: this.radarCenterY + Math.sin(angle) * radius };
  }
}
