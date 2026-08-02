import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { AccountLoginFormComponent } from './account-login-form.component';

describe('AccountLoginFormComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountLoginFormComponent],
      providers: [provideHttpClient()],
    }).compileComponents();
  });

  it('binds the email and password controls to its form group', () => {
    const fixture = TestBed.createComponent(AccountLoginFormComponent);

    expect(() => fixture.detectChanges()).not.toThrow();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('form')).not.toBeNull();
    expect(element.querySelector('input[formControlName="email"]')).not.toBeNull();
    expect(element.querySelector('input[formControlName="password"]')).not.toBeNull();
  });
});
