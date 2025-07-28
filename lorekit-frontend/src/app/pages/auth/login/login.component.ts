import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { FloatLabel } from 'primeng/floatlabel';
import { ButtonModule } from 'primeng/button';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { Router } from '@angular/router';
import { Message } from 'primeng/message';

@Component({
  selector: 'app-login',
  imports: [CardModule, ReactiveFormsModule, InputTextModule, FloatLabel, ButtonModule, Message],
  template: `
    <div class="flex justify-center items-center h-screen">
      <p-card header="Login" class="h-fit w-96 flex">
        @for (message of messages(); track message; let first = $first) {
            <p-message [severity]="message.severity" [life]="3000" [text]="message.content" />
        }
        <br>
        <p-floatlabel>
          <input pInputText type="email" id="email" class="w-full" [formControl]="email" autocomplete="off" />
          <label for="email">Email</label>
        </p-floatlabel>
        <br>
        <p-floatlabel>
          <input pInputText id="password" type="password" class="w-full" [formControl]="password" autocomplete="off" />
          <label for="password">Password</label>
        </p-floatlabel>
        <br>
        <button pButton (click)="onSubmit()">Entrar</button>
      </p-card>
    </div>
  `,
  styleUrl: './login.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  email = new FormControl('', [Validators.email, Validators.required]);
  password = new FormControl('', [Validators.required]);

  messages = signal<any[]>([]);

  constructor(private auth:AuthService, private router:Router) {}

  public onSubmit() {

    if (this.email.invalid || this.password.invalid) {
      console.error('Form is invalid');
      return;
    }

    this.auth.login(this.email.value, this.password.value).subscribe({
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
