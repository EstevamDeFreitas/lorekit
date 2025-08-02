import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../../components/button/button.component';
import { InputComponent } from '../../../components/button/input/input.component';
@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, ButtonComponent, InputComponent],
  template: `
  <div class="flex justify-center items-center h-screen">
    <div class="rounded-lg bg-zinc-900 p-4 flex flex-col gap-4 w-84">
      <h1 class="text-2xl text-center mt-6 mb-6">Bem vindo!</h1>
      <app-input label="Email:" type="email" [required]="true" [(value)]="email"></app-input>
      <app-input label="Senha:" type="password" [required]="false" [(value)]="password"></app-input>
      <br>
      <app-button label="Entrar" (click)="onSubmit()"></app-button>
    </div>
  </div>
  `,
  styleUrl: './login.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  email = '';
  password = '';

  messages = signal<any[]>([]);

  constructor(private auth:AuthService, private router:Router) {}

  public onSubmit() {

    this.auth.login(this.email, this.password).subscribe({
      next: () => {
        this.router.navigate(['/app/world']);
      },
      error: (err) => {
        this.messages.set([]);
        this.messages.set([{ severity: 'error', content: err.error.error  }]);
      }
    });
  }
}
