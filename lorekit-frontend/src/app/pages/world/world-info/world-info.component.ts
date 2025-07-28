import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-world-info',
  imports: [],
  template: `<p>world-info works!</p>`,
  styleUrl: './world-info.component.css',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class WorldInfoComponent { }
