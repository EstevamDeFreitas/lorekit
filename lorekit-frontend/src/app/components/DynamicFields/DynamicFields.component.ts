import { Component, inject, input, OnInit } from '@angular/core';
import { DynamicFieldService } from '../../services/dynamic-field.service';
import { ComboBoxComponent } from "../combo-box/combo-box.component";
import { InputComponent } from "../input/input.component";
import { DynamicField } from '../../models/dynamicfields.model';
import { EditorComponent } from "../editor/editor.component";

@Component({
  selector: 'app-dynamic-fields',
  imports: [ComboBoxComponent, InputComponent, EditorComponent],
  template: `
    <div class="grid grid-cols-3 md:grid-cols-2 gap-4">
      @for(field of fields; track field.template.id) {
        @if (isFieldComboBox(field.template)) {
            <app-combo-box
              [label]="field.name"
              [items]="getFieldOptions(field.template)"
              [(comboValue)]="field.value"
              [clearable]="true"
              (comboValueChange)="save()"
              >
            </app-combo-box>
          }
          @else if (field.template.isEditorField) {
            <div>
              <div class="">
                <div class=" text-sm text-white mb-1">{{ field.name }}</div>
              </div>
              <div class="rounded-lg border border-zinc-800 bg-zinc-925 h-96 overflow-y-auto scrollbar-dark">
                <app-editor [docTitle]="field.template.name" [entityTable]="entityTable()" [entityName]="field.template.name" [document]="field.value || ''" (saveDocument)="onEditorSave($event, field.template.id)" class="w-full"></app-editor>
              </div>
            </div>

          }
          @else {
            <app-input
              [label]="field.name"
              [type]="'text'"
              [(value)]="field.value"
              (valueChange)="save()"
              >
            </app-input>
          }
      }
    </div>

    `,
  styleUrl: './DynamicFields.component.css',
})
export class DynamicFieldsComponent implements OnInit {
  entityTable = input.required<string>();
  entityId = input.required<string>();

  private dynamicFieldService = inject(DynamicFieldService);

  saveTimeout!: ReturnType<typeof setTimeout>;

  fields: any[] = [];

  ngOnInit(): void {
    let fields = this.dynamicFieldService.getDynamicFields(this.entityTable());
    let values = this.dynamicFieldService.getEntityDynamicFieldsValues(this.entityTable(), this.entityId());

    console.log(values);


    fields.forEach((field: DynamicField) => {
      this.fields.push({
        template: field,
        name: field.name,
        fieldValueId: values.find((v: any) => v.ParentDynamicField?.id == field.id)?.id || '',
        value: values.find((v: any) => v.ParentDynamicField?.id == field.id)?.value || ''
      });
    });

    console.log(this.fields);


  }

  isFieldComboBox(field: any): boolean {
    return field.options != null && field.options != '';
  }

  getFieldOptions(field: any): string[] {
    return field.options.split(';').map((option: string) => option.trim());
  }

  save() {
    clearTimeout(this.saveTimeout);

    this.saveTimeout = setTimeout(() => {
      let values = this.fields.map(field => {
        return {id: field.fieldValueId, value: field.value, ParentDynamicField: field.template};
      });

      console.log(values);


      this.dynamicFieldService.saveEntityDynamicFieldsValues(this.entityTable(), this.entityId(), values);
    }, 250);


  }

  onEditorSave($event: any, fieldId: string) {
    this.fields.forEach((field) => {
      if (field.template.id === fieldId) {
        field.value = JSON.stringify($event);
      }
    });
    this.save();
    }

}
