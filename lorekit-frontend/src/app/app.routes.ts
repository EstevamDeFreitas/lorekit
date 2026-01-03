import { Routes } from '@angular/router';
import { WorldEditComponent } from './pages/world/world-edit/world-edit.component';
import { AuthGuard } from './guards/auth.guard';
import { LoginComponent } from './pages/auth/login/login.component';
import { WorldListComponent } from './pages/world/world-list/world-list.component';
import { MainUiComponent } from './pages/shared/main-ui/main-ui.component';
import { WorldInfoComponent } from './pages/world/world-info/world-info.component';
import { DocumentEditComponent } from './pages/documents/document-edit/document-edit.component';

export const routes: Routes = [
  {path: '', redirectTo: 'app', pathMatch: 'full'},
  {path: 'app', component: MainUiComponent, children: [
      {path: 'world', children:[
        {path: '', component: WorldListComponent},
        {path: 'info/:worldId', loadComponent: () =>
      import('./pages/world/world-info/world-info.component')
        .then(m => m.WorldInfoComponent)},

      ]},
      {path:'document', children:[
        {path: '', redirectTo: 'list', pathMatch: 'full'},
        {path: 'list', loadComponent: () =>
          import('./pages/documents/document-list/document-list.component')
            .then(m => m.DocumentListComponent)},
        {path: 'edit/:documentId', loadComponent: () =>
          import('./pages/documents/document-edit/document-edit.component')
            .then(m => m.DocumentEditComponent)},
      ]},
      {path:'location', children:[
        {path: '', redirectTo: 'list', pathMatch: 'full'},
        {
            path: 'list',
            loadComponent: () =>
              import('./pages/locations/location-list/location-list.component')
                .then(m => m.LocationListComponent),
          },
          {
            path: 'edit/:locationId',
            loadComponent: () =>
              import('./pages/locations/location-edit/location-edit.component')
                .then(m => m.LocationEditComponent),
          },
      ]},
      {path:'specie', children:[
        {path: '', redirectTo: 'list', pathMatch: 'full'},
        {path: 'list', loadComponent: () =>
          import('./pages/species/specie-list/specie-list.component')
            .then(m => m.SpecieListComponent),
        },
        {path: 'edit/:specieId', loadComponent: () =>
          import('./pages/species/specie-edit/specie-edit.component')
            .then(m => m.SpecieEditComponent),
        },
      ]},
      {path:'character', children:[
        {path: '', redirectTo: 'list', pathMatch: 'full'},
        {path: 'list', loadComponent: () =>
          import('./pages/characters/character-list/character-list.component')
            .then(m => m.CharacterListComponent),
        },
        {path: 'edit/:characterId', loadComponent: () =>
          import('./pages/characters/character-edit/character-edit.component')
            .then(m => m.CharacterEditComponent),
        },
      ]},
      {path:'culture', children:[
        {path: '', redirectTo: 'list', pathMatch: 'full'},
        {path: 'list', loadComponent: () =>
          import('./pages/cultures/culture-list/culture-list.component')
            .then(m => m.CultureListComponent),
        },
        {path: 'edit/:cultureId', loadComponent: () =>
          import('./pages/cultures/culture-edit/culture-edit.component')
            .then(m => m.CultureEditComponent),
        },
      ]},
      {
        path: 'organization', children: [
          {path: '', redirectTo: 'list', pathMatch: 'full'},
          {path: 'list', loadComponent: () =>
            import('./pages/organizations/organization-list/organization-list.component')
              .then(m => m.OrganizationListComponent),
          },
          {path: 'edit/:organizationId', loadComponent: () =>
            import('./pages/organizations/organization-edit/organization-edit.component')
              .then(m => m.OrganizationEditComponent),
          },
        ]
      },
    ]
  }

];
