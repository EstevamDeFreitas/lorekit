import { Component, DestroyRef, inject } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { DbProvider } from '../../database/db-provider.service';
import { openSqliteDatabase } from '../../database/database.helper';
import { EntityHistoryContextDirective } from '../../directives/entity-history-context.directive';
import { HistoryFieldDirective } from '../../directives/history-field.directive';
import { EntityHistoryService } from '../../services/entity-history.service';
import { GlobalParameterService } from '../../services/global-parameter.service';
import { ImageService } from '../../services/image.service';
import { EntityMentionService } from '../../services/entity-mention.service';
import { EditorComponent } from '../editor/editor.component';
import { InputComponent } from '../input/input.component';
import { TextAreaComponent } from '../text-area/text-area.component';
import { EntityHistoryButtonsComponent } from './entity-history-buttons.component';
import { LorekitDocumentCodec } from '../editor/lorekit-document.codec';
import { LorekitDocument } from '../../models/lorekit-document.model';
import { FlushableDebounce } from '../../utils/flushable-debounce';

@Component({
  imports: [FormsModule, EntityHistoryContextDirective, HistoryFieldDirective, InputComponent, TextAreaComponent, EditorComponent, EntityHistoryButtonsComponent],
  template: `
    <app-entity-history-buttons />
    <input id="search-test" [(ngModel)]="search" />
    <div [historyEntity]="{ table: 'Character', id: model.id }" [historyModel]="model">
      <input id="name-test" historyField="name" [(ngModel)]="model.name" (ngModelChange)="save()" />
      <app-input historyField="concept" label="Conceito" [(value)]="model.concept" (valueChange)="save()" />
      <app-text-area historyField="description" label="Descrição" [(value)]="model.description" (valueChange)="save()" />
      @if (showEditor) {
        <app-editor historyField="background" [entityId]="model.id" entityTable="Character" [entityName]="model.name" [document]="model.background" (saveDocument)="saveRich($event)" />
      }
    </div>
  `,
})
class HistoryHarness {
  readonly db = inject(DbProvider);
  readonly saveTask = new FlushableDebounce(inject(DestroyRef), 500);
  model = { id: 'history-a', name: 'Original', concept: 'Concept', description: 'Description', background: '' };
  search = '';
  showEditor = true;
  save(): void { this.saveTask.schedule(() => this.db.getCrudHelper().update('Character', this.model.id, this.model)); }
  saveRich(document: LorekitDocument): void { this.model.background = JSON.stringify(document); this.save(); }
}

