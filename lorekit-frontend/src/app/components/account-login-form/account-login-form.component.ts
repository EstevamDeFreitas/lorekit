import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-account-login-form',
  imports: [ReactiveFormsModule],
  templateUrl: './account-login-form.component.html',
  styleUrl: './account-login-form.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountLoginFormComponent {
  protected readonly auth = inject(AuthService);
  readonly authenticated = output<void>();

  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.auth.busy()) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, password } = this.form.getRawValue();
    try {
      await this.auth.login(email, password);
      this.form.controls.password.reset();
      this.authenticated.emit();
    } catch {
      // A mensagem de erro reativa é exposta pelo AuthService.
    }
  }
}
