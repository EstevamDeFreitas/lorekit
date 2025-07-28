import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-world-edit',
  imports: [],
  template: `<p>world-edit works!</p>`,
  styleUrl: './world-edit.component.scss',
  changeDetection: ChangeDetectionStrategy.Default,
  standalone: true
})
export class WorldEditComponent { }
