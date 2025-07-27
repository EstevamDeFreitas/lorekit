import { Component } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import {ButtonModule} from 'primeng/button';
import { CardModule } from 'primeng/card';
import { PaginatorModule } from 'primeng/paginator';
import { InputTextModule } from 'primeng/inputtext';

@Component({
  standalone: true,
  selector: 'app-root',
  imports: [RouterOutlet, ButtonModule, CardModule, PaginatorModule, InputTextModule, RouterLink],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'lorekit-frontend';
}
