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

        class="rounded-lg px-3 py-2 bg-zinc-925 border-zinc-800 border transition focus:outline-none focus:border-zinc-100 focus:bg-zinc-925  focus:border-1"
      >
        <option value="" disabled selected hidden>{{ placeholder() }}</option>
        <option [ngValue]="null">-- Nenhum --</option>
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
  clearable = input<boolean>(false);

  ngOnInit() {

  }

  isObject(item: any): boolean {
    return typeof item === 'object' && item !== null;
  }
}
