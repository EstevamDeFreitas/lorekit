import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { DbProvider } from './app.config';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        {
          provide: DbProvider,
          useValue: {
            getCrudHelper: () => ({
              searchInTable: () => [],
            }),
            getDb: () => ({
              exec: () => [],
            }),
          },
        },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have the 'lorekit-frontend' title`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('lorekit-frontend');
  });

  it('should render the search entrypoint', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-search')).not.toBeNull();
  });
  it('uses F5 to refresh components without reloading the window', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    const refreshSpy = spyOn(app, 'refreshComponents').and.resolveTo();
    const event = new KeyboardEvent('keydown', { key: 'F5', cancelable: true });

    document.dispatchEvent(event);

    expect(event.defaultPrevented).toBeTrue();
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    fixture.destroy();
  });
});
