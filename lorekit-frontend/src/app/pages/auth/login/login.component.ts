import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AccountLoginFormComponent } from '../../../components/account-login-form/account-login-form.component';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-login',
  imports: [AccountLoginFormComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) {
      void this.navigateToApp();
    }
  }

  protected authenticated(): void {
    void this.navigateToApp();
  }

  private async navigateToApp(): Promise<void> {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    await this.router.navigateByUrl(returnUrl?.startsWith('/app') ? returnUrl : '/app/world');
  }
}
