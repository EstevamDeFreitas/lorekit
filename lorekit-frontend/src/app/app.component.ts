import { Component } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { SearchComponent } from './components/search/search.component';

@Component({
  standalone: true,
  selector: 'app-root',
  imports: [RouterOutlet,RouterLink, SearchComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'lorekit-frontend';
}
