import { Component, input, OnDestroy, OnInit } from '@angular/core';
import { OverlayModule } from '@angular/cdk/overlay';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, Subject, Subscription } from 'rxjs';
import { CrudHelper } from '../../database/database.helper';
import { DbProvider } from '../../app.config';
import { schema } from '../../database/schema';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-search',
  imports: [CommonModule, OverlayModule, FormsModule, RouterLink],
  template: `
  <div
      cdkOverlayOrigin
      #trigger="cdkOverlayOrigin"
      class="w-90 flex flex-row items-center gap-1 rounded-md bg-zinc-925 border border-zinc-700 text-white focus:outline-none focus-within:border-white"
    >
    <div class="w-8 h-5 flex flex-row justify-center items-center">
        <i class="fa fa-search "></i>
      </div>
      <input
        type="text"
        (focus)="isOpen = true"
        [(ngModel)]="searchTerm"
        (ngModelChange)="onSearchInput($event)"
        placeholder="Pesquisar..."
        class="w-full p-1 bg-transparent border-none outline-none placeholder:text-white/10"
      />
  </div>

  <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="trigger"
      [cdkConnectedOverlayOpen]="isOpen"
      [cdkConnectedOverlayWidth]="trigger.elementRef.nativeElement.offsetWidth"
      [cdkConnectedOverlayOffsetY]="4"
      (overlayOutsideClick)="isOpen = false"
    >
      <div class="bg-zinc-900 border w-90 border-zinc-700 rounded-md shadow-lg p-2 flex flex-col gap-2 text-sm text-zinc-300">
        @if (searchResultKeys.length === 0){
          <div>
            Nenhum resultado encontrado.
          </div>
        }
        @else {
          @for (key of searchResultKeys; track key) {
            <div class="border-b border-zinc-800 pb-1">
              <div class="font-bold text-white mb-1">{{ key }}
                <span class="text-xs text-zinc-500">({{ searchResults[key].length }} resultado{{ searchResults[key].length > 1 ? 's' : '' }})</span>
              </div>
              <div  class="flex flex-col gap-1 max-h-60 overflow-y-auto scrollbar-dark">
                @for (result of searchResults[key]; track result.id) {
                  <div [routerLink]="getEditUrl(key, result.id)" class="p-1 rounded-md hover:bg-zinc-800 cursor-pointer">
                    @if (key === 'Document'){
                      <div>
                        <div class="font-bold">{{ result.title }}</div>
                        <div class="text-xs text-zinc-500 line-clamp-2">{{ result.content }}</div>
                      </div>
                    }
                    @else {
                      <div>
                        <div class="font-bold">{{ result.name }}</div>
                        <div class="text-xs text-zinc-500 line-clamp-2">{{ result.concept }}</div>
                      </div>
                    }
                  </div>
                }
              </div>
            </div>
          }
        }

      </div>
    </ng-template>

  `,
  styleUrl: './search.component.css',
})
export class SearchComponent implements OnInit, OnDestroy {
  isOpen = false;

  searchTerm: string = '';

  private searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;
  private crud : CrudHelper;

  currentTables = schema;

  tablesToIgnore = input<string[]>(['Personalization', 'Image', 'Relationship', 'GlobalParameter', 'Link', 'LocationCategory', 'OrganizationType']);

  searchResults: { [tableName: string]: any[] } = {};
  searchResultKeys: string[] = [];

  constructor(private dbProvider : DbProvider) {
    this.crud = this.dbProvider.getCrudHelper();
  }

  search(term: string) {
    this.searchResults = {};
    this.searchResultKeys = [];

    if(term.trim() === '') {
      return;
    }

    this.currentTables.forEach((table) => {
      if(this.tablesToIgnore().includes(table.name)) {
        return;
      }

      if(table.name === 'Document'){
        this.searchResults[table.name] = this.crud.searchInTable(table.name, term, ['title', 'content']);
      }
      else {
        this.searchResults[table.name] = this.crud.searchInTable(table.name, term, ['name', 'concept']);
      }

    })


    this.searchResultKeys = Object.keys(this.searchResults).filter(key => this.searchResults[key].length > 0);
  }

  ngOnInit(): void {
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(term => {
      this.search(term);
    });
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
  }

  onSearchInput(term: string) {
    this.searchSubject.next(term);
  }

  getEditUrl(tableName: string, id: string): string {
    if(tableName === 'Species'){
      return `/app/specie/edit/${id}`;
    }
    return `/app/${tableName.toLowerCase()}/edit/${id}`;
  }
}
