import { ChangeDetectionStrategy, Component, input, model, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';

@Component({
  imports: [FormsModule, NgClass],
  selector: 'app-combo-box',
  template: `
    <div class="flex flex-col">
      <label class="block text-xs font-medium">{{ label() }}</label>
      <select
        [(ngModel)]="comboValue"
        [ngClass]="'text-' + size()"
        class="rounded-lg px-3 py-2 ring-1 bg-zinc-925 ring-zinc-800 transition focus:outline-none focus:ring-zinc-100 focus:bg-zinc-925  focus:ring-1"
      >
        <option value="" disabled selected hidden>{{ placeholder() }}</option>
        @for (item of items(); track item){
          @if (isObject(item)){
            <option [ngValue]="item[compareProp()]" >{{item[displayProp()]}}</option>
          }
          @else {
            <option [ngValue]="item">{{ item }}</option>
          }
        }
      </select>
    </div>
  `,
  styleUrl: './combo-box.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComboBoxComponent implements OnInit {
  label = input.required<string>();
  items = input.required<any[]>();
  compareProp = input<string>('');
  displayProp = input<string>('');
  comboValue = model<any>('');
  placeholder = input<string>('Selecione...');
  size = input<string>('md');

  ngOnInit() {
    if (this.comboValue() === '' && this.items()?.length > 0) {
      setTimeout(() => {
        this.comboValue.set(this.items()[0]);
      });
    }
  }

  isObject(item: any): boolean {
    return typeof item === 'object' && item !== null;
  }
}
