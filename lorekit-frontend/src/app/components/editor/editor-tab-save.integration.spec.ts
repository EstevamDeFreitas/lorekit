import { TestBed } from '@angular/core/testing';
import { EditorComponent } from './editor.component';
import { GlobalParameterService } from '../../services/global-parameter.service';
import { ImageService } from '../../services/image.service';
import { EntityMentionService } from '../../services/entity-mention.service';
import { EntityHistoryService } from '../../services/entity-history.service';
import { WORKSPACE_TAB_CONTEXT, WorkspaceTabContext } from '../../models/workspace-tab-context';
import { FLUSH_PENDING_SAVES_EVENT, flushPendingComponentSaves } from '../../utils/pending-save-event';

describe('Rich editor tab-scoped save', () => {
  it('awaits its own asynchronous save and ignores flushes for another tab', async () => {
    const tabContext = new WorkspaceTabContext('rich-editor-tab');
    const fixture = await TestBed.configureTestingModule({
      imports: [EditorComponent],
      providers: [
        { provide: WORKSPACE_TAB_CONTEXT, useValue: tabContext },
        { provide: GlobalParameterService, useValue: { getParameter: () => null } },
        { provide: ImageService, useValue: {} },
        { provide: EntityMentionService, useValue: {} },
        { provide: EntityHistoryService, useValue: { trackLifecycle: jasmine.createSpy('trackLifecycle') } },
      ],
    }).overrideComponent(EditorComponent, {
      set: { template: '<div></div>' },
    }).compileComponents().then(() => TestBed.createComponent(EditorComponent));
    const component = fixture.componentInstance as any;
    const saveDocument = spyOn(fixture.componentInstance.saveDocument, 'emit');
    component.editor = {
      save: jasmine.createSpy('save').and.resolveTo({ blocks: [] }),
      isReady: Promise.resolve(),
      destroy: jasmine.createSpy('destroy'),
    };
    component.changeRevision = 1;
    component.savedRevision = 0;
    window.addEventListener(FLUSH_PENDING_SAVES_EVENT, component.onFlushPendingSaves);

    await flushPendingComponentSaves('different-tab');
    expect(component.editor.save).not.toHaveBeenCalled();
    expect(saveDocument).not.toHaveBeenCalled();

    await flushPendingComponentSaves('rich-editor-tab');
    expect(component.editor.save).toHaveBeenCalledTimes(1);
    expect(saveDocument).toHaveBeenCalledTimes(1);
    expect(component.savedRevision).toBe(1);

    window.removeEventListener(FLUSH_PENDING_SAVES_EVENT, component.onFlushPendingSaves);
    component.discardPendingSaveOnDestroy = true;
    fixture.destroy();
  });
});