describe('Entity history integrated controls', () => {
  let fixture: ComponentFixture<HistoryHarness>;
  let db: DbProvider;
  let history: EntityHistoryService;
  let engine: 'tiptap' | 'editorjs';

  beforeEach(async () => {
    spyOn(console, 'log');
    engine = 'tiptap';
    TestBed.configureTestingModule({
      imports: [HistoryHarness],
      providers: [DbProvider, provideRouter([]),
        { provide: GlobalParameterService, useValue: { getParameter: (key: string) => key === 'textEditorEngine' ? engine : '' } },
        { provide: ImageService, useValue: {} },
        { provide: EntityMentionService, useValue: { search: async () => [], parseMentionHref: () => null, buildMentionHref: (table: string, id: string) => `lorekit://entity/${table}/${id}` } },
      ],
    });
    db = TestBed.inject(DbProvider);
    db.setDb(await openSqliteDatabase(), async () => undefined);
    db.getCrudHelper().create('Character', { id: 'history-a', name: 'Original', concept: 'Concept', description: 'Description', background: '' });
    history = TestBed.inject(EntityHistoryService);
  });

  afterEach(async () => {
    fixture?.destroy();
    await history.settle();
    await db.flushPendingWrites();
    db.close();
  });

  async function mount(): Promise<EditorComponent> {
    fixture = TestBed.createComponent(HistoryHarness);
    fixture.detectChanges();
    await fixture.whenStable();
    const editor = fixture.debugElement.query(By.directive(EditorComponent)).componentInstance as EditorComponent;
    if (editor.editor) await editor.editor.isReady;
    history.activate({ table: 'Character', id: 'history-a' });
    return editor;
  }

  async function type(selector: string, value: string, inputType = 'insertText'): Promise<void> {
    const control = fixture.nativeElement.querySelector(selector) as HTMLInputElement;
    control.focus();
    control.dispatchEvent(new InputEvent('beforeinput', { inputType, bubbles: true, cancelable: true }));
    control.value = value;
    control.dispatchEvent(new InputEvent('input', { inputType, bubbles: true }));
    await history.settle();
    fixture.detectChanges();
  }

  it('undoes across native and reusable fields without clearing redo on the next command', async () => {
    await mount();
    await type('#name-test', 'Alice');
    await type('app-text-area textarea', 'New description');
    await history.undo();
    expect(fixture.componentInstance.model.description).toBe('Description');
    await history.undo();
    expect(fixture.componentInstance.model.name).toBe('Original');
    await history.redo();
    await history.redo();
    expect(fixture.componentInstance.model.name).toBe('Alice');
    expect(fixture.componentInstance.model.description).toBe('New description');
    const row = db.getCrudHelper().findById('Character', 'history-a');
    expect(row.name).toBe('Alice');
    expect(row.description).toBe('New description');
  });

  it('uses keyboard and toolbar on the same sequence and leaves search alone', async () => {
    await mount();
    await type('#name-test', 'Alice');
    const name = fixture.nativeElement.querySelector('#name-test') as HTMLInputElement;
    name.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(fixture.componentInstance.model.name).toBe('Original');
    fixture.detectChanges();
    (fixture.nativeElement.querySelectorAll('app-entity-history-buttons button')[1] as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(fixture.componentInstance.model.name).toBe('Alice');
    await type('#search-test', 'query');
    const event = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true });
    fixture.nativeElement.querySelector('#search-test').dispatchEvent(event);
    expect(event.defaultPrevented).toBeFalse();
    expect(fixture.componentInstance.model.name).toBe('Alice');
  });

  it('keeps a composition as one operation', async () => {
    await mount();
    const control = fixture.nativeElement.querySelector('#name-test') as HTMLInputElement;
    control.focus();
    control.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    control.value = 'Texto composto';
    control.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }));
    expect(history.canUndo()).toBeFalse();
    control.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
    await history.settle();
    await history.undo();
    expect(control.value).toBe('Original');
  });

  it('targets the focused entity and excludes a configuration dialog', async () => {
    await mount();
    await type('#name-test', 'Alice');
    const other = { table: 'Character', id: 'history-b' };
    db.getCrudHelper().create('Character', { id: other.id, name: 'Bob', description: '' });
    await history.capture({ entity: other, field: { column: 'name' } }, 'Bob', 'Bobby');
    const context = document.createElement('div');
    context.dataset['historyEntity'] = other.id;
    context.dataset['historyTable'] = other.table;
    const field = document.createElement('input');
    field.dataset['historyField'] = 'true';
    context.append(field);
    fixture.nativeElement.append(context);
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(db.getCrudHelper().findById('Character', other.id).name).toBe('Bob');
    expect(fixture.componentInstance.model.name).toBe('Alice');
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const button = document.createElement('button');
    dialog.append(button);
    fixture.nativeElement.append(dialog);
    const event = new KeyboardEvent('keydown', { key: 'y', ctrlKey: true, bubbles: true, cancelable: true });
    button.dispatchEvent(event);
    expect(event.defaultPrevented).toBeFalse();
    expect(history.canRedo()).toBeTrue();
  });

  it('does not retain an unedited editor as a history step', async () => {
    await mount();
    fixture.componentInstance.showEditor = false;
    fixture.detectChanges();
    await history.settle();
    expect(history.canUndo()).toBeFalse();
  });

  for (const selectedEngine of ['tiptap', 'editorjs'] as const) {
    it(`preserves rich content when reopening ${selectedEngine} in the other engine`, async () => {
      engine = selectedEngine;
      const rich: LorekitDocument = { format: 'lorekit-editor', version: 1, blocks: [
        { type: 'paragraph', alignment: 'left', indent: 0, content: [{ kind: 'text', text: 'Formatted', bold: true, italic: true }, { kind: 'mention', entityTable: 'Character', entityId: 'history-a', label: 'Original' }] },
        { type: 'image', url: 'asset://test-image', caption: [{ kind: 'text', text: 'Caption' }], layout: { withBorder: false, withBackground: false, stretched: false, width: 'auto' } },
        { type: 'list', style: 'unordered', start: 1, items: [{ content: [{ kind: 'text', text: 'List item' }], items: [] }] },
      ] };
      await mount();
      const address = { entity: { table: 'Character', id: 'history-a' }, field: { column: 'background', rich: true } };
      await history.capture(address, '', LorekitDocumentCodec.serialize(rich), 'paste');
      await history.undo();
      await history.redo();
      expect(fixture.componentInstance.model.background).toContain('test-image');
      fixture.componentInstance.showEditor = false;
      fixture.detectChanges();
      await history.settle();
      engine = selectedEngine === 'tiptap' ? 'editorjs' : 'tiptap';
      fixture.componentInstance.showEditor = true;
      fixture.detectChanges();
      await fixture.whenStable();
      const editor = fixture.debugElement.query(By.directive(EditorComponent)).componentInstance as EditorComponent;
      if (editor.editor) await editor.editor.isReady;
      await history.undo();
      await history.redo();
      const saved = LorekitDocumentCodec.deserialize(db.getCrudHelper().findById('Character', 'history-a').background);
      expect(saved).toEqual(LorekitDocumentCodec.deserialize(LorekitDocumentCodec.serialize(rich)));
    });

    it(`persists ${selectedEngine} when closed immediately before autosave`, async () => {
      engine = selectedEngine;
      const editor = await mount();
      if (editor.tiptap) editor.tiptap.commands.insertContent('Unsaved draft');
      else editor.editor.blocks.insert('paragraph', { text: 'Unsaved draft' });
      fixture.componentInstance.showEditor = false;
      fixture.detectChanges();
      await history.settle();
      expect(String(db.getCrudHelper().findById('Character', 'history-a').background)).toContain('Unsaved draft');
      expect(fixture.componentInstance.model.background).toContain('Unsaved draft');
      await history.undo();
      expect(LorekitDocumentCodec.toPlainText(LorekitDocumentCodec.deserialize(fixture.componentInstance.model.background)).trim()).toBe('');
      await history.redo();
      expect(fixture.componentInstance.model.background).toContain('Unsaved draft');
    });

    it(`restores real ${selectedEngine} content before autosave and after remount`, async () => {
      engine = selectedEngine;
      let editor = await mount();
      await type('#name-test', 'Alice');
      if (editor.tiptap) editor.tiptap.commands.insertContent('Explorer');
      else {
        editor.editor.blocks.insert('paragraph', { text: 'Explorer' });
        // Editor.js batches mutation notifications.
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      await history.settle();
      expect(history.undoStep()?.field.column).toBe('background');
      await history.undo();
      expect(LorekitDocumentCodec.toPlainText(LorekitDocumentCodec.deserialize(fixture.componentInstance.model.background)).trim()).toBe('');
      await history.redo();
      expect(LorekitDocumentCodec.toPlainText(LorekitDocumentCodec.deserialize(fixture.componentInstance.model.background))).toContain('Explorer');
      fixture.componentInstance.showEditor = false;
      fixture.detectChanges();
      await fixture.whenStable();
      await history.undo();
      fixture.componentInstance.showEditor = true;
      fixture.detectChanges();
      await fixture.whenStable();
      editor = fixture.debugElement.query(By.directive(EditorComponent)).componentInstance as EditorComponent;
      if (editor.editor) await editor.editor.isReady;
      await history.redo();
      const content = editor.tiptap?.getText() ?? JSON.stringify(await editor.editor.save());
      expect(content).toContain('Explorer');
    });
  }
});
