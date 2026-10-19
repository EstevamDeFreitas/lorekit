import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { MainUiComponent } from './main-ui.component';
import { SidebarPanelComponent } from '../../../components/sidebar-panel/sidebar-panel.component';
import { routes } from '../../../app.routes';
import { DbProvider } from '../../../database/db-provider.service';
import { ComponentRegistryService } from '../../../services/component-registry.service';
import { TabManagerService } from '../../../services/tab-manager.service';
import { AuthService } from '../../../services/auth.service';
import { StoryCacheService } from '../../../services/story-cache.service';
import { StoryNavigationService } from '../../../services/story-navigation.service';
import { WorkspaceRuntimeService } from '../../../services/workspace-runtime.service';

@Component({ selector: 'test-story-tab', template: 'Conteúdo da aba' })
class TestTabComponent {}
@Component({ selector: 'app-sidebar-panel', template: '' })
class TestSidebarComponent {}

describe('Stories inside the Lorekit shell', () => {
  it('opens invitations in the shared tab layout without a vault and retains editors across routes', async () => {
    const ready = signal(false),
      getCrudHelper = jasmine.createSpy('getCrudHelper').and.returnValue({ findFirst: () => null, create() {}, updateKey() {} });
    const initialize = jasmine
      .createSpy('initializeAuthenticatedWeb')
      .and.callFake(async () => {
        ready.set(true);
      });
    const testRoutes = routes.map((route) =>
      route.component === MainUiComponent
        ? {
            ...route,
            children: route.children?.map((child) =>
              child.path?.startsWith('stories')
                ? {
                    ...child,
                    loadComponent: () => Promise.resolve(TestTabComponent),
                  }
                : child,
            ),
          }
        : route,
    );
    TestBed.configureTestingModule({
      providers: [
        provideRouter(testRoutes),
        { provide: DbProvider, useValue: { ready, getCrudHelper } },
        {
          provide: ComponentRegistryService,
          useValue: {
            getComponent: async () => TestTabComponent,
            getTabInputs: () => ({}),
          },
        },
        { provide: AuthService, useValue: { isAuthenticated: () => true } },
        {
          provide: StoryCacheService,
          useValue: { knownAccount: signal(null) },
        },
        {
          provide: WorkspaceRuntimeService,
          useValue: { initializeAuthenticatedWeb: initialize },
        },
      ],
    });
    TestBed.overrideComponent(MainUiComponent, {
      remove: { imports: [SidebarPanelComponent] },
      add: { imports: [TestSidebarComponent] },
    });
    const harness = await RouterTestingHarness.create();
    const firstShell = await harness.navigateByUrl(
      '/stories/invite/single-use-token',
      MainUiComponent,
    );
    await harness.fixture.whenStable();
    harness.detectChanges();
    const tabs = TestBed.inject(TabManagerService),
      navigation = TestBed.inject(StoryNavigationService);
    expect(initialize).not.toHaveBeenCalled();
    expect(getCrudHelper).not.toHaveBeenCalled();
    expect(navigation.target()?.token).toBe('single-use-token');
    expect(
      tabs.snapshot.panes
        .flatMap((pane) => pane.tabs)
        .map((tab) => tab.entityId),
    ).toEqual(['stories']);
    expect(
      harness.routeNativeElement?.querySelector(
        '[aria-label="Navegação principal"]',
      ),
    ).not.toBeNull();
    expect(
      harness.routeNativeElement?.querySelector('app-workspace-tab-bar'),
    ).not.toBeNull();
    const ownShell = await harness.navigateByUrl('/app/world', MainUiComponent);
    expect(ownShell).toBe(firstShell);
    expect(initialize).toHaveBeenCalledTimes(1);
    await tabs.openTab('World', 'own-world', 'Meu mundo', 'fa-solid fa-earth');
    await harness.navigateByUrl(
      '/stories/a-story/assets/an-image',
      MainUiComponent,
    );
    await harness.fixture.whenStable();
    harness.detectChanges();
    const allTabs = tabs.snapshot.panes.flatMap((pane) => pane.tabs);
    expect(allTabs.filter((tab) => tab.entityId === 'stories')).toHaveSize(1);
    expect(allTabs.some((tab) => tab.entityId === 'own-world')).toBeTrue();
    expect(navigation.target()).toEqual({
      id: 'a-story',
      assetId: 'an-image',
      token: null,
    });
  });
});
