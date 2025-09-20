import { Routes } from '@angular/router';
import { WorldEditComponent } from './pages/world/world-edit/world-edit.component';
import { AuthGuard } from './guards/auth.guard';
import { LoginComponent } from './pages/auth/login/login.component';
import { WorldListComponent } from './pages/world/world-list/world-list.component';
import { MainUiComponent } from './pages/shared/main-ui/main-ui.component';
import { WorldInfoComponent } from './pages/world/world-info/world-info.component';
import { DocumentEditComponent } from './pages/documents/document-edit/document-edit.component';

export const routes: Routes = [
  {path: '', redirectTo: 'login', pathMatch: 'full'},
  {path:'login', component: LoginComponent},
  {path: 'app', canActivate: [AuthGuard], component: MainUiComponent, children: [
      {path: 'world', children:[
        {path: '', component: WorldListComponent},
        {path: 'info/:worldId', component: WorldInfoComponent, children: [
          {path: 'edit', component: WorldEditComponent},
        ]},

      ]},
      {path:'document', children:[
        {path: 'edit/:documentId', component: DocumentEditComponent},
      ]}
    ]
  }

];
