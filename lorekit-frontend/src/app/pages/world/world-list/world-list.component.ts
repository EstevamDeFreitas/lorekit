import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-world-list',
  imports: [],
  template: `<p>world-list works!</p>`,
  styleUrl: './world-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorldListComponent { }
