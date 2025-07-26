import { Routes } from '@angular/router';
import { WorldEditComponent } from './pages/world-edit/world-edit.component';

export const routes: Routes = [
  {path: 'world', children:[
    {path: 'edit', component: WorldEditComponent},
  ]}
];
