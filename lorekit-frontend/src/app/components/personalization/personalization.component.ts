import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-personalization',
  imports: [],
  template: `<p>personalization works!</p>`,
  styleUrl: './personalization.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonalizationComponent { }
