import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-world-edit',
  imports: [],
  template: `<p>world-edit works!</p>`,
  styleUrl: './world-edit.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class WorldEditComponent { }
